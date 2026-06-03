import { Injectable, Logger } from '@nestjs/common';

export interface SeoIssue {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  label: string;
  detail: string;
}

export interface SeoAnalysis {
  url: string;
  reachable: boolean;
  https: boolean;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1: string | null;
  h1Count: number;
  hasViewport: boolean;
  hasCanonical: boolean;
  hasRobotsNoindex: boolean;
  issues: SeoIssue[];
  score: number; // 0–100
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 300_000; // 300 KB

@Injectable()
export class SeoAnalysisService {
  private readonly logger = new Logger(SeoAnalysisService.name);

  async analyzeWebsite(rawUrl: string): Promise<SeoAnalysis> {
    const url = this.normalizeUrl(rawUrl);
    const empty: SeoAnalysis = {
      url,
      reachable: false,
      https: url.startsWith('https://'),
      title: null,
      titleLength: 0,
      metaDescription: null,
      metaDescriptionLength: 0,
      h1: null,
      h1Count: 0,
      hasViewport: false,
      hasCanonical: false,
      hasRobotsNoindex: false,
      issues: [],
      score: 0,
    };

    let html: string;
    try {
      html = await this.fetchHtml(url);
    } catch (err: any) {
      this.logger.warn(`Falha ao buscar ${url}: ${err?.message}`);
      empty.issues.push({
        code: 'unreachable',
        severity: 'critical',
        label: 'Site inacessível',
        detail: `Não foi possível acessar ${url}. O site pode estar fora do ar ou bloqueando bots.`,
      });
      return empty;
    }

    return this.parseHtml(url, html);
  }

  // ─── HTML Fetching ────────────────────────────────────────────────────────────

  private normalizeUrl(raw: string): string {
    let url = raw.trim();
    if (!url.match(/^https?:\/\//i)) url = `https://${url}`;
    // Remove trailing slash for canonical comparison
    return url.replace(/\/$/, '');
  }

  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; QualitySMIBot/1.0; +https://qualitysmi.com.br)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        redirect: 'follow',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new Error(`Content-Type inesperado: ${contentType}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Response body vazio');

      let total = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        chunks.push(value);
        if (total > MAX_HTML_BYTES) break; // Evita baixar páginas enormes
      }

      const decoder = new TextDecoder('utf-8', { fatal: false });
      return decoder.decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    } finally {
      clearTimeout(tid);
    }
  }

  // ─── HTML Parsing ─────────────────────────────────────────────────────────────

  private parseHtml(url: string, html: string): SeoAnalysis {
    const lower = html.toLowerCase();

    // Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? this.stripTags(titleMatch[1]).trim() : null;
    const titleLength = title?.length ?? 0;

    // Meta description
    const metaDescMatch = html.match(
      /<meta[^>]+name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i,
    ) ?? html.match(
      /<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["']/i,
    );
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : null;
    const metaDescriptionLength = metaDescription?.length ?? 0;

    // H1
    const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
    const h1 = h1Matches.length > 0 ? this.stripTags(h1Matches[0][1]).trim() : null;
    const h1Count = h1Matches.length;

    // Meta tags
    const hasViewport = lower.includes('name="viewport"') || lower.includes("name='viewport'");
    const hasCanonical = lower.includes('rel="canonical"') || lower.includes("rel='canonical'");
    const hasRobotsNoindex =
      lower.includes('noindex') &&
      (lower.includes('name="robots"') || lower.includes("name='robots'") || lower.includes('x-robots'));

    const https = url.startsWith('https://');

    const issues: SeoIssue[] = [];

    // ─── Issue checks ────────────────────────────────────────────────────────

    if (!https) {
      issues.push({
        code: 'no_https',
        severity: 'critical',
        label: 'Site sem HTTPS',
        detail: 'O Google penaliza sites sem certificado SSL. Visitantes veem alerta de "site não seguro".',
      });
    }

    if (!title) {
      issues.push({
        code: 'missing_title',
        severity: 'critical',
        label: 'Título da página ausente',
        detail: 'A tag <title> é o fator de SEO mais importante. Sem ela, o Google não sabe o que rankear.',
      });
    } else if (titleLength < 30) {
      issues.push({
        code: 'short_title',
        severity: 'warning',
        label: 'Título muito curto',
        detail: `O título tem ${titleLength} caracteres. O ideal é entre 50–60 para aparecer completo no Google.`,
      });
    } else if (titleLength > 70) {
      issues.push({
        code: 'long_title',
        severity: 'info',
        label: 'Título muito longo',
        detail: `O título tem ${titleLength} caracteres. O Google corta acima de 60, escondendo parte da sua mensagem.`,
      });
    }

    if (!metaDescription) {
      issues.push({
        code: 'missing_meta_description',
        severity: 'critical',
        label: 'Meta description ausente',
        detail: 'Sem meta description, o Google escolhe um trecho aleatório do seu site — geralmente irrelevante para quem busca.',
      });
    } else if (metaDescriptionLength < 70) {
      issues.push({
        code: 'short_meta_description',
        severity: 'warning',
        label: 'Meta description muito curta',
        detail: `A descrição tem ${metaDescriptionLength} caracteres. O ideal é entre 120–160 para maximizar cliques.`,
      });
    }

    if (!h1) {
      issues.push({
        code: 'missing_h1',
        severity: 'critical',
        label: 'H1 ausente',
        detail: 'O H1 é o título principal da página para buscadores. Sem ele, o Google não consegue identificar o tema principal.',
      });
    } else if (h1Count > 1) {
      issues.push({
        code: 'multiple_h1',
        severity: 'warning',
        label: `${h1Count} tags H1 encontradas`,
        detail: 'Múltiplos H1 confundem o Google sobre qual é o tema principal da página.',
      });
    }

    if (!hasViewport) {
      issues.push({
        code: 'missing_viewport',
        severity: 'warning',
        label: 'Site não otimizado para mobile',
        detail: 'Sem a meta tag viewport, o site aparece distorcido em celulares. O Google usa mobile-first indexing.',
      });
    }

    if (!hasCanonical) {
      issues.push({
        code: 'missing_canonical',
        severity: 'info',
        label: 'Tag canonical ausente',
        detail: 'Sem canonical, versões duplicadas do mesmo URL dividem autoridade e confundem buscadores.',
      });
    }

    if (hasRobotsNoindex) {
      issues.push({
        code: 'robots_noindex',
        severity: 'critical',
        label: '⚠️ Site com noindex ativo',
        detail: 'O site está configurado para NÃO aparecer no Google. Esta é a causa mais grave de invisibilidade.',
      });
    }

    const score = this.calcScore(issues, https);

    return {
      url,
      reachable: true,
      https,
      title,
      titleLength,
      metaDescription,
      metaDescriptionLength,
      h1,
      h1Count,
      hasViewport,
      hasCanonical,
      hasRobotsNoindex,
      issues,
      score,
    };
  }

  private calcScore(issues: SeoIssue[], https: boolean): number {
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'critical') score -= 20;
      else if (issue.severity === 'warning') score -= 10;
      else score -= 5;
    }
    return Math.max(0, Math.min(100, score));
  }

  private stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
