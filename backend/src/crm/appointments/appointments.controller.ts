import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../iam/auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../iam/users/enums/user-role.enum';
import { Permission } from '../../iam/permissions/enums/permission.enum';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
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

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission(Permission.AGENDA_ACCESS)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly svc: AppointmentsService) {}

  @Post()
  @Roles(...ALL_INTERNAL)
  async create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: any) {
    const data = await this.svc.create(dto, user.id);
    return new ResponseDto(data, 'Agendamento criado');
  }

  @Get()
  @Roles(...ALL_INTERNAL)
  findAll(@Query() query: QueryAppointmentsDto) {
    return this.svc.findAll(query);
  }

  @Get(':id')
  @Roles(...ALL_INTERNAL)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.svc.findOne(id);
    return new ResponseDto(data);
  }

  @Patch(':id')
  @Roles(...ALL_INTERNAL)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    const data = await this.svc.update(id, dto);
    return new ResponseDto(data, 'Agendamento atualizado');
  }

  @Delete(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTOR,
    UserRole.MANAGER,
    UserRole.SALES,
  )
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
    return new ResponseDto(null, 'Agendamento removido');
  }
}
