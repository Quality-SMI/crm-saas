import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';

export interface KeywordChange {
  keyword: string;
  prev_position: number | null;
  curr_position: number | null;
  delta: number | null;        // positivo = subiu, negativo = caiu
  type: 'improved' | 'declined' | 'new' | 'lost' | 'stable';
  curr_clicks: number;
  curr_impressions: number;
}

export interface MonthlyReport {
  id: string;
  client_id: string;
  report_month: string;
  curr_clicks: number;
  curr_impressions: number;
  curr_position: number | null;
  curr_ctr: number | null;
  curr_sessions: number;
  prev_clicks: number;
  prev_impressions: number;
  prev_position: number | null;
  prev_ctr: number | null;
  prev_sessions: number;
  keyword_changes: KeywordChange[];
  created_at: string;
}

@Injectable()
export class PositioningReportService {
  private readonly logger = new Logger(PositioningReportService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Roda todo dia 1º às 07:00
  @Cron('0 7 1 * *')
  async runMonthlyReports() {
    this.logger.log('Gerando relatórios mensais de posicionamento...');
    const result = await this.generateAllReports();
    this.logger.log(`Relatórios mensais gerados: ${result.generated} clientes, ${result.failed} falhas`);
  }

  async generateAllReports(): Promise<{ generated: number; failed: number }> {
    const clients = await this.dataSource.query<{ id: string; company_name: string }[]>(
      `SELECT id, company_name FROM crm.clients WHERE deleted_at IS NULL
       AND id IN (SELECT DISTINCT client_id FROM crm.gsc_snapshots)`,
    );

    let generated = 0, failed = 0;
    for (const client of clients) {
      try {
        await this.generateReportForClient(client.id);
        generated++;
      } catch (e) {
        this.logger.warn(`Relatório falhou para ${client.company_name}: ${(e as Error).message}`);
        failed++;
      }
    }
    return { generated, failed };
  }

  async generateReportForClient(clientId: string): Promise<MonthlyReport | null> {
    const reportMonth = new Date();
    reportMonth.setDate(1);
    reportMonth.setHours(0, 0, 0, 0);
    const reportMonthStr = reportMonth.toISOString().split('T')[0];

    // Snapshot atual (30d mais recente)
    const [curr] = await this.dataSource.query<any[]>(
      `SELECT * FROM crm.gsc_snapshots
       WHERE client_id = $1 AND period_days = 30
       ORDER BY date DESC LIMIT 1`,
      [clientId],
    );

    if (!curr) return null;

    // Snapshot de ~30 dias atrás (para comparar com o mês anterior)
    const prevDate = new Date(curr.date);
    prevDate.setDate(prevDate.getDate() - 28); // ~1 mês atrás
    const prevDateMin = new Date(prevDate);
    prevDateMin.setDate(prevDateMin.getDate() - 5);

    const [prev] = await this.dataSource.query<any[]>(
      `SELECT * FROM crm.gsc_snapshots
       WHERE client_id = $1 AND period_days = 30
         AND date <= $2 AND date >= $3
       ORDER BY date DESC LIMIT 1`,
      [clientId, prevDate.toISOString().split('T')[0], prevDateMin.toISOString().split('T')[0]],
    );

    // Palavras-chave contratadas
    const contractedRows = await this.dataSource.query<{ keyword: string }[]>(
      `SELECT keyword FROM crm.client_keywords
       WHERE client_id = $1 AND is_active = true AND deleted_at IS NULL
       ORDER BY keyword`,
      [clientId],
    );
    const contracted = contractedRows.map((r) => r.keyword);

    const currKws: Record<string, { position: number; clicks: number; impressions: number }> = {};
    const prevKws: Record<string, { position: number; clicks: number; impressions: number }> = {};

    const currKeywords: any[] = Array.isArray(curr.keywords)
      ? curr.keywords
      : (typeof curr.keywords === 'string' ? JSON.parse(curr.keywords) : []);

    const prevKeywords: any[] = prev && (Array.isArray(prev.keywords)
      ? prev.keywords
      : (typeof prev.keywords === 'string' ? JSON.parse(prev.keywords) : []));

    for (const k of currKeywords) {
      currKws[k.query?.toLowerCase()] = { position: Number(k.position), clicks: k.clicks, impressions: k.impressions };
    }
    if (prev) {
      for (const k of prevKeywords) {
        prevKws[k.query?.toLowerCase()] = { position: Number(k.position), clicks: k.clicks, impressions: k.impressions };
      }
    }

    const keywordChanges: KeywordChange[] = contracted.map((kw) => {
      const lkw = kw.toLowerCase();
      const currData = currKws[lkw] ?? null;
      const prevData = prev ? (prevKws[lkw] ?? null) : null;

      if (!currData && !prevData) {
        return { keyword: kw, prev_position: null, curr_position: null, delta: null, type: 'lost' as const, curr_clicks: 0, curr_impressions: 0 };
      }
      if (currData && !prevData) {
        return { keyword: kw, prev_position: null, curr_position: currData.position, delta: null, type: 'new' as const, curr_clicks: currData.clicks, curr_impressions: currData.impressions };
      }
      if (!currData && prevData) {
        return { keyword: kw, prev_position: prevData.position, curr_position: null, delta: null, type: 'lost' as const, curr_clicks: 0, curr_impressions: 0 };
      }
      const delta = prevData!.position - currData!.position; // positivo = melhorou
      const type: KeywordChange['type'] = Math.abs(delta) < 1 ? 'stable' : delta > 0 ? 'improved' : 'declined';
      return {
        keyword: kw,
        prev_position: prevData!.position,
        curr_position: currData!.position,
        delta: Number(delta.toFixed(1)),
        type,
        curr_clicks: currData!.clicks,
        curr_impressions: currData!.impressions,
      };
    });

    // Salva o relatório
    const [saved] = await this.dataSource.query<any[]>(
      `INSERT INTO crm.positioning_monthly_reports
         (client_id, report_month, curr_clicks, curr_impressions, curr_position, curr_ctr, curr_sessions,
          prev_clicks, prev_impressions, prev_position, prev_ctr, prev_sessions, keyword_changes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (client_id, report_month) DO UPDATE SET
         curr_clicks=$3, curr_impressions=$4, curr_position=$5, curr_ctr=$6, curr_sessions=$7,
         prev_clicks=$8, prev_impressions=$9, prev_position=$10, prev_ctr=$11, prev_sessions=$12,
         keyword_changes=$13, created_at=NOW()
       RETURNING *`,
      [
        clientId, reportMonthStr,
        curr.total_clicks, curr.total_impressions, curr.avg_position, curr.avg_ctr, curr.sessions ?? 0,
        prev?.total_clicks ?? 0, prev?.total_impressions ?? 0, prev?.avg_position ?? null, prev?.avg_ctr ?? null, prev?.sessions ?? 0,
        JSON.stringify(keywordChanges),
      ],
    );

    // Cria notificação resumida
    const improved = keywordChanges.filter((k) => k.type === 'improved').length;
    const declined = keywordChanges.filter((k) => k.type === 'declined').length;
    const lost = keywordChanges.filter((k) => k.type === 'lost').length;
    const isNew = keywordChanges.filter((k) => k.type === 'new').length;

    if (contracted.length > 0) {
      await this.dataSource.query(
        `INSERT INTO crm.notifications (type, title, body, metadata, read_by, created_at)
         VALUES ($1, $2, $3, $4, '[]'::jsonb, NOW())
         ON CONFLICT DO NOTHING`,
        [
          'MONTHLY_POSITIONING_REPORT',
          `Relatório mensal — ${reportMonthStr.slice(0, 7)}`,
          `${improved} palavra${improved !== 1 ? 's' : ''} melhorou · ${declined} caiu · ${isNew} nova${isNew !== 1 ? 's' : ''} · ${lost} perdida${lost !== 1 ? 's' : ''}`,
          JSON.stringify({ client_id: clientId, report_month: reportMonthStr, improved, declined, lost, new: isNew }),
        ],
      ).catch(() => {}); // notificação é opcional
    }

    return { ...saved, keyword_changes: keywordChanges };
  }

  async getLatestReport(clientId: string): Promise<MonthlyReport | null> {
    const [row] = await this.dataSource.query<any[]>(
      `SELECT * FROM crm.positioning_monthly_reports
       WHERE client_id = $1
       ORDER BY report_month DESC LIMIT 1`,
      [clientId],
    );
    if (!row) return null;
    return {
      ...row,
      keyword_changes: Array.isArray(row.keyword_changes)
        ? row.keyword_changes
        : (typeof row.keyword_changes === 'string' ? JSON.parse(row.keyword_changes) : []),
    };
  }

  async listReports(clientId: string): Promise<MonthlyReport[]> {
    const rows = await this.dataSource.query<any[]>(
      `SELECT * FROM crm.positioning_monthly_reports
       WHERE client_id = $1
       ORDER BY report_month DESC LIMIT 12`,
      [clientId],
    );
    return rows.map((r) => ({
      ...r,
      keyword_changes: Array.isArray(r.keyword_changes)
        ? r.keyword_changes
        : (typeof r.keyword_changes === 'string' ? JSON.parse(r.keyword_changes) : []),
    }));
  }
}
