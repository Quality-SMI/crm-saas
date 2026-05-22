import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export interface AuditRecord {
  user_id: string | null;
  user_email: string | null;
  method: string;
  path: string;
  status_code: number;
  ip: string | null;
  user_agent: string | null;
  meta?: Record<string, unknown> | null;
  duration_ms?: number | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async record(rec: AuditRecord): Promise<void> {
    try {
      await this.repo.insert({
        user_id: rec.user_id,
        user_email: rec.user_email,
        method: rec.method,
        path: rec.path,
        status_code: rec.status_code,
        ip: rec.ip,
        user_agent: rec.user_agent,
        meta: (rec.meta ?? null) as any,
        duration_ms: rec.duration_ms ?? null,
      });
    } catch (err) {
      // Auditoria nunca pode quebrar a request — só loga
      this.logger.error(`audit insert failed: ${(err as Error).message}`);
    }
  }
}
