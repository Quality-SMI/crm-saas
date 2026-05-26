import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { Session } from '../sessions/entities/session.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { LoginDto } from './dto/login.dto';
import { PermissionsService } from '../permissions/permissions.service';
import { MailService } from '../../common/mail/mail.service';

// Timing attack prevention: always run bcrypt even if user not found
const DUMMY_HASH =
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NQb.8OEEO';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(PasswordResetToken)
    private readonly resetRepo: Repository<PasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly permissionsService: PermissionsService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto, ip: string, userAgent: string) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
      select: {
        id: true, email: true, name: true, role: true, password_hash: true,
        is_active: true, failed_login_attempts: true, locked_until: true, client_id: true,
      },
    });

    // Verificar lockout ANTES de validar a senha — impede distinguir senha correta via
    // mensagem de erro diferente quando a conta está bloqueada
    if (user?.isLocked) {
      await bcrypt.compare(dto.password, DUMMY_HASH); // trabalho constante para manter timing
      throw new UnauthorizedException('Conta temporariamente bloqueada. Tente novamente mais tarde.');
    }

    // Always compare to prevent timing attacks
    const hashToCompare = user?.password_hash ?? DUMMY_HASH;
    const isValid = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !isValid || !user.is_active) {
      if (user) await this.incrementFailedAttempts(user);
      // Generic message — never reveal if email exists
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.resetFailedAttempts(user);

    const perms = await this.permissionsService.getEffectivePermissions(user.id, user.role);
    const { accessToken, refreshToken } = await this.createSession(user, ip, userAgent, null, perms);

    this.logger.log(`AUTH_LOGIN_SUCCESS user=${user.id} ip=${ip}`);

    return { accessToken, refreshToken, user: { ...this.sanitizeUser(user), permissions: perms } };
  }

  async refresh(refreshToken: string, ip: string, userAgent: string) {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessionRepo.findOne({
      where: { refresh_token_hash: tokenHash, is_active: true },
      relations: { user: true },
    });

    if (!session || session.expires_at < new Date()) {
      // Possible token reuse — revoke entire family
      if (session) {
        await this.revokeFamilySessions(session.token_family);
        this.logger.warn(`REFRESH_TOKEN_REUSE_DETECTED family=${session.token_family}`);
      }
      throw new UnauthorizedException('Sessão inválida');
    }

    if (!session.user.is_active) {
      await this.revokeSession(session, 'user_inactive');
      throw new UnauthorizedException('Conta desativada');
    }

    // Rotate: revoke old session, create new one
    await this.revokeSession(session, 'rotated');
    const perms = await this.permissionsService.getEffectivePermissions(session.user.id, session.user.role);
    const { accessToken, refreshToken: newRefreshToken } =
      await this.createSession(session.user, ip, userAgent, session.token_family, perms);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.sessionRepo.update(
      { user_id: userId, refresh_token_hash: tokenHash },
      { is_active: false, revoked_at: new Date(), revoke_reason: 'logout' },
    );
    this.logger.log(`AUTH_LOGOUT user=${userId}`);
  }

  async requestPasswordReset(email: string, ip: string) {
    const normalized = email.toLowerCase();
    const user = await this.userRepo.findOne({
      where: { email: normalized, is_active: true },
      select: { id: true, email: true, name: true },
    });

    // Resposta sempre neutra — não vaza existência do email
    if (!user) {
      this.logger.log(`PASSWORD_RESET_REQUEST_UNKNOWN email=${normalized} ip=${ip}`);
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex'); // 64 chars
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await this.resetRepo.insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      requested_ip: ip,
    });

    const baseUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    await this.mail.send({
      to: user.email,
      subject: 'Recuperação de senha — CRM Quality SMI',
      text:
        `Olá ${user.name},\n\n` +
        `Recebemos um pedido de redefinição de senha para sua conta.\n` +
        `Acesse o link abaixo (válido por 30 minutos):\n\n${resetUrl}\n\n` +
        `Se você não solicitou isto, ignore este email.\n`,
    });

    this.logger.log(`PASSWORD_RESET_REQUEST_SENT user=${user.id} ip=${ip}`);
  }

  async resetPassword(rawToken: string, newPassword: string, ip: string) {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.resetRepo.findOne({ where: { token_hash: tokenHash } });

    if (!record || record.used_at || record.expires_at < new Date()) {
      this.logger.warn(`PASSWORD_RESET_INVALID_TOKEN ip=${ip}`);
      throw new UnauthorizedException('Link de recuperação inválido ou expirado');
    }

    const user = await this.userRepo.findOne({
      where: { id: record.user_id, is_active: true },
    });
    if (!user) {
      throw new UnauthorizedException('Conta indisponível');
    }

    const hash = await bcrypt.hash(newPassword, 12);
    user.password_hash = hash;
    user.failed_login_attempts = 0;
    user.locked_until = null;
    await this.userRepo.save(user);

    record.used_at = new Date();
    await this.resetRepo.save(record);

    // Revoga TODAS as sessões ativas — força re-login em todos dispositivos
    await this.sessionRepo.update(
      { user_id: user.id, is_active: true },
      { is_active: false, revoked_at: new Date(), revoke_reason: 'password_reset' },
    );

    this.logger.log(`PASSWORD_RESET_SUCCESS user=${user.id} ip=${ip}`);
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId, is_active: true },
      select: { id: true, email: true, name: true, role: true, client_id: true },
    });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    const permissions = await this.permissionsService.getEffectivePermissions(userId, user.role);
    return { ...this.sanitizeUser(user), permissions };
  }

  async validateJwtPayload(payload: { sub: string; jti: string }) {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub, is_active: true },
    });
    if (!user) return null;
    return user;
  }

  private async createSession(
    user: User,
    ip: string,
    userAgent: string,
    existingFamily?: string | null,
    perms: string[] = [],
  ) {
    const family = existingFamily ?? crypto.randomUUID();
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const jti = crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session = this.sessionRepo.create({
      user_id: user.id,
      refresh_token_hash: tokenHash,
      token_family: family,
      is_active: true,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: expiresAt,
    });
    await this.sessionRepo.save(session);

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, jti, perms },
      { expiresIn: this.config.get('jwt.accessExpiry', '15m') },
    );

    return { accessToken, refreshToken: rawRefreshToken, session };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async revokeSession(session: Session, reason: string) {
    session.is_active = false;
    session.revoked_at = new Date();
    session.revoke_reason = reason;
    await this.sessionRepo.save(session);
  }

  private async revokeFamilySessions(family: string | null) {
    if (!family) return;
    await this.sessionRepo.update(
      { token_family: family, is_active: true },
      { is_active: false, revoked_at: new Date(), revoke_reason: 'reuse_detected' },
    );
  }

  private async incrementFailedAttempts(user: User) {
    user.failed_login_attempts += 1;
    if (user.failed_login_attempts >= 10) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 30);
      user.locked_until = lockUntil;
      this.logger.warn(`ACCOUNT_LOCKED user=${user.id}`);
    }
    await this.userRepo.save(user);
  }

  private async resetFailedAttempts(user: User) {
    user.failed_login_attempts = 0;
    user.locked_until = null;
    user.last_login_at = new Date();
    await this.userRepo.save(user);
  }

  private sanitizeUser(user: User) {
    const { password_hash, ...safe } = user as any;
    return safe;
  }
}
