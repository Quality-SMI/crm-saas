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
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { AddInteractionDto } from './dto/add-interaction.dto';
import { ResponseDto } from '../../common/dto/response.dto';

const ALL_INTERNAL = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.MANAGER,
  UserRole.FINANCIAL,
  UserRole.TECHNICAL,
  UserRole.WRITER,
  UserRole.SALES,
];

@ApiTags('leads')
@RequirePermission(Permission.LEADS_ACCESS)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @Roles(...ALL_INTERNAL)
  async findAll(@Query() query: QueryLeadsDto, @CurrentUser() user: any) {
    return this.leadsService.findAll(query, user);
  }

  @Get('stats/by-stage')
  @Roles(...ALL_INTERNAL)
  async countByStage(@CurrentUser() user: any) {
    const data = await this.leadsService.countByStage(user);
    return new ResponseDto(data);
  }

  @Get(':id')
  @Roles(...ALL_INTERNAL)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const data = await this.leadsService.findOne(id, user);
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
  async create(@Body() dto: CreateLeadDto, @CurrentUser() user: any) {
    const data = await this.leadsService.create(dto, user.id);
    return new ResponseDto(data, 'Lead criado com sucesso');
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
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.leadsService.update(id, dto, user.id, user);
    return new ResponseDto(data, 'Lead atualizado com sucesso');
  }

  @Post(':id/interactions')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...ALL_INTERNAL)
  async addInteraction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddInteractionDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.leadsService.addInteraction(id, dto, user.id, user);
    return new ResponseDto(data, 'Interação registrada');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRECTOR)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.leadsService.remove(id);
  }
}
