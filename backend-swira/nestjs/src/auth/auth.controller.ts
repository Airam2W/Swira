import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';

const COOKIE_NAME = 'swira_session';

@Controller('auth')
export class AuthController {
  private readonly allowedOrigins: Set<string>;
  private readonly production: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.production = config.get<string>('NODE_ENV') === 'Production';
    const configured = config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    this.allowedOrigins = new Set(
      configured.split(',').map((origin) => this.normalizeOrigin(origin)).filter(Boolean),
    );
  }

  @Post('register')
  async register(@Body() body: { name?: string; email?: string; password?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertOrigin(req);
    const session = await this.auth.register(body);
    this.setCookie(res, session.token);
    return { user: session.user };
  }

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertOrigin(req);
    const session = await this.auth.login(body);
    this.setCookie(res, session.token);
    return { user: session.user };
  }

  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertOrigin(req);
    this.clearCookie(res);
    return { success: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const user = await this.auth.authenticate(this.readCookie(req, COOKIE_NAME));
    if (!user) throw new UnauthorizedException('La sesión no está activa.');
    return { user };
  }

  private setCookie(res: Response, token: string) {
    const secure = this.production ? '; Secure; SameSite=None' : '; SameSite=Lax';
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${this.auth.tokenLifetimeSeconds}${secure}`,
    );
    res.setHeader('Cache-Control', 'no-store');
  }

  private clearCookie(res: Response) {
    const secure = this.production ? '; Secure; SameSite=None' : '; SameSite=Lax';
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0${secure}`);
    res.setHeader('Cache-Control', 'no-store');
  }

  private assertOrigin(req: Request) {
    const origin = req.headers.origin;
    if (!origin || !this.allowedOrigins.has(this.normalizeOrigin(origin))) {
      throw new UnauthorizedException('Origen no permitido.');
    }
  }

  private readCookie(req: Request, name: string) {
    const cookieHeader = req.headers.cookie ?? '';
    for (const cookie of cookieHeader.split(';')) {
      const separator = cookie.indexOf('=');
      if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
      try {
        return decodeURIComponent(cookie.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private normalizeOrigin(origin: string) {
    try {
      return new URL(origin.trim()).origin;
    } catch {
      return '';
    }
  }
}
