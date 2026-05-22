import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async create(
    type: string,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
  ): Promise<Notification> {
    const entity = this.repo.create({
      type,
      title,
      body,
      metadata: metadata ?? null,
    });
    return this.repo.save(entity);
  }

  async list(limit = 50): Promise<Notification[]> {
    return this.repo.find({
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async countUnread(): Promise<number> {
    return this.repo.count({ where: { is_read: false } });
  }

  async markRead(id: string): Promise<void> {
    await this.repo.update(id, { is_read: true });
  }

  async markAllRead(): Promise<void> {
    await this.repo.update({ is_read: false }, { is_read: true });
  }
}
