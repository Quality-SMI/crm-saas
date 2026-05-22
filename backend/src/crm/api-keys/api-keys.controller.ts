import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../iam/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../iam/users/enums/user-role.enum';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { ResponseDto } from '../../common/dto/response.dto';

const MANAGERS = [UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.MANAGER, UserRole.TECHNICAL];

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly svc: ApiKeysService) {}

  @Get('clients/:clientId')
  @Roles(...MANAGERS)
  async list(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return new ResponseDto(await this.svc.findByClient(clientId));
  }

  @Post('clients/:clientId')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...MANAGERS)
  async create(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return new ResponseDto(await this.svc.create(clientId, dto), 'API Key criada');
  }

  @Patch(':id')
  @Roles(...MANAGERS)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return new ResponseDto(await this.svc.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...MANAGERS)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
  }
}
