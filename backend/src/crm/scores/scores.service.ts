import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ClientScore } from './entities/client-score.entity';
import { GscSnapshot } from '../positioning/entities/gsc-snapshot.entity';
import { Client } from '../clients/entities/client.entity';

@Injectable()
export class ScoresService {
  private readonly logger = new Logger(ScoresService.name);

  constructor(
    @InjectRepository(ClientScore)
    private readonly scoreRepo: Repository<ClientScore>,
    @InjectRepository(GscSnapshot)
    private readonly snapshotRepo: Repository<GscSnapshot>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  @Cron('0 2 */3 * *')
  async scheduledRecalculation() {
    this.logger.log('Iniciando recálculo de scores de clientes...');
    const result = await this.recalculateAll();
    this.logger.log(`Scores recalculados: ${result.calculated} clientes, ${result.skipped} sem dados GSC`);
  }

  async recalculateAll(): Promise<{ calculated: number; skipped: number }> {
    // Include all non-deleted clients that have GSC data
    const clients = await this.clientRepo.query(`
      SELECT DISTINCT c.id FROM crm.clients c
      INNER JOIN crm.gsc_snapshots s ON s.client_id = c.id
      WHERE c.deleted_at IS NULL
    `);
    let calculated = 0;
    let skipped = 0;
    for (const client of clients) {
      try {
        await this.calculateScore(client.id);
        calculated++;
      } catch {
        skipped++;
      }
    }
    return { calculated, skipped };
  }

  async calculateScore(clientId: string): Promise<ClientScore> {
    // Take the 2 most recent snapshots — each is already a full-period aggregate
    const snapshots = await this.snapshotRepo.find({
      where: { client_id: clientId },
      order: { date: 'DESC' },
      take: 2,
    });

    if (snapshots.length === 0) {
      throw new NotFoundException('Sem dados do Google Search Console para este cliente.');
    }

    const latest = snapshots[0];
    const previous = snapshots[1] ?? null;

    const currImpressions = Number(latest.total_impressions) || 0;
    const prevImpressions = Number(previous?.total_impressions) || 0;
    const currClicks = Number(latest.total_clicks) || 0;
    const prevClicks = Number(previous?.total_clicks) || 0;

    const scoreAccess = previous
      ? this.calcTrendScore(currImpressions, prevImpressions, 25)
      : this.calcAbsoluteScore(currImpressions, [500, 2000, 10000, 30000, 80000], 25);

    const scoreClicks = previous
      ? this.calcTrendScore(currClicks, prevClicks, 25)
      : this.calcAbsoluteScore(currClicks, [50, 200, 1000, 3000, 8000], 25);

    const scorePositioning = this.calcPositionScore(
      latest.avg_position != null ? Number(latest.avg_position) : null,
    );
    const scoreIndexation = this.calcIndexationScore(latest.pages?.length ?? 0);

    const score = Math.min(100, scoreAccess + scoreClicks + scorePositioning + scoreIndexation);

    const entry = this.scoreRepo.create({
      client_id: clientId,
      score: parseFloat(score.toFixed(2)),
      score_access: parseFloat(scoreAccess.toFixed(2)),
      score_clicks: parseFloat(scoreClicks.toFixed(2)),
      score_positioning: parseFloat(scorePositioning.toFixed(2)),
      score_indexation: parseFloat(scoreIndexation.toFixed(2)),
      metadata: {
        currentImpressions: currImpressions,
        prevImpressions,
        currentClicks: currClicks,
        prevClicks,
        latestSnapshotDate: latest.date,
        pagesCount: latest.pages?.length ?? 0,
        avgPosition: latest.avg_position ?? null,
        hasPrevious: !!previous,
      },
      calculated_at: new Date(),
    });

    return this.scoreRepo.save(entry);
  }

  async getLatest(clientId: string): Promise<ClientScore | null> {
    return this.scoreRepo.findOne({
      where: { client_id: clientId },
      order: { calculated_at: 'DESC' },
    });
  }

  async getHistory(clientId: string, limit = 10): Promise<ClientScore[]> {
    return this.scoreRepo.find({
      where: { client_id: clientId },
      order: { calculated_at: 'DESC' },
      take: limit,
    });
  }

  async getOverview(): Promise<Array<{ client_id: string; score: number; calculated_at: Date }>> {
    return this.scoreRepo.query(`
      SELECT DISTINCT ON (client_id) client_id, score, calculated_at
      FROM crm.client_scores
      ORDER BY client_id, calculated_at DESC
    `);
  }

  private calcTrendScore(current: number, prev: number, max: number): number {
    if (prev === 0 && current === 0) return 0;
    if (prev === 0) return this.calcAbsoluteScore(current, [500, 2000, 10000, 30000, 80000], max);
    const growth = (current - prev) / prev;
    if (growth >= 0.2) return max;
    if (growth <= -1) return 0;
    if (growth >= 0) return max * 0.5 + (growth / 0.2) * (max * 0.5);
    return max * 0.5 * (1 + growth);
  }

  // Score based on absolute value against thresholds (5 levels → 5 equal steps)
  private calcAbsoluteScore(value: number, thresholds: number[], max: number): number {
    if (value <= 0) return 0;
    const step = max / thresholds.length;
    for (let i = 0; i < thresholds.length; i++) {
      if (value < thresholds[i]) return parseFloat((step * i || step * 0.5).toFixed(2));
    }
    return max;
  }

  private calcPositionScore(position: number | null): number {
    if (!position) return 0;
    if (position <= 3) return 25;
    if (position <= 5) return 22;
    if (position <= 10) return 18;
    if (position <= 20) return 13;
    if (position <= 50) return 8;
    return 4;
  }

  private calcIndexationScore(pageCount: number): number {
    if (pageCount === 0) return 0;
    if (pageCount <= 5) return 8;
    if (pageCount <= 20) return 12;
    if (pageCount <= 50) return 17;
    if (pageCount <= 100) return 22;
    return 25;
  }
}
