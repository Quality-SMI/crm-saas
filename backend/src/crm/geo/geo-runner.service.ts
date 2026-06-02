import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AiQuery } from './entities/ai-query.entity';
import { AiPlatform } from './entities/ai-platform.entity';
import { AiMention } from './entities/ai-mention.entity';
import { Client } from '../clients/entities/client.entity';
import { NotificationsService } from '../notifications/notifications.service';

// Slugs que usam Gemini com grounding web (simulação AI Overview)
const GEMINI_GROUNDING_SLUGS = new Set([
  'gemini',
  'ai_overview',
  'ai-overview',
  'aio',
]);

// Slugs que simulam plataformas com busca web real (OpenAI Responses API + web_search_preview)
const WEB_SEARCH_SLUGS = new Set(['perplexity', 'copilot', 'bing', 'you']);

export interface AioResult {
  query: string;
  ai_overview_simulado: string;
  principais_entidades: string[];
  fontes_citadas: string[];
  intencao_de_busca: string;
  topicos_recorrentes: string[];
  oportunidades_geo: string[];
  padroes_semanticos: string[];
  observacao: string;
  client_mentioned: boolean;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  sentiment_score: number;
  ranking_position: number | null;
  excerpt: string | null;
}

interface MentionAnalysis {
  mentioned: boolean;
  mention_type: 'DIRECT' | 'INDIRECT' | 'CITATION' | 'RECOMMENDATION';
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  sentiment_score: number;
  ranking_position: number | null;
  excerpt: string | null;
  urls_cited: string[];
  geo_metadata?: Record<string, unknown>;
}

type PlatformSlug = string;

@Injectable()
export class GeoRunnerService {
  private readonly logger = new Logger(GeoRunnerService.name);
  private readonly openai: OpenAI | null;
  private readonly gemini: GoogleGenerativeAI | null;

  constructor(
    @InjectRepository(AiQuery) private readonly queryRepo: Repository<AiQuery>,
    @InjectRepository(AiPlatform)
    private readonly platformRepo: Repository<AiPlatform>,
    @InjectRepository(AiMention)
    private readonly mentionRepo: Repository<AiMention>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {
    this.openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
    this.gemini = process.env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      : null;
    if (!this.openai && !this.gemini) {
      this.logger.warn(
        'GeoRunnerService: OPENAI_API_KEY e GEMINI_API_KEY não configurados — runner de GEO desativado.',
      );
    }
  }

  // ─── Cron diário — todo dia às 4h ─────────────────────────────────────────

  @Cron('0 4 * * *')
  async runDaily() {
    this.logger.log('GEO runner diário iniciado');
    const result = await this.runAll();
    this.logger.log(`GEO runner diário concluído: ${JSON.stringify(result)}`);
  }

  // ─── Run all clients ───────────────────────────────────────────────────────

  async runAll(): Promise<{
    clients: number;
    mentions: number;
    errors: number;
  }> {
    const queries = await this.queryRepo.find({
      where: { is_active: true },
      relations: { client: true },
    });

    const byClient = new Map<string, { client: Client; queries: AiQuery[] }>();
    for (const q of queries) {
      if (!q.client) continue;
      if (!byClient.has(q.client_id))
        byClient.set(q.client_id, { client: q.client, queries: [] });
      byClient.get(q.client_id)!.queries.push(q);
    }

    let clients = 0,
      mentions = 0,
      errors = 0;
    const citedClients: Array<{ id: string; name: string; mentions: number }> =
      [];

    for (const [, { client, queries: cqs }] of byClient) {
      try {
        const r = await this.runForClient(client, cqs);
        if (r.mentions > 0)
          citedClients.push({
            id: client.id,
            name: client.company_name,
            mentions: r.mentions,
          });
        mentions += r.mentions;
        clients++;
      } catch (e) {
        this.logger.error(`Erro cliente ${client.id}: ${(e as Error).message}`);
        errors++;
      }
      await this.sleep(2000);
    }

    if (citedClients.length > 0) {
      await this.notificationsService
        .create(
          'GEO_CITATIONS',
          `${citedClients.length} cliente${citedClients.length > 1 ? 's' : ''} citado${citedClients.length > 1 ? 's' : ''} nas IAs`,
          citedClients.map((c) => c.name).join(', '),
          { cited_clients: citedClients, total_mentions: mentions },
        )
        .catch(() => {});
    }

    return { clients, mentions, errors };
  }

  // ─── Run single client ─────────────────────────────────────────────────────

  async runForClient(
    clientOrId: Client | string,
    queries?: AiQuery[],
  ): Promise<{ mentions: number; errors: number }> {
    const client =
      typeof clientOrId === 'string'
        ? await this.clientRepo.findOneOrFail({ where: { id: clientOrId } })
        : clientOrId;

    if (!queries) {
      queries = await this.queryRepo.find({
        where: { client_id: client.id, is_active: true },
      });
    }

    const platforms = await this.platformRepo.find({
      where: { is_active: true },
    });
    const platformMap = new Map(platforms.map((p) => [p.slug, p]));

    let mentions = 0,
      errors = 0;

    for (const q of queries) {
      const targetPlatforms = q.platform_ids?.length
        ? platforms.filter((p) => q.platform_ids.includes(p.id))
        : platforms; // sem filtro: roda em todas as plataformas ativas

      for (const platform of targetPlatforms) {
        const needsGemini = GEMINI_GROUNDING_SLUGS.has(platform.slug);
        const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
        const hasGemini = Boolean(process.env.GEMINI_API_KEY);

        // Pula se não tem nenhuma chave disponível
        if (!hasOpenAI && !hasGemini) continue;
        // Plataformas Gemini/AIO precisam de chave Gemini; usa OpenAI como fallback se não tiver
        if (needsGemini && !hasGemini && !hasOpenAI) continue;

        try {
          const saved = await this.processQuery(client, q, platform);
          if (saved) mentions++;
        } catch (e) {
          this.logger.error(
            `Query ${q.id} / ${platform.slug}: ${(e as Error).message}`,
          );
          errors++;
        }
        await this.sleep(1500);
      }
    }

    // Atualizar scores por plataforma
    for (const platform of platforms.filter((p) =>
      ['chatgpt', 'gemini', 'ai_overview', 'ai-overview'].includes(p.slug),
    )) {
      await this.refreshScore(client.id, platform.id).catch(() => {});
    }

    return { mentions, errors };
  }

  // ─── Processar query ───────────────────────────────────────────────────────

  private async processQuery(
    client: Client,
    query: AiQuery,
    platform: AiPlatform,
  ): Promise<boolean> {
    let analysis: MentionAnalysis;

    if (
      GEMINI_GROUNDING_SLUGS.has(platform.slug) &&
      process.env.GEMINI_API_KEY
    ) {
      // Gemini com grounding — simula AI Overview do Google
      analysis = await this.analyzeWithGeminiGrounding(query.prompt, client);
    } else if (
      WEB_SEARCH_SLUGS.has(platform.slug) &&
      process.env.OPENAI_API_KEY
    ) {
      // Perplexity, Copilot — usam busca web real via Responses API
      analysis = await this.analyzeWithOpenAIWebSearch(query.prompt, client);
    } else {
      // ChatGPT, Claude — resposta sem busca web
      const responseText = await this.callChatGpt(query.prompt);
      if (!responseText) return false;
      analysis = await this.analyzeResponseWithOpenAI(responseText, client);
    }

    // Registra quando o prompt foi executado e se o cliente foi encontrado
    await this.queryRepo.update(query.id, {
      last_run_at: new Date(),
      last_result: analysis.mentioned,
    });

    if (!analysis.mentioned) return false;

    const mention = this.mentionRepo.create({
      client_id: client.id,
      platform_id: platform.id,
      query_id: query.id,
      mention_type: analysis.mention_type,
      response_excerpt: analysis.excerpt ?? '',
      sentiment: analysis.sentiment,
      sentiment_score: String(analysis.sentiment_score),
      ranking_position: analysis.ranking_position,
      urls_cited: analysis.urls_cited,
      geo_metadata: analysis.geo_metadata ?? null,
      checked_at: new Date(),
    });
    await this.mentionRepo.save(mention);

    for (const url of analysis.urls_cited) {
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '');
        await this.dataSource.query(
          `INSERT INTO crm.ai_sources (client_id, domain, citation_count, last_seen_at)
           VALUES ($1,$2,1,NOW())
           ON CONFLICT (client_id, domain)
           DO UPDATE SET citation_count = crm.ai_sources.citation_count + 1, last_seen_at = NOW()`,
          [client.id, domain],
        );
      } catch {}
    }

    return true;
  }

  // ─── Gemini com Google Search Grounding (AI Overview) ─────────────────────

  private async analyzeWithGeminiGrounding(
    prompt: string,
    client: Client,
  ): Promise<MentionAnalysis> {
    if (!this.gemini) throw new Error('GEMINI_API_KEY não configurado');
    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ googleSearch: {} } as never],
    });

    const systemInstruction = `Você é um assistente que simula o comportamento do AI Overview do Google.
Responda à query abaixo como o Google responderia em seu AI Overview, usando fontes reais da web.
Retorne APENAS JSON válido com este formato (sem comentários, sem markdown):
{
  "query": "a query respondida",
  "ai_overview_simulado": "resposta completa estilo AI Overview",
  "principais_entidades": ["entidade1", "entidade2"],
  "fontes_citadas": ["https://dominio1.com", "https://dominio2.com"],
  "intencao_de_busca": "informacional|transacional|navegacional|comercial",
  "topicos_recorrentes": ["topico1", "topico2"],
  "oportunidades_geo": ["oportunidade1", "oportunidade2"],
  "padroes_semanticos": ["padrao1", "padrao2"],
  "observacao": "Resultado inferido via Gemini grounding. Não é o AI Overview oficial do Google.",
  "client_mentioned": false,
  "sentiment": "NEUTRAL",
  "sentiment_score": 0.5,
  "ranking_position": null,
  "excerpt": null
}
IMPORTANTE: Responda com base apenas no que encontrar nas fontes reais. NÃO invente menções.`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nQuery: ${prompt}` }],
        },
      ],
    });

    const text = result.response.text();
    const groundingMeta = (
      result.response as unknown as Record<string, unknown>
    ).candidates as
      | Array<{
          groundingMetadata?: {
            groundingChunks?: Array<{ web?: { uri?: string } }>;
          };
        }>
      | undefined;

    // Extrair URLs do grounding metadata
    const groundingUrls: string[] = [];
    if (groundingMeta?.[0]?.groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMeta[0].groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) groundingUrls.push(chunk.web.uri);
      }
    }

    let parsed: AioResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? '{}');
    } catch {
      return {
        mentioned: false,
        mention_type: 'INDIRECT',
        sentiment: 'NEUTRAL',
        sentiment_score: 0.5,
        ranking_position: null,
        excerpt: null,
        urls_cited: groundingUrls,
      };
    }

    // Combinar fontes do JSON + grounding metadata
    const allSources = [
      ...new Set([
        ...(Array.isArray(parsed.fontes_citadas) ? parsed.fontes_citadas : []),
        ...groundingUrls,
      ]),
    ].filter((u) => u.startsWith('http'));

    const geoMetadata: Record<string, unknown> = {
      query: parsed.query ?? prompt,
      ai_overview_simulado: parsed.ai_overview_simulado ?? '',
      principais_entidades: parsed.principais_entidades ?? [],
      fontes_citadas: allSources,
      intencao_de_busca: parsed.intencao_de_busca ?? '',
      topicos_recorrentes: parsed.topicos_recorrentes ?? [],
      oportunidades_geo: parsed.oportunidades_geo ?? [],
      padroes_semanticos: parsed.padroes_semanticos ?? [],
      observacao:
        parsed.observacao ??
        'Resultado inferido via Gemini grounding/web search.',
    };

    // Verificar menção no texto real — não confiar apenas no campo client_mentioned da IA
    const overviewText = (parsed.ai_overview_simulado ?? '').toLowerCase();
    const nameVariants = [
      client.company_name.toLowerCase(),
      ...(client.domain
        ? [client.domain.replace(/^www\./, '').toLowerCase()]
        : []),
    ];
    const textMentions = nameVariants.some(
      (v) => v.length > 3 && overviewText.includes(v),
    );
    const isMentioned = textMentions || Boolean(parsed.client_mentioned);

    return {
      mentioned: isMentioned,
      mention_type: 'DIRECT',
      sentiment: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(parsed.sentiment)
        ? parsed.sentiment
        : 'NEUTRAL',
      sentiment_score: Number(parsed.sentiment_score ?? 0.5),
      ranking_position: parsed.ranking_position ?? null,
      excerpt:
        parsed.excerpt ??
        (isMentioned ? parsed.ai_overview_simulado?.slice(0, 500) : null) ??
        null,
      urls_cited: allSources,
      geo_metadata: geoMetadata,
    };
  }

  // ─── OpenAI Responses API com web search (Perplexity / Copilot) ───────────

  private async analyzeWithOpenAIWebSearch(
    prompt: string,
    client: Client,
  ): Promise<MentionAnalysis> {
    if (!this.openai) throw new Error('OPENAI_API_KEY não configurado');

    const response = await (this.openai as any).responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: prompt,
    });

    // Extrair texto da resposta
    const text: string = response.output_text ?? '';

    // Extrair URLs das anotações (url_citation)
    const urls: string[] = [];
    for (const item of response.output ?? []) {
      if (item.type === 'message') {
        for (const content of item.content ?? []) {
          if (content.type === 'output_text') {
            for (const annotation of content.annotations ?? []) {
              if (annotation.type === 'url_citation' && annotation.url) {
                urls.push(annotation.url);
              }
            }
          }
        }
      }
    }

    const analysis = await this.analyzeResponseWithOpenAI(text, client);
    return {
      ...analysis,
      urls_cited: [...new Set([...analysis.urls_cited, ...urls])].filter((u) =>
        u.startsWith('http'),
      ),
    };
  }

  // ─── ChatGPT ───────────────────────────────────────────────────────────────

  private async callChatGpt(prompt: string): Promise<string> {
    if (!this.openai) throw new Error('OPENAI_API_KEY não configurado');
    const resp = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 800,
    });
    return resp.choices[0]?.message?.content ?? '';
  }

  private async analyzeResponseWithOpenAI(
    response: string,
    client: Client,
  ): Promise<MentionAnalysis> {
    if (!this.openai) throw new Error('OPENAI_API_KEY não configurado');
    const resp = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analise se o texto menciona a empresa "${client.company_name}" ou domínio "${client.domain}".
Retorne APENAS JSON com:
- mentioned: boolean
- mention_type: "DIRECT"|"INDIRECT"|"CITATION"|"RECOMMENDATION"
- sentiment: "POSITIVE"|"NEUTRAL"|"NEGATIVE"
- sentiment_score: 0.0-1.0
- ranking_position: número ou null
- excerpt: trecho ou null
- urls_cited: array de URLs encontradas`,
        },
        { role: 'user', content: response },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 400,
    });

    const parsed = JSON.parse(resp.choices[0]?.message?.content ?? '{}');
    return {
      mentioned: Boolean(parsed.mentioned),
      mention_type: parsed.mention_type ?? 'DIRECT',
      sentiment: parsed.sentiment ?? 'NEUTRAL',
      sentiment_score: Number(parsed.sentiment_score ?? 0.5),
      ranking_position: parsed.ranking_position ?? null,
      excerpt: parsed.excerpt ?? null,
      urls_cited: Array.isArray(parsed.urls_cited) ? parsed.urls_cited : [],
    };
  }

  // ─── Visibility score ──────────────────────────────────────────────────────

  private async refreshScore(
    clientId: string,
    platformId: string,
  ): Promise<void> {
    const [stats] = await this.dataSource.query<
      {
        cnt: string;
        avg_rank: string;
        avg_sent: string;
        pos: string;
        neg: string;
      }[]
    >(
      `
      SELECT COUNT(*) AS cnt,
        AVG(ranking_position) AS avg_rank,
        AVG(sentiment_score::numeric) AS avg_sent,
        SUM(CASE WHEN sentiment = 'POSITIVE' THEN 1 ELSE 0 END) AS pos,
        SUM(CASE WHEN sentiment = 'NEGATIVE' THEN 1 ELSE 0 END) AS neg
      FROM crm.ai_mentions
      WHERE client_id = $1 AND platform_id = $2
        AND checked_at >= NOW() - INTERVAL '30 days'
    `,
      [clientId, platformId],
    );

    const count = Number(stats?.cnt ?? 0);
    if (count === 0) return;

    const posRatio = Number(stats.pos) / count;
    const negRatio = Number(stats.neg) / count;
    const visibilityScore = Math.min(
      100,
      (count / 10) * 50 + posRatio * 30 + (1 - negRatio) * 20,
    );
    const geoScore = Math.min(100, visibilityScore * 0.7 + posRatio * 30);

    await this.dataSource.query(
      `
      INSERT INTO crm.ai_visibility_scores
        (client_id, platform_id, score_date, visibility_score, geo_score, mention_count, avg_ranking, avg_sentiment)
      VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6,$7)
      ON CONFLICT (client_id, platform_id, score_date) DO UPDATE SET
        visibility_score = EXCLUDED.visibility_score,
        geo_score        = EXCLUDED.geo_score,
        mention_count    = EXCLUDED.mention_count,
        avg_ranking      = EXCLUDED.avg_ranking,
        avg_sentiment    = EXCLUDED.avg_sentiment
    `,
      [
        clientId,
        platformId,
        visibilityScore.toFixed(2),
        geoScore.toFixed(2),
        count,
        stats.avg_rank ?? null,
        stats.avg_sent ?? null,
      ],
    );
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }
}
