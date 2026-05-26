import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../iam/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { Permission } from '../../iam/permissions/enums/permission.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../iam/users/enums/user-role.enum';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { ResponseDto } from '../../common/dto/response.dto';

@ApiTags('clients')
@RequirePermission(Permission.CLIENTS_ACCESS)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.MANAGER,
    UserRole.FINANCIAL,
    UserRole.TECHNICAL,
    UserRole.WRITER,
    UserRole.SALES,
  )
  async findAll(@Query() query: QueryClientsDto, @CurrentUser() user: any) {
    return this.clientsService.findAll(query, user);
  }

  @Get('dashboard/stats')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.MANAGER,
    UserRole.FINANCIAL,
    UserRole.TECHNICAL,
    UserRole.WRITER,
    UserRole.SALES,
  )
  async dashboardStats() {
    return this.clientsService.dashboardStats();
  }

  @Get('counts/by-plan')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.MANAGER,
    UserRole.FINANCIAL,
    UserRole.TECHNICAL,
    UserRole.WRITER,
    UserRole.SALES,
  )
  async countByPlan() {
    return this.clientsService.countByPlan();
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.MANAGER,
    UserRole.FINANCIAL,
    UserRole.TECHNICAL,
    UserRole.WRITER,
    UserRole.SALES,
  )
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const data = await this.clientsService.findOne(id, user);
    return new ResponseDto(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.MANAGER,
    UserRole.SALES,
  )
  async create(@Body() dto: CreateClientDto, @CurrentUser() user: any) {
    const data = await this.clientsService.create(dto, user.id);
    return new ResponseDto(data, 'Cliente criado com sucesso');
  }

  @Patch(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.MANAGER,
    UserRole.SALES,
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
  ) {
    const data = await this.clientsService.update(id, dto);
    return new ResponseDto(data, 'Cliente atualizado com sucesso');
  }

  @Patch(':id/keywords')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.MANAGER,
    UserRole.SALES,
    UserRole.TECHNICAL,
    UserRole.WRITER,
  )
  async updateKeywords(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('keywords') keywords: string[],
  ) {
    await this.clientsService.updateKeywords(id, keywords ?? []);
    return new ResponseDto(null, 'Palavras-chave atualizadas');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.clientsService.remove(id);
  }
}
