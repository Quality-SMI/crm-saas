import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { google, Auth } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GscSnapshot } from './entities/gsc-snapshot.entity';
import { Client } from '../clients/entities/client.entity';

@Injectable()
export class PositioningService implements OnModuleInit {
  private readonly logger = new Logger(PositioningService.name);

  constructor(
    @InjectRepository(GscSnapshot)
    private readonly snapshotRepo: Repository<GscSnapshot>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const hasCredentials = this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_REFRESH_TOKEN');
    if (!hasCredentials) return;

    // Roda discovery em background sem bloquear o startup do app
    setTimeout(() => this.runDiscoveryIfNeeded(), 5000);
  }

  private async runDiscoveryIfNeeded() {
    try {
      const status = await this.getDiscoveryStatus();
      if (status.gscLinked === 0) {
        this.logger.log('Rodando discovery automático de propriedades Google...');
        const result = await this.discoverAndMatchProperties().catch((e) => {
          this.logger.warn('Discovery falhou: ' + e.message);
          return null;
        });
        if (result) {
          this.logger.log(`Discovery concluído: ${result.gscMatched} GSC, ${result.ga4Matched} GA4 vinculados`);
          this.syncAllClients().catch(() => {});
        }
      }
    } catch (e) {
      this.logger.warn('Discovery init error: ' + (e as Error).message);
    }
  }

  // Roda todo dia às 03:00
  @Cron('0 3 * * *')
  async scheduledSync() {
    const hasCredentials = this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_REFRESH_TOKEN');
    if (!hasCredentials) return;
    this.logger.log('Iniciando sync diário de posicionamento...');
    const result = await this.syncAllClients();
    this.logger.log(`Sync diário concluído: ${result.synced} clientes sincronizados`);
  }

  private getAuth(): Auth.OAuth2Client {
    const oauth2Client = new Auth.OAuth2Client(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
    );
    oauth2Client.setCredentials({
      refresh_token: this.config.get('GOOGLE_REFRESH_TOKEN'),
    });
    return oauth2Client;
  }

  // Extrai o domínio limpo de qualquer formato de URL ou sc-domain
  private extractDomain(url: string): string {
    return url
      .replace(/^sc-domain:/, '')
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .split('/')[0]
      .toLowerCase();
  }

  /**
   * Descobre automaticamente qual propriedade do Search Console e do GA4
   * corresponde a cada cliente, fazendo match por domínio.
   * Roda uma vez após configurar as credenciais Google.
   */
  async discoverAndMatchProperties(): Promise<{
    matched: number;
    gscMatched: number;
    ga4Matched: number;
    unmatched: string[];
  }> {
    const auth = this.getAuth();
    const sc = google.webmasters({ version: 'v3', auth });
    const admin = google.analyticsadmin({ version: 'v1beta', auth });

    // Busca todos os sites do Search Console
    const sitesRes = await sc.sites.list();
    const gscSites = (sitesRes.data.siteEntry ?? []).map((s) => ({
      siteUrl: s.siteUrl!,
      domain: this.extractDomain(s.siteUrl!),
    }));

    // Busca todas as propriedades GA4
    const ga4Props: Array<{ propertyId: string; domain: string; displayName: string }> = [];
    try {
      const summaries = await admin.accountSummaries.list({ pageSize: 200 });
      for (const account of summaries.data.accountSummaries ?? []) {
        for (const prop of account.propertySummaries ?? []) {
          const propId = prop.property?.replace('properties/', '') ?? '';
          // Busca data streams para obter a URL do site
          try {
            const streams = await admin.properties.dataStreams.list({
              parent: prop.property!,
            });
            for (const stream of streams.data.dataStreams ?? []) {
              const streamUrl = stream.webStreamData?.defaultUri ?? '';
              if (streamUrl) {
                ga4Props.push({
                  propertyId: propId,
                  domain: this.extractDomain(streamUrl),
                  displayName: prop.displayName ?? '',
                });
              }
            }
          } catch {
            // propriedade sem permissão de streams
          }
        }
      }
    } catch (e) {
      this.logger.warn('GA4 admin API error: ' + (e as Error).message);
    }

    // Carrega todos os clientes
    const clients = await this.clientRepo.find({ where: { deleted_at: null as any } });

    let gscMatched = 0;
    let ga4Matched = 0;
    const unmatched: string[] = [];

    for (const client of clients) {
      if (!client.domain) continue;
      const clientDomain = client.domain.toLowerCase().replace(/^www\./, '');

      // Match GSC
      const gscMatch = gscSites.find(
        (s) => s.domain === clientDomain || s.domain.endsWith(`.${clientDomain}`),
      );

      // Match GA4
      const ga4Match = ga4Props.find(
        (p) => p.domain === clientDomain || p.domain.endsWith(`.${clientDomain}`),
      );

      if (gscMatch || ga4Match) {
        await this.dataSource.query(
          `UPDATE crm.clients SET
            gsc_site_url = COALESCE($2, gsc_site_url),
            ga4_property_id = COALESCE($3, ga4_property_id)
           WHERE id = $1`,
          [client.id, gscMatch?.siteUrl ?? null, ga4Match?.propertyId ?? null],
        );
        if (gscMatch) gscMatched++;
        if (ga4Match) ga4Matched++;
      } else {
        unmatched.push(client.domain);
      }
    }

    return { matched: Math.max(gscMatched, ga4Matched), gscMatched, ga4Matched, unmatched };
  }

  async syncClient(clientId: string): Promise<void> {
    const client = await this.dataSource.query<any[]>(
      `SELECT id, domain, gsc_site_url, ga4_property_id FROM crm.clients WHERE id = $1 AND deleted_at IS NULL`,
      [clientId],
    ).then((rows) => rows[0]);

    if (!client?.domain) return;

    const auth = this.getAuth();
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];

    // Grava snapshots para 30, 60 e 90 dias para o filtro de período funcionar
    for (const periodDays of [30, 60, 90]) {
      const startDate = new Date(today.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const gscData = await this.fetchSearchConsole(auth, client, startDate, endDate);
      // GA4 só para 90 dias (evitar chamadas extras desnecessárias)
      const gaData = periodDays === 90
        ? await this.fetchAnalytics(auth, client, startDate, endDate)
        : { sessions: 0, users: 0 };
      await this.upsertSnapshot(clientId, endDate, periodDays, gscData, gaData);
    }
  }

  async syncAllClients(): Promise<{ synced: number; failed: number }> {
    const clients = await this.dataSource.query<any[]>(
      `SELECT id, domain, gsc_site_url, ga4_property_id FROM crm.clients WHERE deleted_at IS NULL AND (gsc_site_url IS NOT NULL OR ga4_property_id IS NOT NULL)`,
    );

    let synced = 0;
    let failed = 0;

    for (const client of clients) {
      try {
        await this.syncClient(client.id);
        synced++;
      } catch (err) {
        this.logger.warn(`Failed to sync ${client.domain}: ${(err as Error).message}`);
        failed++;
      }
    }

    return { synced, failed };
  }

  private async fetchSearchConsole(
    auth: Auth.OAuth2Client,
    client: { domain: string; gsc_site_url?: string },
    startDate: string,
    endDate: string,
  ) {
    const sc = google.webmasters({ version: 'v3', auth });

    // Usa o siteUrl descoberto; fallback para sc-domain e https://www.
    const candidates = client.gsc_site_url
      ? [client.gsc_site_url]
      : [`sc-domain:${client.domain}`, `https://www.${client.domain}/`, `https://${client.domain}/`];

    for (const siteUrl of candidates) {
      try {
        const [summary, keywords, pages] = await Promise.all([
          sc.searchanalytics.query({ siteUrl, requestBody: { startDate, endDate, dimensions: [] } }),
          sc.searchanalytics.query({ siteUrl, requestBody: { startDate, endDate, dimensions: ['query'], rowLimit: 1000 } }),
          sc.searchanalytics.query({ siteUrl, requestBody: { startDate, endDate, dimensions: ['page'], rowLimit: 500 } }),
        ]);

        const s = summary.data.rows?.[0];
        return {
          total_clicks: Math.round(s?.clicks ?? 0),
          total_impressions: Math.round(s?.impressions ?? 0),
          avg_position: s?.position ? Number(s.position.toFixed(2)) : null,
          avg_ctr: s?.ctr ? Number(s.ctr.toFixed(4)) : null,
          keywords: (keywords.data.rows ?? []).map((r) => ({
            query: r.keys?.[0] ?? '',
            clicks: Math.round(r.clicks ?? 0),
            impressions: Math.round(r.impressions ?? 0),
            position: Number((r.position ?? 0).toFixed(1)),
            ctr: Number((r.ctr ?? 0).toFixed(4)),
          })),
          pages: (pages.data.rows ?? []).map((r) => ({
            page: r.keys?.[0] ?? '',
            clicks: Math.round(r.clicks ?? 0),
            impressions: Math.round(r.impressions ?? 0),
            position: Number((r.position ?? 0).toFixed(1)),
          })),
        };
      } catch {
        continue;
      }
    }

    return { total_clicks: 0, total_impressions: 0, avg_position: null, avg_ctr: null, keywords: [], pages: [] };
  }

  private async fetchAnalytics(
    auth: Auth.OAuth2Client,
    client: { ga4_property_id?: string },
    startDate: string,
    endDate: string,
  ) {
    if (!client.ga4_property_id) return { sessions: 0, users: 0 };

    try {
      const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
      const res = await analyticsData.properties.runReport({
        property: `properties/${client.ga4_property_id}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
          dimensionFilter: {
            filter: {
              fieldName: 'sessionDefaultChannelGrouping',
              stringFilter: { value: 'Organic Search' },
            },
          },
        },
      });

      const row = res.data.rows?.[0];
      return {
        sessions: Number(row?.metricValues?.[0]?.value ?? 0),
        users: Number(row?.metricValues?.[1]?.value ?? 0),
      };
    } catch {
      return { sessions: 0, users: 0 };
    }
  }

  private async upsertSnapshot(
    clientId: string,
    date: string,
    periodDays: number,
    gsc: Awaited<ReturnType<PositioningService['fetchSearchConsole']>>,
    ga: { sessions: number; users: number },
  ) {
    await this.dataSource.query(
      `INSERT INTO crm.gsc_snapshots
        (client_id, date, period_days, total_clicks, total_impressions, avg_position, avg_ctr, keywords, pages, sessions, users, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (client_id, date, period_days) DO UPDATE SET
        total_clicks=$4, total_impressions=$5, avg_position=$6, avg_ctr=$7,
        keywords=$8, pages=$9, sessions=$10, users=$11, synced_at=NOW()`,
      [
        clientId, date, periodDays,
        gsc.total_clicks, gsc.total_impressions, gsc.avg_position, gsc.avg_ctr,
        JSON.stringify(gsc.keywords), JSON.stringify(gsc.pages),
        ga.sessions, ga.users,
      ],
    );
  }

  async getSnapshots(clientId: string, days = 90): Promise<GscSnapshot[]> {
    // Retorna histórico de snapshots do período selecionado ao longo do tempo
    return this.snapshotRepo
      .createQueryBuilder('s')
      .where('s.client_id = :clientId', { clientId })
      .andWhere('s.period_days = :days', { days })
      .orderBy('s.date', 'ASC')
      .getMany();
  }

  async getLatestSnapshot(clientId: string, days = 90): Promise<GscSnapshot | null> {
    return this.snapshotRepo.findOne({
      where: { client_id: clientId, period_days: days } as any,
      order: { date: 'DESC' },
    });
  }

  getConfigStatus(): { configured: boolean; hasClientId: boolean; hasSecret: boolean; hasRefreshToken: boolean } {
    const hasClientId = !!this.config.get('GOOGLE_CLIENT_ID');
    const hasSecret = !!this.config.get('GOOGLE_CLIENT_SECRET');
    const hasRefreshToken = !!this.config.get('GOOGLE_REFRESH_TOKEN');
    return {
      configured: hasClientId && hasSecret && hasRefreshToken,
      hasClientId,
      hasSecret,
      hasRefreshToken,
    };
  }

  async getDiscoveryStatus(): Promise<{ total: number; gscLinked: number; ga4Linked: number; unlinked: number }> {
    const rows = await this.dataSource.query<any[]>(`
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL) as total,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND gsc_site_url IS NOT NULL) as gsc_linked,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND ga4_property_id IS NOT NULL) as ga4_linked,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND gsc_site_url IS NULL AND ga4_property_id IS NULL) as unlinked
      FROM crm.clients
    `);
    const r = rows[0];
    return {
      total: Number(r.total),
      gscLinked: Number(r.gsc_linked),
      ga4Linked: Number(r.ga4_linked),
      unlinked: Number(r.unlinked),
    };
  }
}
