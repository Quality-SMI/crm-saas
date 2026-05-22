import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';
import { Session } from '../sessions/entities/session.entity';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [
    PassportModule,
    PermissionsModule,
    TypeOrmModule.forFeature([User, Session]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        privateKey: config.get<string>('jwt.privateKey') ?? '',
        publicKey: config.get<string>('jwt.publicKey') ?? '',
        signOptions: {
          algorithm: 'RS256' as const,
          expiresIn: (config.get<string>('jwt.accessExpiry') ?? '15m') as `${number}${'s'|'m'|'h'|'d'}`,
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
