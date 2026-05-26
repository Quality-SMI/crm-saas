import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { Session } from '../sessions/entities/session.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { PermissionsService } from '../permissions/permissions.service';
import { MailService } from '../../common/mail/mail.service';

const makeUser = (overrides: Partial<User> = {}): User => {
  const u = new User();
  u.id = 'user-1';
  u.email = 'user@example.com';
  u.name = 'User';
  (u as any).password_hash = '';
  u.role = 'SALES' as any;
  u.is_active = true;
  u.failed_login_attempts = 0;
  u.locked_until = null;
  u.client_id = null;
  Object.assign(u, overrides);
  return u;
};

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: any;
  let sessionRepo: any;
  let resetRepo: any;
  let permissionsService: any;
  let mail: any;

  beforeEach(async () => {
    userRepo = { findOne: jest.fn(), save: jest.fn(async (x) => x) };
    sessionRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (x) => x),
      create: jest.fn((d) => d),
      update: jest.fn(),
    };
    resetRepo = {
      insert: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x) => x),
    };
    permissionsService = { getEffectivePermissions: jest.fn(async () => []) };
    mail = { send: jest.fn(async () => undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: resetRepo,
        },
        { provide: JwtService, useValue: { sign: () => 'jwt.signed' } },
        {
          provide: ConfigService,
          useValue: { get: (k: string, d?: unknown) => d },
        },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('rejeita senha errada com UnauthorizedException', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      userRepo.findOne.mockResolvedValueOnce(makeUser({ password_hash: hash }));
      await expect(
        service.login(
          { email: 'user@example.com', password: 'wrong' } as any,
          '1.1.1.1',
          'UA',
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejeita conta bloqueada mesmo com senha correta', async () => {
      const hash = await bcrypt.hash('p@ssw0rd', 4);
      const user = makeUser({ password_hash: hash });
      user.locked_until = new Date(Date.now() + 60_000);
      userRepo.findOne.mockResolvedValueOnce(user);
      await expect(
        service.login(
          { email: user.email, password: 'p@ssw0rd' } as any,
          '1.1.1.1',
          'UA',
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('emite tokens e zera tentativas falhas em login válido', async () => {
      const hash = await bcrypt.hash('p@ssw0rd', 4);
      const user = makeUser({
        password_hash: hash,
        failed_login_attempts: 3,
      });
      userRepo.findOne.mockResolvedValueOnce(user);

      const result = await service.login(
        { email: user.email, password: 'p@ssw0rd' },
        '1.1.1.1',
        'UA',
      );

      expect(result.accessToken).toBe('jwt.signed');
      expect(result.refreshToken).toMatch(/^[a-f0-9]{80}$/);
      expect(user.failed_login_attempts).toBe(0);
      expect(sessionRepo.save).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('detecta reuse e revoga a família', async () => {
      const expired = new Date(Date.now() - 60_000);
      sessionRepo.findOne.mockResolvedValueOnce({
        id: 's1',
        user_id: 'user-1',
        token_family: 'fam-1',
        expires_at: expired,
        is_active: true,
        user: makeUser({ is_active: true }),
      });
      await expect(
        service.refresh('raw', '1.1.1.1', 'UA'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessionRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ token_family: 'fam-1' }),
        expect.objectContaining({ revoke_reason: 'reuse_detected' }),
      );
    });

    it('rotaciona e emite novo token quando válido', async () => {
      const future = new Date(Date.now() + 3600_000);
      const user = makeUser();
      sessionRepo.findOne.mockResolvedValueOnce({
        id: 's2',
        user_id: user.id,
        token_family: 'fam-2',
        expires_at: future,
        is_active: true,
        user,
      });
      const out = await service.refresh('raw', '1.1.1.1', 'UA');
      expect(out.accessToken).toBe('jwt.signed');
      expect(out.refreshToken).toMatch(/^[a-f0-9]{80}$/);
    });
  });

  describe('requestPasswordReset', () => {
    it('responde silenciosamente quando email não existe', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.requestPasswordReset('unknown@x.com', '1.1.1.1'),
      ).resolves.toBeUndefined();
      expect(resetRepo.insert).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    });

    it('cria token e dispara email para usuário existente', async () => {
      userRepo.findOne.mockResolvedValueOnce(makeUser());
      await service.requestPasswordReset('user@example.com', '1.1.1.1');
      expect(resetRepo.insert).toHaveBeenCalledTimes(1);
      expect(mail.send).toHaveBeenCalledTimes(1);
      const args = mail.send.mock.calls[0][0];
      expect(args.to).toBe('user@example.com');
      expect(args.text).toMatch(/reset-password\?token=/);
    });
  });
});
