import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../iam/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { ResponseDto } from '../../common/dto/response.dto';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly svc: AppointmentsService) {}

  @Post()
  async create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.svc.create(dto, user.id);
    return new ResponseDto(data, 'Agendamento criado');
  }

  @Get()
  findAll(@Query() query: QueryAppointmentsDto) {
    return this.svc.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.svc.findOne(id);
    return new ResponseDto(data);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    const data = await this.svc.update(id, dto);
    return new ResponseDto(data, 'Agendamento atualizado');
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.remove(id);
    return new ResponseDto(null, 'Agendamento removido');
  }
}
