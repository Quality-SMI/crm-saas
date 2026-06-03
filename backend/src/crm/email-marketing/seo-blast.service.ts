import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Resend } from 'resend';
import OpenAI from 'openai';
import { SeoAnalysisService, SeoAnalysis } from './seo-analysis.service';

interface LeadRow {
  id: string;
  name: string | null;
  company: string | null;
  email: string;
  website: string;
}

interface SeoBlastParams {
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  audienceType: string; // 'all_leads_with_site' | 'new_leads_with_site' | etc.
  limit?: number;
  offset?: number;
  createdBy: string;
}

const CONCURRENT = 3; // Leads processados em paralelo
const DELAY_BETWEEN_BATCHES_MS = 1500;

@Injectable()
export class SeoBlastService {
  private readonly logger = new Logger(SeoBlastService.name);
  private readonly resend: Resend | null;
  private readonly openai: OpenAI | null;
  private readonly appUrl: string;
  private readonly backendUrl: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly seoAnalysis: SeoAnalysisService,
  ) {
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = resendKey ? new Resend(resendKey) : null;

    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

    this.appUrl = this.configService.get<string>('APP_URL') ?? 'http://localhost:3001';
    this.backendUrl = this.configService.get<string>('BACKEND_URL') ?? 'http://localhost:3000';

    if (!this.openai) {
      this.logger.warn('SeoBlastService: OPENAI_API_KEY não configurado — geração de conteúdo desativada.');
    }
    if (!this.resend) {
      this.logger.warn('SeoBlastService: RESEND_API_KEY não configurado — emails serão simulados.');
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  async createAndSend(params: SeoBlastParams): Promise<{ campaignId: string }> {
    // 1. Criar registro de campanha
    const campaignRows: { id: string }[] = await this.dataSource.query(
      `INSERT INTO crm.email_campaigns
         (id, name, subject, html_body, from_name, from_email, reply_to, audience_type, status, created_by, created_at, updated_at)
       VALUES
         (uuid_generate_v4(), $1, $2, '', $3, $4, $5, $6, 'SENDING', $7, NOW(), NOW())
       RETURNING id`,
      [params.name, params.subject, params.fromName, params.fromEmail, params.replyTo ?? null, params.audienceType, params.createdBy],
    );
    const campaignId = campaignRows[0].id;

    // 2. Disparar async (fire-and-forget)
    this.runBlast(campaignId, params).catch((err: Error) => {
      this.logger.error(`SeoBlast campanha ${campaignId} falhou: ${err.message}`);
    });

    return { campaignId };
  }

  async previewAudience(audienceType: string): Promise<{ total: number; withSite: number }> {
    const stageFilter = this.buildStageFilter(audienceType);
    const rows: { total: string; with_site: string }[] = await this.dataSource.query(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN website IS NOT NULL AND website != '' THEN 1 END) AS with_site
       FROM crm.leads
       WHERE deleted_at IS NULL
         AND contact_email IS NOT NULL AND contact_email != ''
         ${stageFilter}`,
    );
    return {
      total: parseInt(rows[0].total, 10),
      withSite: parseInt(rows[0].with_site, 10),
    };
  }

  // ─── Private — blast execution ────────────────────────────────────────────────

  private async runBlast(campaignId: string, params: SeoBlastParams): Promise<void> {
    const stageFilter = this.buildStageFilter(params.audienceType);

    const allLeads: LeadRow[] = await this.dataSource.query(
      `SELECT id, contact_name AS name, name AS company, contact_email AS email, website
       FROM crm.leads
       WHERE deleted_at IS NULL
         AND contact_email IS NOT NULL AND contact_email != ''
         AND website IS NOT NULL AND website != ''
         ${stageFilter}
       ORDER BY created_at DESC`,
    );

    const unsubRows: { email: string }[] = await this.dataSource.query(
      `SELECT email FROM crm.email_unsubscribes`,
    );
    const unsub = new Set(unsubRows.map((r) => r.email.toLowerCase()));

    let leads = allLeads.filter((l) => !unsub.has(l.email.toLowerCase()));

    const start = params.offset ?? 0;
    const end = params.limit ? start + params.limit : undefined;
    leads = leads.slice(start, end);

    await this.dataSource.query(
      `UPDATE crm.email_campaigns SET total_recipients = $1, updated_at = NOW() WHERE id = $2`,
      [leads.length, campaignId],
    );

    this.logger.log(`SeoBlast ${campaignId}: ${leads.length} leads elegíveis`);

    let sentCount = 0;

    for (let i = 0; i < leads.length; i += CONCURRENT) {
      const batch = leads.slice(i, i + CONCURRENT);

      await Promise.all(
        batch.map(async (lead) => {
          try {
            await this.processLead(lead, campaignId, params);
            sentCount++;
          } catch (err: any) {
            this.logger.error(`SeoBlast lead ${lead.email}: ${err?.message}`);
            await this.dataSource.query(
              `UPDATE crm.email_campaign_recipients SET status = 'FAILED' WHERE campaign_id = $1 AND email = $2`,
              [campaignId, lead.email],
            );
          }
        }),
      );

      await this.dataSource.query(
        `UPDATE crm.email_campaigns SET sent_count = $1, updated_at = NOW() WHERE id = $2`,
        [sentCount, campaignId],
      );

      if (i + CONCURRENT < leads.length) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    const finalStatus = sentCount === 0 && leads.length > 0 ? 'FAILED' : 'SENT';
    await this.dataSource.query(
      `UPDATE crm.email_campaigns SET status = $1, sent_count = $2, sent_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [finalStatus, sentCount, campaignId],
    );

    this.logger.log(`SeoBlast ${campaignId} concluído: ${sentCount}/${leads.length} enviados`);
  }

  private async processLead(
    lead: LeadRow,
    campaignId: string,
    params: SeoBlastParams,
  ): Promise<void> {
    // 1. Analisar website
    const analysis = await this.seoAnalysis.analyzeWebsite(lead.website);

    // 2. Gerar corpo do email com OpenAI
    const htmlBody = await this.generateEmailBody(lead, analysis);

    // 3. Inserir recipient
    const recipRows: { id: string }[] = await this.dataSource.query(
      `INSERT INTO crm.email_campaign_recipients
         (campaign_id, email, name, recipient_type, recipient_id)
       VALUES ($1, $2, $3, 'lead', $4)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [campaignId, lead.email, lead.name ?? lead.company ?? null, lead.id],
    );
    const recipientId = recipRows[0]?.id;

    // 4. Montar HTML final com tracking pixel + footer
    const finalHtml = this.wrapEmail(htmlBody, lead.email, campaignId, recipientId, params);

    // 5. Enviar
    if (!this.resend) {
      await this.dataSource.query(
        `UPDATE crm.email_campaign_recipients SET status = 'SENT', sent_at = NOW() WHERE campaign_id = $1 AND email = $2`,
        [campaignId, lead.email],
      );
      return;
    }

    const result = await this.resend.emails.send({
      from: `${params.fromName} <${params.fromEmail}>`,
      to: lead.email,
      subject: this.personalizeSubject(params.subject, lead),
      html: finalHtml,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    });

    if ((result as any)?.error) {
      throw new Error((result as any).error?.message ?? 'Resend error');
    }

    const messageId = (result as any)?.data?.id ?? null;
    await this.dataSource.query(
      `UPDATE crm.email_campaign_recipients
       SET status = 'SENT', sent_at = NOW(), resend_message_id = $3
       WHERE campaign_id = $1 AND email = $2`,
      [campaignId, lead.email, messageId],
    );
  }

  // ─── Email generation ─────────────────────────────────────────────────────────

  private async generateEmailBody(lead: LeadRow, analysis: SeoAnalysis): Promise<string> {
    const company = lead.company ?? lead.name ?? 'sua empresa';
    const website = analysis.url;

    if (!this.openai) {
      return this.fallbackEmailBody(company, website, analysis);
    }

    const issuesList = analysis.issues
      .slice(0, 5)
      .map((i) => `- [${i.severity.toUpperCase()}] ${i.label}: ${i.detail}`)
      .join('\n');

    const prompt = `Você é um especialista em SEO e marketing digital da Quality SMI, escrevendo um email de prospecção PERSONALIZADO em português brasileiro para a empresa "${company}" (site: ${website}).

DADOS DA ANÁLISE TÉCNICA DO SITE:
- Score SEO: ${analysis.score}/100
- Site acessível: ${analysis.reachable ? 'Sim' : 'Não'}
- HTTPS: ${analysis.https ? 'Sim' : 'Não'}
- Título: ${analysis.title ? `"${analysis.title}" (${analysis.titleLength} chars)` : 'AUSENTE'}
- Meta description: ${analysis.metaDescription ? `"${analysis.metaDescription.substring(0, 80)}..." (${analysis.metaDescriptionLength} chars)` : 'AUSENTE'}
- H1: ${analysis.h1 ? `"${analysis.h1}"` : 'AUSENTE'} (${analysis.h1Count} encontrados)
- Mobile (viewport): ${analysis.hasViewport ? 'OK' : 'Não configurado'}

PROBLEMAS ENCONTRADOS:
${issuesList || '- Nenhum problema crítico identificado'}

Escreva um email HTML profissional e persuasivo com:
1. Saudação personalizada com o nome da empresa
2. Uma abertura impactante sobre o score SEO deles (ex: "Analisamos o site ${website} e encontramos ${analysis.issues.filter(i => i.severity === 'critical').length} problemas críticos")
3. Lista visual dos 2-3 problemas mais graves com impacto real (sem jargão técnico desnecessário)
4. Um parágrafo sobre GEO — visibilidade em IAs como ChatGPT, Google Gemini e Perplexity — e como isso representa uma vantagem competitiva ainda pouco explorada
5. CTA final: agendar uma consultoria gratuita de 30 min com a Quality SMI

REGRAS:
- Tom: direto, especialista, útil — não vendedor barato
- Máximo 350 palavras
- Use HTML simples: <h2>, <p>, <ul><li>, <strong>, <a>
- NÃO inclua <!DOCTYPE>, <html>, <head> ou <body> — apenas o conteúdo interno
- O link do CTA deve ser: https://qualitysmi.com.br/consultoria
- Termine com uma assinatura simples da equipe Quality SMI`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content: 'Você é especialista em SEO e marketing digital. Escreva emails de prospecção personalizados em HTML para o Brasil. Retorne APENAS o HTML do corpo do email, sem tags html/head/body.',
          },
          { role: 'user', content: prompt },
        ],
      });

      return completion.choices[0]?.message?.content ?? this.fallbackEmailBody(company, website, analysis);
    } catch (err: any) {
      this.logger.error(`OpenAI erro para ${lead.email}: ${err?.message}`);
      return this.fallbackEmailBody(company, website, analysis);
    }
  }

  private fallbackEmailBody(company: string, website: string, analysis: SeoAnalysis): string {
    const criticals = analysis.issues.filter((i) => i.severity === 'critical');
    const topIssues = analysis.issues.slice(0, 3);

    return `
<h2>Analisamos o site da ${company} — encontramos ${analysis.issues.length} pontos de melhoria</h2>

<p>Olá,</p>

<p>Nossa equipe analisou <strong>${website}</strong> e identificou oportunidades importantes para melhorar sua visibilidade no Google e nas novas plataformas de IA.</p>

${topIssues.length > 0 ? `
<h3>⚠️ Principais problemas encontrados:</h3>
<ul>
${topIssues.map((i) => `  <li><strong>${i.label}</strong> — ${i.detail}</li>`).join('\n')}
</ul>
` : '<p>Seu site tem boa base técnica. Podemos ajudar a dar o próximo passo.</p>'}

<h3>🤖 GEO — Visibilidade nas IAs</h3>
<p>Além do Google, hoje os consumidores pesquisam diretamente no <strong>ChatGPT, Google Gemini e Perplexity</strong>. Empresas que aparecem nessas plataformas capturam clientes antes mesmo da busca tradicional. Este é um território ainda pouco explorado pelos seus concorrentes.</p>

<p>Gostaríamos de te mostrar em 30 minutos como resolver esses pontos e posicionar a <strong>${company}</strong> para aparecer onde seus clientes estão buscando.</p>

<p><a href="https://qualitysmi.com.br/consultoria" style="display:inline-block;background:#e36420;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;">Agendar consultoria gratuita</a></p>

<p>Atenciosamente,<br><strong>Equipe Quality SMI</strong><br>Google Partner · Meta Partner</p>`;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private personalizeSubject(subject: string, lead: LeadRow): string {
    const company = lead.company ?? lead.name ?? '';
    return subject
      .replace(/\{empresa\}/gi, company)
      .replace(/\{nome\}/gi, lead.name ?? company)
      .replace(/\{site\}/gi, lead.website);
  }

  private buildStageFilter(audienceType: string): string {
    switch (audienceType) {
      case 'seo_blast_new_leads':        return `AND stage = 'NEW'`;
      case 'seo_blast_qualified_leads':  return `AND stage = 'QUALIFIED'`;
      case 'seo_blast_all_active_leads': return `AND stage NOT IN ('LOST', 'WON')`;
      default:                           return `AND stage NOT IN ('LOST')`;
    }
  }

  private wrapEmail(
    body: string,
    email: string,
    campaignId: string,
    recipientId: string | undefined,
    params: SeoBlastParams,
  ): string {
    const encodedEmail = encodeURIComponent(email);
    const unsubUrl = `${this.appUrl}/unsubscribe?email=${encodedEmail}&campaign=${campaignId}`;
    const pixel = recipientId
      ? `<img src="${this.backendUrl}/api/email-marketing/webhooks/track/${recipientId}" width="1" height="1" style="display:none" alt="" />`
      : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr><td style="background:#fff;padding:24px 32px 16px;border-bottom:3px solid #e36420;text-align:center;">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;margin-bottom:10px;">
            <span style="font-size:28px;font-weight:900;color:#e36420;">Quality</span><span style="font-size:28px;font-weight:900;color:#1a2332;">SMI</span>
            <div style="font-size:10px;color:#9ca3af;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;margin-top:3px;">Sistema de Marketing para Internet</div>
          </div>
          <span style="display:inline-block;background:#4285F4;border-radius:4px;padding:3px 10px;font-size:10px;color:#fff;font-weight:700;margin:0 3px;">Google Partner</span>
          <span style="display:inline-block;background:#0866FF;border-radius:4px;padding:3px 10px;font-size:10px;color:#fff;font-weight:700;margin:0 3px;">Meta Partner</span>
        </td></tr>
        <tr><td style="padding:32px;color:#1f2937;font-size:15px;line-height:1.7;">
          <style>
            h1{font-size:24px;font-weight:700;color:#111827;margin:0 0 16px}
            h2{font-size:20px;font-weight:700;color:#111827;margin:24px 0 12px}
            h3{font-size:16px;font-weight:600;color:#374151;margin:20px 0 8px}
            p{margin:0 0 14px;color:#374151}
            ul{margin:0 0 14px;padding-left:20px;color:#374151}
            li{margin-bottom:6px}
            a{color:#e36420}
            strong{color:#111827}
          </style>
          ${body}
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
          <p style="margin:0 0 4px;font-weight:600;color:#6b7280;">Quality SMI — Sistema de Marketing para Internet</p>
          <p style="margin:0;"><a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">Cancelar inscrição</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  ${pixel}
</body>
</html>`;
  }
}
