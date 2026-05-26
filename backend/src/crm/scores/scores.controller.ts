import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ScoresService } from './scores.service';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../iam/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { Permission } from '../../iam/permissions/enums/permission.enum';
import { UserRole } from '../../iam/users/enums/user-role.enum';

const ALL_ROLES = [UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER, UserRole.TECHNICAL, UserRole.SALES, UserRole.WRITER];

@RequirePermission(Permission.SCORES_ACCESS)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scores')
export class ScoresController {
  constructor(private readonly svc: ScoresService) {}

  @Get('overview')
  @Roles(...ALL_ROLES)
  overview() {
    return this.svc.getOverview();
  }

  @Get('clients/:clientId/latest')
  @Roles(...ALL_ROLES)
  latest(@Param('clientId') clientId: string) {
    return this.svc.getLatest(clientId);
  }

  @Get('clients/:clientId/history')
  @Roles(...ALL_ROLES)
  history(@Param('clientId') clientId: string) {
    return this.svc.getHistory(clientId);
  }

  @Post('clients/:clientId/recalculate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER, UserRole.TECHNICAL)
  recalculate(@Param('clientId') clientId: string) {
    return this.svc.calculateScore(clientId);
  }

  @Post('recalculate-all')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  recalculateAll() {
    return this.svc.recalculateAll();
  }
}
