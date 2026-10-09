import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto.js';
import type { Request, Response } from 'express';
import { LoginDto } from './dto/login.dto.js';
import { COOKIE_KEYS } from '@fmbase/constants';
import { JWTAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import type { JwtPayload } from '@fmbase/types';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    // 默认情况下，如果你注入了 @Res()，NestJS 会认为你要自己完全控制响应，就不会再自动处理返回值
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.authService.register(dto);
    if (!token) {
      throw new Error('Failed to register user.');
    }
    this.authService.setTokenCookies(res, token); // 手动设置cookie
    return { message: 'Register successfully.' }; // 正常返回JSON
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto);
    if (!tokens) {
      throw new Error('Failed to generate tokens.');
    }
    this.authService.setTokenCookies(res, tokens);
    return { message: 'Logged in susscessfully.' };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearTokenCookies(res);
    return { message: 'Logged out susscessfully.' };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies[COOKIE_KEYS.REFRESH_TOKEN];
    if (!refreshToken) {
      throw new Error('Refresh token not found.');
    }
    const tokens = await this.authService.refreshTokens(refreshToken);
    if (!tokens) {
      throw new Error('Failed to refresh tokens.');
    }
    this.authService.setTokenCookies(res, tokens);
    return { message: 'Token refreshed.' };
  }

  @UseGuards(JWTAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @Get('google')
  @Redirect()
  googleLogin() {
    return { url: this.authService.getGoogleAuthUrl() };
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    const tokens = await this.authService.handleGoogleCallback(code);
    this.authService.setTokenCookies(res, tokens);

    return res.redirect(
      `${this.configService.get<string>('WEB_URL')}/dashboard`,
    );
  }

  @Get('github')
  @Redirect()
  githubLogin() {
    return { url: this.authService.getGithubAuthUrl() };
  }

  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Res() res: Response) {
    const tokens = await this.authService.handleGithubCallback(code);
    this.authService.setTokenCookies(res, tokens);
    return res.redirect(
      `${this.configService.get<string>('WEB_URL')}/dashboard`,
    );
  }
}
