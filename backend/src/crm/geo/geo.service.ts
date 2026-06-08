import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AiPlatform } from './entities/ai-platform.entity';
import { AiQuery } from './entities/ai-query.entity';
import { AiMention } from './entities/ai-mention.entity';
import { AiVisibilityScore } from './entities/ai-visibility-score.entity';
import { AiSource } from './entities/ai-source.entity';
import { AiCompetitor } from './entities/ai-competitor.entity';
import { AiCompetitorRanking } from './entities/ai-competitor-ranking.entity';
import { CreateQueryDto, UpdateQueryDto } from './dto/create-query.dto';
import { CreateMentionDto } from './dto/create-mention.dto';
import {
  CreateCompetitorDto,
  UpdateCompetitorDto,
} from './dto/create-competitor.dto';
import { CreateVisibilityScoreDto } from './dto/create-visibility-score.dto';

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(AiPlatform)
    private readonly platformRepo: Repository<AiPlatform>,
    @InjectRepository(AiQuery)
    private readonly queryRepo: Repository<AiQuery>,
    @InjectRepository(AiMention)
    private readonly mentionRepo: Repository<AiMention>,
    @InjectRepository(AiVisibilityScore)
    private readonly scoreRepo: Repository<AiVisibilityScore>,
    @InjectRepository(AiSource)
    private readonly sourceRepo: Repository<AiSource>,
    @InjectRepository(AiCompetitor)
    private readonly competitorRepo: Repository<AiCompetitor>,
    @InjectRepository(AiCompetitorRanking)
    private readonly rankingRepo: Repository<AiCompetitorRanking>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Platforms ────────────────────────────────────────────────────────────

  async listPlatforms(): Promise<AiPlatform[]> {
    return this.platformRepo.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
  }

  // ─── Overview ─────────────────────────────────────────────────────────────

  async getOverview(clientId: string) {
    const [mentionCount, queries, sources, competitors] = await Promise.all([
      this.mentionRepo.count({ where: { client_id: clientId } }),
      this.queryRepo.count({ where: { client_id: clientId, is_active: true } }),
      this.sourceRepo.count({ where: { client_id: clientId } }),
      this.competitorRepo.count({
        where: { client_id: clientId, is_active: true },
      }),
    ]);

    const latestScore = await this.scoreRepo.findOne({
      where: { client_id: clientId },
      order: { score_date: 'DESC', created_at: 'DESC' },
    });

    // Sentiment breakdown
    const sentimentRaw = await this.dataSource.query<
      { sentiment: string; cnt: string }[]
    >(
      `
      SELECT sentiment, COUNT(*) AS cnt
      FROM crm.ai_mentions
      WHERE client_id = $1 AND sentiment IS NOT NULL
      GROUP BY sentiment
    `,
      [clientId],
    );

    const sentiment = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    sentimentRaw.forEach((r) => {
      if (r.sentiment in sentiment)
        sentiment[r.sentiment as keyof typeof sentiment] = Number(r.cnt);
    });

    // Platform breakdown (last 30 days)
    const platformRaw = await this.dataSource.query<
      { name: string; cnt: string }[]
    >(
      `
      SELECT p.name, COUNT(*) AS cnt
      FROM crm.ai_mentions m
      JOIN crm.ai_platforms p ON p.id = m.platform_id
      WHERE m.client_id = $1
        AND m.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY p.name
      ORDER BY cnt DESC
    `,
      [clientId],
    );

    return {
      visibility_score: latestScore?.visibility_score
        ? Number(latestScore.visibility_score)
        : null,
      geo_score: latestScore?.geo_score ? Number(latestScore.geo_score) : null,
      mention_count: mentionCount,
      active_queries: queries,
      source_count: sources,
      competitor_count: competitors,
      sentiment,
      platforms: platformRaw.map((r) => ({
        name: r.name,
        count: Number(r.cnt),
      })),
      last_updated: latestScore?.created_at ?? null,
    };
  }

  // ─── Queries / Prompts ────────────────────────────────────────────────────

  async listQueries(clientId: string): Promise<(AiQuery & { mention_count: number })[]> {
    const queries = await this.queryRepo.find({
      where: { client_id: clientId },
      order: { created_at: 'DESC' },
    });
    if (queries.length === 0) return [];
    const counts = await this.dataSource.query<{ query_id: string; cnt: string }[]>(
      `SELECT query_id, COUNT(*) AS cnt FROM crm.ai_mentions WHERE query_id = ANY($1) GROUP BY query_id`,
      [queries.map((q) => q.id)],
    );
    const countMap = new Map(counts.map((r) => [r.query_id, Number(r.cnt)]));
    return queries.map((q) => Object.assign(q, { mention_count: countMap.get(q.id) ?? 0 }));
  }

  async createQuery(
    clientId: string,
    dto: CreateQueryDto,
    userId: string,
  ): Promise<AiQuery> {
    const entity = this.queryRepo.create({
      ...dto,
      client_id: clientId,
      created_by: userId,
    });
    return this.queryRepo.save(entity);
  }

  async updateQuery(
    clientId: string,
    queryId: string,
    dto: UpdateQueryDto,
  ): Promise<AiQuery> {
    const q = await this.queryRepo.findOne({
      where: { id: queryId, client_id: clientId },
    });
    if (!q) throw new NotFoundException('Query não encontrada');
    await this.queryRepo.update(queryId, dto);
    return this.queryRepo.findOneOrFail({ where: { id: queryId } });
  }

  async deleteQuery(clientId: string, queryId: string): Promise<void> {
    const q = await this.queryRepo.findOne({
      where: { id: queryId, client_id: clientId },
    });
    if (!q) throw new NotFoundException('Query não encontrada');
    await this.queryRepo.delete(queryId);
  }

  // ─── Mentions ─────────────────────────────────────────────────────────────

  async listMentions(
    clientId: string,
    opts: {
      platform_id?: string;
      sentiment?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const qb = this.mentionRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.platform', 'platform')
      .leftJoinAndSelect('m.query', 'query')
      .where('m.client_id = :clientId', { clientId })
      .orderBy('m.checked_at', 'DESC')
      .take(opts.limit ?? 50)
      .skip(opts.offset ?? 0);

    if (opts.platform_id)
      qb.andWhere('m.platform_id = :pid', { pid: opts.platform_id });
    if (opts.sentiment) qb.andWhere('m.sentiment = :s', { s: opts.sentiment });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async createMention(
    clientId: string,
    dto: CreateMentionDto,
    userId: string,
  ): Promise<AiMention> {
    const entity = this.mentionRepo.create({
      ...dto,
      client_id: clientId,
      created_by: userId,
      sentiment_score:
        dto.sentiment_score != null ? String(dto.sentiment_score) : null,
      visibility_impact:
        dto.visibility_impact != null ? String(dto.visibility_impact) : null,
    });
    const saved = await this.mentionRepo.save(entity);
    return this.mentionRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { platform: true, query: true },
    });
  }

  async deleteMention(clientId: string, mentionId: string): Promise<void> {
    const m = await this.mentionRepo.findOne({
      where: { id: mentionId, client_id: clientId },
    });
    if (!m) throw new NotFoundException('Menção não encontrada');
    await this.mentionRepo.delete(mentionId);
  }

  // ─── Sources ──────────────────────────────────────────────────────────────

  async listSources(clientId: string): Promise<AiSource[]> {
    return this.sourceRepo.find({
      where: { client_id: clientId },
      order: { citation_count: 'DESC' },
    });
  }

  async upsertSource(
    clientId: string,
    domain: string,
    citationDelta = 1,
  ): Promise<AiSource> {
    await this.dataSource.query(
      `
      INSERT INTO crm.ai_sources (client_id, domain, citation_count, last_seen_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (client_id, domain)
      DO UPDATE SET
        citation_count = crm.ai_sources.citation_count + $3,
        last_seen_at   = NOW()
    `,
      [clientId, domain, citationDelta],
    );

    return this.sourceRepo.findOneOrFail({
      where: { client_id: clientId, domain },
    });
  }

  // ─── Competitors ──────────────────────────────────────────────────────────

  async listCompetitors(clientId: string): Promise<AiCompetitor[]> {
    return this.competitorRepo.find({
      where: { client_id: clientId },
      order: { competitor_name: 'ASC' },
    });
  }

  async createCompetitor(
    clientId: string,
    dto: CreateCompetitorDto,
  ): Promise<AiCompetitor> {
    const entity = this.competitorRepo.create({ ...dto, client_id: clientId });
    return this.competitorRepo.save(entity);
  }

  async updateCompetitor(
    clientId: string,
    cId: string,
    dto: UpdateCompetitorDto,
  ): Promise<AiCompetitor> {
    const c = await this.competitorRepo.findOne({
      where: { id: cId, client_id: clientId },
    });
    if (!c) throw new NotFoundException('Concorrente não encontrado');
    await this.competitorRepo.update(cId, dto);
    return this.competitorRepo.findOneOrFail({ where: { id: cId } });
  }

  async deleteCompetitor(clientId: string, cId: string): Promise<void> {
    const c = await this.competitorRepo.findOne({
      where: { id: cId, client_id: clientId },
    });
    if (!c) throw new NotFoundException('Concorrente não encontrado');
    await this.competitorRepo.delete(cId);
  }

  // ─── Visibility Scores ────────────────────────────────────────────────────

  async listScores(clientId: string, limit = 30): Promise<AiVisibilityScore[]> {
    return this.scoreRepo.find({
      where: { client_id: clientId },
      relations: { platform: true },
      order: { score_date: 'DESC' },
      take: limit,
    });
  }

  async upsertScore(
    clientId: string,
    dto: CreateVisibilityScoreDto,
  ): Promise<AiVisibilityScore> {
    await this.dataSource.query(
      `
      INSERT INTO crm.ai_visibility_scores
        (client_id, platform_id, score_date, visibility_score, geo_score, mention_count, avg_ranking, avg_sentiment)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (client_id, platform_id, score_date) DO UPDATE SET
        visibility_score = EXCLUDED.visibility_score,
        geo_score        = EXCLUDED.geo_score,
        mention_count    = EXCLUDED.mention_count,
        avg_ranking      = EXCLUDED.avg_ranking,
        avg_sentiment    = EXCLUDED.avg_sentiment
    `,
      [
        clientId,
        dto.platform_id ?? null,
        dto.score_date,
        dto.visibility_score ?? null,
        dto.geo_score ?? null,
        dto.mention_count ?? 0,
        dto.avg_ranking ?? null,
        dto.avg_sentiment ?? null,
      ],
    );

    return this.scoreRepo.findOneOrFail({
      where: { client_id: clientId, score_date: dto.score_date },
    });
  }

  async getTimeline(clientId: string, days = 90) {
    return this.dataSource.query<
      Array<{
        score_date: string;
        visibility_score: string;
        geo_score: string;
        mention_count: string;
      }>
    >(
      `
      SELECT score_date, visibility_score, geo_score, mention_count
      FROM crm.ai_visibility_scores
      WHERE client_id = $1
      ORDER BY score_date ASC
      LIMIT $2
    `,
      [clientId, days],
    );
  }
}
