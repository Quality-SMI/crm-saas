import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async health() {
    let db = 'down';
    try {
      await this.ds.query('SELECT 1');
      db = 'up';
    } catch {
      db = 'down';
    }
    const ok = db === 'up';
    return {
      status: ok ? 'ok' : 'degraded',
      uptime_s: Math.round(process.uptime()),
      db,
      ts: new Date().toISOString(),
    };
  }
}
