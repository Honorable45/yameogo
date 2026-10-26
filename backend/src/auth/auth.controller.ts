import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { loadConfig } from '../config/env';
import { SESSION_COOKIE, AuthService } from './auth.service';
import { AuthUser, CurrentUser, Public } from './decorators';
import { ROLE_PERMISSIONS } from './permissions';

class LoginDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(1, { message: 'Mot de passe requis.' })
  @MaxLength(200)
  password: string;
}

class ChangePasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword: string;

  @IsString()
  @MinLength(10, { message: 'Le nouveau mot de passe doit contenir au moins 10 caractères.' })
  @MaxLength(200)
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  private readonly config = loadConfig();

  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password, { ip: req.ip, userAgent: req.headers['user-agent'] });
    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      expires: result.expiresAt,
    });
    return { user: { ...result.user, permissions: [...ROLE_PERMISSIONS[result.user.role]] } };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, permissions: [...ROLE_PERMISSIONS[user.role]] },
    };
  }

  @Post('password')
  @HttpCode(200)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword, user.sessionId);
    return { ok: true };
  }
}
