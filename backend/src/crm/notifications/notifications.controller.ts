import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../iam/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../iam/users/enums/user-role.enum';
import { NotificationsService } from './notifications.service';
import { ResponseDto } from '../../common/dto/response.dto';

const NOTIF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
  UserRole.TECHNICAL,
  UserRole.WRITER,
];

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // ─── List last 50 ─────────────────────────────────────────────────────────

  @Get()
  @Roles(...NOTIF_ROLES)
  async list() {
    return new ResponseDto(await this.notifications.list(50));
  }

  // ─── Unread count ─────────────────────────────────────────────────────────

  @Get('unread-count')
  @Roles(...NOTIF_ROLES)
  async unreadCount() {
    const count = await this.notifications.countUnread();
    return new ResponseDto({ count });
  }

  // ─── Mark one read ────────────────────────────────────────────────────────

  @Patch(':id/read')
  @Roles(...NOTIF_ROLES)
  @HttpCode(HttpStatus.OK)
  async markRead(@Param('id', ParseUUIDPipe) id: string) {
    await this.notifications.markRead(id);
    return new ResponseDto(null, 'Notificação marcada como lida');
  }

  // ─── Mark all read ────────────────────────────────────────────────────────

  @Patch('read-all')
  @Roles(...NOTIF_ROLES)
  @HttpCode(HttpStatus.OK)
  async markAllRead() {
    await this.notifications.markAllRead();
    return new ResponseDto(null, 'Todas as notificações marcadas como lidas');
  }
}
