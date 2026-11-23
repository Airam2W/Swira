import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService, PublicUser } from './auth.service.js';

export interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(private readonly auth: AuthService, config: ConfigService) {
    const configured = config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    this.allowedOrigins = new Set(configured.split(',').map((value) => {
      try { return new URL(value.trim()).origin; } catch { return ''; }
    }).filter(Boolean));
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      if (!origin || !this.allowedOrigins.has(this.normalizeOrigin(origin))) {
        throw new UnauthorizedException('Origen no permitido.');
      }
    }
    const token = this.readSession(request.headers.cookie);
    const user = await this.auth.authenticate(token);
    if (!user) throw new UnauthorizedException('Inicia sesión para continuar.');
    request.user = user;
    return true;
  }

  private readSession(header?: string) {
    for (const cookie of (header ?? '').split(';')) {
      const separator = cookie.indexOf('=');
      if (separator < 0 || cookie.slice(0, separator).trim() !== 'swira_session') continue;
      try {
        return decodeURIComponent(cookie.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private normalizeOrigin(origin: string) {
    try { return new URL(origin).origin; } catch { return ''; }
  }
}
