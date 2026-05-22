import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { ClientEmail } from './entities/client-email.entity';
import { ClientPhone } from './entities/client-phone.entity';
import { ClientTag } from './entities/client-tag.entity';
import { ClientService } from './entities/client-service.entity';
import { Tag } from '../lookup/entities/tag.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { PaginatedResponseDto } from '../../common/dto/response.dto';
import { UserRole } from '../../iam/users/enums/user-role.enum';
import { ApiKeysService } from '../api-keys/api-keys.service';

interface RequestUser { id: string; role: UserRole }

const PLAN_IDS = {
  SILVER:    'e9978d91-ec42-44e5-9afa-7a298d872c25',
  GOLD:      '6f4144d8-55b4-486b-a7c9-c4c1a0974010',
  DIAMOND:   'f3934adb-2208-46d9-803d-eff4dddad95b',
  PARCEIROS: '39d3e744-88bb-4c99-8144-4b3c040c99ee',
} as const;

function resolvePlan(
  monthly_value: number | null | undefined,
  requestedPlanId: string | null | undefined,
  currentPlanId: string | null | undefined,
): string | undefined {
  const effectivePlan = requestedPlanId !== undefined ? requestedPlanId : currentPlanId;
  if (effectivePlan === PLAN_IDS.PARCEIROS) return undefined;
  if (monthly_value == null) return undefined;
  const v = Number(monthly_value);
  if (v <= 2000) return PLAN_IDS.SILVER;
  if (v <= 3000) return PLAN_IDS.GOLD;
  return PLAN_IDS.DIAMOND;
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(ClientEmail)
    private readonly emailRepo: Repository<ClientEmail>,
    @InjectRepository(ClientPhone)
    private readonly phoneRepo: Repository<ClientPhone>,
    @InjectRepository(ClientTag)
    private readonly clientTagRepo: Repository<ClientTag>,
    @InjectRepository(ClientService)
    private readonly clientServiceRepo: Repository<ClientService>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
    private readonly dataSource: DataSource,
    private readonly apiKeysSvc: ApiKeysService,
  ) {}

  async findAll(query: QueryClientsDto, user?: RequestUser): Promise<PaginatedResponseDto<Client>> {
    const qb = this.clientRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.segment', 'segment')
      .leftJoinAndSelect('c.seller', 'seller')
      .leftJoinAndSelect('c.service_type', 'service_type')
      .leftJoinAndSelect('c.emails', 'emails')
      .leftJoinAndSelect('c.phones', 'phones')
      .where('c.deleted_at IS NULL')
      .orderBy('c.company_name', 'ASC')
      .skip(query.skip)
      .take(query.limit);

    // SALES só vê clientes onde é o vendedor responsável
    if (user?.role === UserRole.SALES) {
      qb.andWhere('c.seller_id = :uid', { uid: user.id });
    }

    if (query.search) {
      qb.andWhere(
        '(c.company_name ILIKE :search OR c.domain ILIKE :search OR c.contact_name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    if (query.seller_id) {
      qb.andWhere('c.seller_id = :seller_id', { seller_id: query.seller_id });
    }

    if (query.segment_id) {
      qb.andWhere('c.segment_id = :segment_id', { segment_id: query.segment_id });
    }

    if (query.service_type_id) {
      qb.andWhere('c.service_type_id = :service_type_id', {
        service_type_id: query.service_type_id,
      });
    }

    if (query.company_size_id) {
      qb.andWhere('c.company_size_id = :company_size_id', {
        company_size_id: query.company_size_id,
      });
    }

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findOne(id: string, user?: RequestUser): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: {
        segment: true,
        market_segment: true,
        business_model: true,
        company_size: true,
        seller: true,
        technical: true,
        writer: true,
        service_type: true,
        service_subtype: true,
        hosting_type: true,
        emails: true,
        phones: true,
        tags: { tag: true },
        services: { service_type: true },
      },
    });

    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (user?.role === UserRole.SALES && client.seller_id !== user.id) {
      throw new ForbiddenException('Acesso negado a este cliente');
    }
    return client;
  }

  async create(dto: CreateClientDto, userId: string): Promise<Client> {
    const savedId = await this.dataSource.transaction(async (manager) => {
      const domainExists = await manager.findOne(Client, {
        where: { domain: dto.domain, deleted_at: IsNull() },
      });
      if (domainExists) {
        throw new BadRequestException('Já existe um cliente com este domínio');
      }

      const { emails, phones, monthly_value, tag_ids, services, ...fields } = dto;
      const autoPlan = resolvePlan(monthly_value, fields.company_size_id, undefined);
      const client = manager.create(Client, {
        ...fields,
        ...(autoPlan && { company_size_id: autoPlan }),
        monthly_value: monthly_value != null ? String(monthly_value) : null,
        created_by: userId,
        emails: [],
        phones: [],
        tags: [],
        services: [],
      });

      const saved = await manager.save(client);

      if (emails?.length) {
        await manager.save(
          emails.map((e) => manager.create(ClientEmail, { ...e, client_id: saved.id })),
        );
      }

      if (phones?.length) {
        await manager.save(
          phones.map((p) => manager.create(ClientPhone, { ...p, client_id: saved.id })),
        );
      }

      if (tag_ids?.length) {
        await manager.save(
          tag_ids.map((tid) => manager.create(ClientTag, { client_id: saved.id, tag_id: tid })),
        );
      }

      if (services?.length) {
        await manager.save(
          services.map((s) =>
            manager.create(ClientService, {
              ...s,
              client_id: saved.id,
              management_fee: s.management_fee != null ? String(s.management_fee) : null,
              media_budget: s.media_budget != null ? String(s.media_budget) : null,
              monthly_value: s.monthly_value != null ? String(s.monthly_value) : null,
              one_time_value: s.one_time_value != null ? String(s.one_time_value) : null,
            }),
          ),
        );
      }

      return saved.id;
    });

    await this.apiKeysSvc.create(savedId, { name: 'Padrão' }).catch(() => {});

    return this.findOne(savedId);
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);

    return this.dataSource.transaction(async (manager) => {
      const { emails, phones, monthly_value, tag_ids, services, ...rest } = dto;
      const autoPlan = monthly_value !== undefined
        ? resolvePlan(monthly_value, rest.company_size_id, client.company_size_id)
        : undefined;
      const fields = {
        ...rest,
        ...(autoPlan && { company_size_id: autoPlan }),
        ...(monthly_value != null && { monthly_value: String(monthly_value) }),
      };

      await manager.update(Client, id, fields);

      if (emails !== undefined) {
        await manager.delete(ClientEmail, { client_id: id });
        if (emails.length) {
          const newEmails = emails.map((e) =>
            manager.create(ClientEmail, { ...e, client_id: id }),
          );
          await manager.save(newEmails);
        }
      }

      if (phones !== undefined) {
        await manager.delete(ClientPhone, { client_id: id });
        if (phones.length) {
          const newPhones = phones.map((p) =>
            manager.create(ClientPhone, { ...p, client_id: id }),
          );
          await manager.save(newPhones);
        }
      }

      if (tag_ids !== undefined) {
        await manager.delete(ClientTag, { client_id: id });
        if (tag_ids.length) {
          const newTags = tag_ids.map((tid) =>
            manager.create(ClientTag, { client_id: id, tag_id: tid }),
          );
          await manager.save(newTags);
        }
      }

      if (services !== undefined) {
        await manager.delete(ClientService, { client_id: id });
        if (services.length) {
          const newSvcs = services.map((s) =>
            manager.create(ClientService, {
              ...s,
              client_id: id,
              management_fee: s.management_fee != null ? String(s.management_fee) : null,
              media_budget: s.media_budget != null ? String(s.media_budget) : null,
              monthly_value: s.monthly_value != null ? String(s.monthly_value) : null,
              one_time_value: s.one_time_value != null ? String(s.one_time_value) : null,
            }),
          );
          await manager.save(newSvcs);
        }
      }

      return this.findOne(client.id);
    });
  }

  async dashboardStats(): Promise<{
    activeClients: number;
    openLeads: number;
    mrr: number;
    newClientsThisMonth: number;
  }> {
    const [activeClients, openLeads, mrr, newClientsThisMonth] = await Promise.all([
      this.dataSource.query<[{ count: string }]>(
        `SELECT COUNT(*) FROM crm.clients WHERE deleted_at IS NULL AND status IN ('ACTIVE','PAYING','RENEWED')`,
      ),
      this.dataSource.query<[{ count: string }]>(
        `SELECT COUNT(*) FROM crm.leads WHERE deleted_at IS NULL AND stage NOT IN ('WON','LOST')`,
      ),
      this.dataSource.query<[{ sum: string }]>(
        `SELECT COALESCE(SUM(monthly_value::numeric),0) AS sum FROM crm.clients WHERE deleted_at IS NULL AND status IN ('ACTIVE','PAYING','RENEWED')`,
      ),
      this.dataSource.query<[{ count: string }]>(
        `SELECT COUNT(*) FROM crm.clients WHERE deleted_at IS NULL AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`,
      ),
    ]);

    return {
      activeClients: Number(activeClients[0].count),
      openLeads: Number(openLeads[0].count),
      mrr: Number(mrr[0].sum),
      newClientsThisMonth: Number(newClientsThisMonth[0].count),
    };
  }

  async countByPlan(): Promise<{ company_size_id: string | null; count: number }[]> {
    const rows = await this.clientRepo
      .createQueryBuilder('c')
      .select('c.company_size_id', 'company_size_id')
      .addSelect('COUNT(*)', 'count')
      .where('c.deleted_at IS NULL')
      .groupBy('c.company_size_id')
      .getRawMany<{ company_size_id: string | null; count: string }>();

    return rows.map((r) => ({ company_size_id: r.company_size_id, count: Number(r.count) }));
  }

  async updateKeywords(id: string, keywords: string[]): Promise<void> {
    await this.dataSource.query(
      `UPDATE crm.clients SET contracted_keywords = $1::text[] WHERE id = $2`,
      [keywords, id],
    );
  }

  async remove(id: string): Promise<void> {
    const client = await this.findOne(id);
    await this.clientRepo.softDelete(client.id);
  }
}
