import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { ProfilesService } from './profiles.service.js';

@Controller('profiles')
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.profiles.list(req.user.id);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.profiles.create(req.user.id, body);
  }

  @Get(':id')
  get(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.profiles.getForOwner(req.user.id, id);
  }

  @Patch(':id')
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.profiles.update(req.user.id, id, body);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.profiles.remove(req.user.id, id);
  }
}
