import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

const isProd = () => process.env.NODE_ENV === 'production';

const accessCookie = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: 'lax',
  path: '/',
  maxAge: 15 * 60 * 1000, // 15min — alinhado com JWT_ACCESS_EXPIRY default
});

const refreshCookie = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const { accessToken, refreshToken, user } = await this.authService.login(
      dto,
      ip,
      userAgent,
    );

    res.cookie('access_token', accessToken, accessCookie());
    res.cookie('refresh_token', refreshToken, refreshCookie());

    return { data: { user } };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Sessão expirada');
    }

    const ip = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken, ip, userAgent);

    res.cookie('access_token', accessToken, accessCookie());
    res.cookie('refresh_token', newRefreshToken, refreshCookie());

    return { data: { ok: true } };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (refreshToken) {
      await this.authService.logout(user.id, refreshToken);
    }
    res.clearCookie('access_token', { ...accessCookie(), maxAge: 0 });
    res.clearCookie('refresh_token', { ...refreshCookie(), maxAge: 0 });
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ip = req.ip || 'unknown';
    await this.authService.requestPasswordReset(dto.email, ip);
    // Resposta neutra — não vaza se o email existe ou não
    return { data: { ok: true } };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const ip = req.ip || 'unknown';
    await this.authService.resetPassword(dto.token, dto.password, ip);
    return { data: { ok: true } };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { data: { ok: true } };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: User) {
    return { data: await this.authService.getProfile(user.id) };
  }
}
