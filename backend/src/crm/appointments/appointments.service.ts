import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadAppointment } from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import {
  PaginatedResponseDto,
  ResponseDto,
} from '../../common/dto/response.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(LeadAppointment)
    private readonly repo: Repository<LeadAppointment>,
  ) {}

  async create(
    dto: CreateAppointmentDto,
    userId: string,
  ): Promise<LeadAppointment> {
    const appointment = this.repo.create({
      lead_id: dto.lead_id,
      scheduled_at: new Date(dto.scheduled_at),
      assigned_to_id: dto.assigned_to_id ?? null,
      scheduled_by_id: userId,
      duration_minutes: dto.duration_minutes ?? 60,
      notes: dto.notes ?? null,
    });
    const saved = await this.repo.save(appointment);
    return this.findOne(saved.id);
  }

  async findAll(
    query: QueryAppointmentsDto,
  ): Promise<PaginatedResponseDto<LeadAppointment>> {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.lead', 'lead')
      .leftJoinAndSelect('a.scheduled_by', 'scheduled_by')
      .leftJoinAndSelect('a.assigned_to', 'assigned_to')
      .orderBy('a.scheduled_at', 'ASC')
      .skip(query.skip)
      .take(query.limit);

    if (query.assigned_to_id) {
      qb.andWhere('a.assigned_to_id = :uid', { uid: query.assigned_to_id });
    }

    if (query.lead_id) {
      qb.andWhere('a.lead_id = :lid', { lid: query.lead_id });
    }

    if (query.status) {
      qb.andWhere('a.status = :status', { status: query.status });
    }

    if (query.date_from) {
      qb.andWhere('a.scheduled_at >= :from', { from: query.date_from });
    }

    if (query.date_to) {
      qb.andWhere('a.scheduled_at <= :to', { to: query.date_to });
    }

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<LeadAppointment> {
    const a = await this.repo.findOne({
      where: { id },
      relations: { lead: true, scheduled_by: true, assigned_to: true },
    });
    if (!a) throw new NotFoundException('Agendamento não encontrado');
    return a;
  }

  async update(
    id: string,
    dto: UpdateAppointmentDto,
  ): Promise<LeadAppointment> {
    await this.findOne(id);
    const fields: Partial<LeadAppointment> = {};
    if (dto.scheduled_at !== undefined)
      fields.scheduled_at = new Date(dto.scheduled_at);
    if (dto.assigned_to_id !== undefined)
      fields.assigned_to_id = dto.assigned_to_id;
    if (dto.status !== undefined) fields.status = dto.status;
    if (dto.duration_minutes !== undefined)
      fields.duration_minutes = dto.duration_minutes;
    if (dto.notes !== undefined) fields.notes = dto.notes;
    await this.repo.update(id, fields);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
