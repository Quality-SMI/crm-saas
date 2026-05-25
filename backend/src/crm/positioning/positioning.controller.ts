import { Controller, Get, Post, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../iam/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../iam/users/enums/user-role.enum';
import { PositioningService } from './positioning.service';

@ApiTags('positioning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('positioning')
export class PositioningController {
  constructor(private readonly service: PositioningService) {}

  @Get('config/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER, UserRole.TECHNICAL, UserRole.WRITER, UserRole.SALES, UserRole.FINANCIAL)
  async configStatus() {
    return this.service.getConfigStatus();
  }

  @Get('discovery/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER)
  async discoveryStatus() {
    return this.service.getDiscoveryStatus();
  }

  @Post('discovery/run')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  async runDiscovery() {
    return this.service.discoverAndMatchProperties();
  }

  @Post('sync/all')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  async syncAll() {
    this.service.syncAllClients().catch(() => {});
    return { message: 'Sincronização em andamento' };
  }

  @Get(':clientId/snapshots')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER, UserRole.TECHNICAL, UserRole.WRITER, UserRole.SALES, UserRole.FINANCIAL)
  async getSnapshots(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query('days') days?: string,
  ) {
    return this.service.getSnapshots(clientId, days ? Number(days) : 90);
  }

  @Get(':clientId/latest')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER, UserRole.TECHNICAL, UserRole.WRITER, UserRole.SALES, UserRole.FINANCIAL)
  async getLatest(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.service.getLatestSnapshot(clientId);
  }

  @Post(':clientId/sync')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER)
  async syncClient(@Param('clientId', ParseUUIDPipe) clientId: string) {
    await this.service.syncClient(clientId);
    return { message: 'Sincronização concluída' };
  }
}
