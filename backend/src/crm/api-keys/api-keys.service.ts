import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ClientApiKey } from './entities/client-api-key.entity';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ClientApiKey)
    private readonly repo: Repository<ClientApiKey>,
  ) {}

  findByClient(clientId: string): Promise<ClientApiKey[]> {
    return this.repo.find({
      where: { client_id: clientId, deleted_at: null as any },
      order: { created_at: 'DESC' },
    });
  }

  async create(clientId: string, dto: CreateApiKeyDto): Promise<ClientApiKey> {
    const key = `qsmi_${crypto.randomBytes(32).toString('hex')}`;
    const apiKey = this.repo.create({
      client_id: clientId,
      name: dto.name,
      key,
    });
    return this.repo.save(apiKey);
  }

  async update(id: string, dto: UpdateApiKeyDto): Promise<ClientApiKey> {
    const apiKey = await this.repo.findOne({ where: { id } });
    if (!apiKey) throw new NotFoundException('API Key não encontrada');
    Object.assign(apiKey, dto);
    return this.repo.save(apiKey);
  }

  async remove(id: string): Promise<void> {
    const apiKey = await this.repo.findOne({ where: { id } });
    if (!apiKey) throw new NotFoundException('API Key não encontrada');
    await this.repo.softDelete(id);
  }

  findByKey(key: string): Promise<ClientApiKey | null> {
    return this.repo.findOne({
      where: { key, is_active: true, deleted_at: null as any },
      relations: { client: true },
    });
  }
}
