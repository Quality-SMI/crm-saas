import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.publicKey') ?? '',
      algorithms: ['RS256'],
    });
  }

  async validate(payload: { sub: string; email: string; role: string; jti: string; perms?: string[] }) {
    const user = await this.authService.validateJwtPayload(payload);
    if (!user) throw new UnauthorizedException('Token inválido');
    (user as any).permissions = payload.perms ?? [];
    return user;
  }
}
