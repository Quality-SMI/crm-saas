import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { LeadInteraction } from './entities/lead-interaction.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { AddInteractionDto } from './dto/add-interaction.dto';
import { PaginatedResponseDto } from '../../common/dto/response.dto';
import { LeadStage } from './enums/lead-stage.enum';
import { InteractionType } from './enums/interaction-type.enum';
import { UserRole } from '../../iam/users/enums/user-role.enum';

interface RequestUser { id: string; role: UserRole }

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(LeadInteraction)
    private readonly interactionRepo: Repository<LeadInteraction>,
  ) {}

  async findAll(query: QueryLeadsDto, user: RequestUser): Promise<PaginatedResponseDto<Lead>> {
    const qb = this.leadRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.owner', 'owner')
      .where('l.deleted_at IS NULL')
      .orderBy('l.created_at', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    if (query.owner_id) {
      qb.andWhere('l.owner_id = :owner_id', { owner_id: query.owner_id });
    }

    if (query.search) {
      qb.andWhere(
        '(l.name ILIKE :s OR l.contact_name ILIKE :s OR l.contact_email ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    if (query.stage) {
      qb.andWhere('l.stage = :stage', { stage: query.stage });
    }

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findOne(id: string, user?: RequestUser): Promise<Lead> {
    const lead = await this.leadRepo.findOne({
      where: { id },
      relations: { owner: true, interactions: { user: true } },
      order: { interactions: { created_at: 'DESC' } },
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    return lead;
  }

  async create(dto: CreateLeadDto, userId: string): Promise<Lead> {
    const { estimated_value, ...fields } = dto;
    const lead = this.leadRepo.create({
      ...fields,
      estimated_value: estimated_value != null ? String(estimated_value) : null,
      created_by: userId,
    });
    const saved = await this.leadRepo.save(lead);

    await this.interactionRepo.save(
      this.interactionRepo.create({
        lead_id: saved.id,
        user_id: userId,
        type: InteractionType.NOTE,
        description: 'Lead criado',
      }),
    );

    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateLeadDto, userId: string, user?: RequestUser): Promise<Lead> {
    const lead = await this.findOne(id, user);
    const { estimated_value, stage, ...rest } = dto;

    const fields: Partial<Lead> = {
      ...rest,
      ...(estimated_value != null && { estimated_value: String(estimated_value) }),
      ...(stage !== undefined && { stage }),
    };

    await this.leadRepo.update(id, fields);

    if (stage !== undefined && stage !== lead.stage) {
      await this.interactionRepo.save(
        this.interactionRepo.create({
          lead_id: id,
          user_id: userId,
          type: InteractionType.STATUS_CHANGE,
          description: `Etapa alterada de ${lead.stage} para ${stage}`,
        }),
      );
    }

    return this.findOne(id);
  }

  async addInteraction(
    leadId: string,
    dto: AddInteractionDto,
    userId: string,
    user?: RequestUser,
  ): Promise<LeadInteraction> {
    await this.findOne(leadId, user);
    const interaction = this.interactionRepo.create({
      lead_id: leadId,
      user_id: userId,
      type: dto.type ?? InteractionType.NOTE,
      description: dto.description,
    });
    return this.interactionRepo.save(interaction);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.leadRepo.softDelete(id);
  }

  async countByStage(user?: RequestUser): Promise<Record<LeadStage, number>> {
    const qb = this.leadRepo
      .createQueryBuilder('l')
      .select('l.stage', 'stage')
      .addSelect('COUNT(*)', 'count')
      .where('l.deleted_at IS NULL')
      .groupBy('l.stage');

    const rows = await qb.getRawMany<{ stage: LeadStage; count: string }>();

    const result = Object.values(LeadStage).reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {} as Record<LeadStage, number>,
    );

    rows.forEach((r) => {
      result[r.stage] = Number(r.count);
    });

    return result;
  }
}
