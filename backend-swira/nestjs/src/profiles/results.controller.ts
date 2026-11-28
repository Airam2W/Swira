import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import { ProfilesService } from './profiles.service.js';
import { ResultsService } from './results.service.js';

@Controller('profiles/:id')
@UseGuards(AuthGuard)
export class ResultsController {
  constructor(private readonly profiles: ProfilesService, private readonly results: ResultsService) {}

  @Get('guides')
  history(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.results.history(req.user.id, id);
  }

  @Post('guides')
  createOrReuse(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.results.createOrReuse(req.user.id, id, this.readSession(req));
  }

  @Patch('health-data')
  async updateHealthData(@Req() req: AuthenticatedRequest, @Param('id') id: string,
    @Body() body: unknown) {
    await this.profiles.updateHealthData(req.user.id, id, body);
    return this.results.createOrReuse(req.user.id, id, this.readSession(req));
  }

  private readSession(req: Request) {
    for (const cookie of (req.headers.cookie ?? '').split(';')) {
      const separator = cookie.indexOf('=');
      if (separator < 0 || cookie.slice(0, separator).trim() !== 'swira_session') continue;
      try { return decodeURIComponent(cookie.slice(separator + 1).trim()); } catch { break; }
    }
    return '';
  }
}
