import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Resend } from 'resend';

interface AudienceMember {
  email: string;
  name: string | null;
  type: 'client' | 'lead';
  id: string;
}

@Injectable()
export class EmailSendingService {
  private readonly logger = new Logger(EmailSendingService.name);
  private readonly resend: Resend | null;
  private readonly appUrl: string;
  private readonly backendUrl: string;
  private readonly logoSrc: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3001';
    this.backendUrl =
      this.configService.get<string>('BACKEND_URL') ?? 'http://localhost:3000';

    // Tenta embutir o logo como base64 (funciona em clientes de email sem acesso a localhost).
    // Em produção, se o arquivo não existir, usa a URL pública do APP_URL.
    const logoPath =
      this.configService.get<string>('LOGO_PATH') ??
      path.join(process.cwd(), '..', 'frontend', 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      this.logoSrc = `data:image/png;base64,${buf.toString('base64')}`;
      this.logger.log('Logo embutido como base64 no template de email');
    } else {
      this.logoSrc = `${this.appUrl}/logo.png`;
      this.logger.warn(
        `Logo não encontrado em ${logoPath} — usando URL: ${this.logoSrc}`,
      );
    }

    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY não configurado — os e-mails serão simulados (modo sandbox)',
      );
      this.resend = null;
    } else {
      this.resend = new Resend(apiKey);
    }
  }

  async sendCampaign(
    campaignId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<void> {
    const campaigns = await this.dataSource.query(
      `SELECT * FROM crm.email_campaigns WHERE id = $1`,
      [campaignId],
    );

    if (!campaigns.length) {
      throw new BadRequestException('Campanha não encontrada');
    }

    const campaign = campaigns[0];

    if (
      campaign.status !== 'DRAFT' &&
      campaign.status !== 'SCHEDULED' &&
      campaign.status !== 'FAILED'
    ) {
      throw new BadRequestException(
        `Campanha não pode ser enviada no status atual: ${campaign.status}`,
      );
    }

    // Resetar recipients FAILED para PENDING ao reenviar uma campanha que falhou
    if (campaign.status === 'FAILED') {
      await this.dataSource.query(
        `UPDATE crm.email_campaign_recipients SET status = 'PENDING' WHERE campaign_id = $1 AND status = 'FAILED'`,
        [campaignId],
      );
    }

    await this.dataSource.query(
      `UPDATE crm.email_campaigns SET status = 'SENDING', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [campaignId],
    );

    const audience = await this.resolveAudience(campaign);

    const unsubscribeRows = await this.dataSource.query(
      `SELECT email FROM crm.email_unsubscribes`,
    );
    const unsubscribedEmails = new Set<string>(
      unsubscribeRows.map((r: { email: string }) => r.email.toLowerCase()),
    );

    let filtered = audience.filter(
      (m) => !unsubscribedEmails.has(m.email.toLowerCase()),
    );

    if (opts?.offset || opts?.limit) {
      const start = opts.offset ?? 0;
      const end = opts.limit ? start + opts.limit : undefined;
      filtered = filtered.slice(start, end);
      this.logger.log(
        `Envio parcial: offset=${start}, limit=${opts.limit ?? 'ilimitado'}, selecionados=${filtered.length}`,
      );
    }

    if (filtered.length > 0) {
      const placeholders = filtered
        .map(
          (_, i) =>
            `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`,
        )
        .join(', ');
      const values: unknown[] = [campaignId];
      filtered.forEach((m) => {
        values.push(m.email, m.name ?? null, m.type, m.id ?? null);
      });

      await this.dataSource.query(
        `INSERT INTO crm.email_campaign_recipients (campaign_id, email, name, recipient_type, recipient_id)
         VALUES ${placeholders}
         ON CONFLICT DO NOTHING`,
        values,
      );
    }

    await this.dataSource.query(
      `UPDATE crm.email_campaigns SET total_recipients = $1, updated_at = NOW() WHERE id = $2`,
      [filtered.length, campaignId],
    );

    // Build email → recipientId map for tracking pixels
    const recipientRows: { id: string; email: string }[] =
      await this.dataSource.query(
        `SELECT id, email FROM crm.email_campaign_recipients WHERE campaign_id = $1`,
        [campaignId],
      );
    const recipientIdMap = new Map<string, string>(
      recipientRows.map((r) => [r.email.toLowerCase(), r.id]),
    );

    const BATCH_SIZE = 50;
    let sentCount = 0;

    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (recipient) => {
          try {
            const recipientId = recipientIdMap.get(
              recipient.email.toLowerCase(),
            );
            const htmlWithUnsubscribe = this.injectUnsubscribeFooter(
              campaign.html_body,
              recipient.email,
              campaignId,
              recipientId,
            );

            if (!this.resend) {
              await this.dataSource.query(
                `UPDATE crm.email_campaign_recipients
                 SET status = 'SENT', sent_at = NOW()
                 WHERE campaign_id = $1 AND email = $2`,
                [campaignId, recipient.email],
              );
              sentCount++;
              return;
            }

            const campaignAttachments: { name: string; content: string; type: string }[] =
              Array.isArray(campaign.attachments) ? campaign.attachments : [];

            const result = await this.resend.emails.send({
              from: `${campaign.from_name} <${campaign.from_email}>`,
              to: recipient.email,
              subject: campaign.subject,
              html: htmlWithUnsubscribe,
              ...(campaign.reply_to ? { replyTo: campaign.reply_to } : {}),
              ...(campaignAttachments.length > 0
                ? {
                    attachments: campaignAttachments.map((a) => ({
                      filename: a.name,
                      content: Buffer.from(a.content, 'base64'),
                    })),
                  }
                : {}),
            });

            if ((result as any)?.error) {
              const err = (result as any).error;
              throw new Error(
                `Resend: ${err.message ?? err.name ?? 'erro desconhecido'}`,
              );
            }

            const messageId = (result as any)?.data?.id ?? null;

            await this.dataSource.query(
              `UPDATE crm.email_campaign_recipients
               SET status = 'SENT', sent_at = NOW(), resend_message_id = $3
               WHERE campaign_id = $1 AND email = $2`,
              [campaignId, recipient.email, messageId],
            );
            sentCount++;
          } catch (err) {
            this.logger.error(
              `Falha ao enviar para ${recipient.email}: ${(err as Error).message}`,
            );
            await this.dataSource.query(
              `UPDATE crm.email_campaign_recipients
               SET status = 'FAILED'
               WHERE campaign_id = $1 AND email = $2`,
              [campaignId, recipient.email],
            );
          }
        }),
      );

      await this.dataSource.query(
        `UPDATE crm.email_campaigns SET sent_count = $1, updated_at = NOW() WHERE id = $2`,
        [sentCount, campaignId],
      );

      if (i + BATCH_SIZE < filtered.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Se zero emails foram enviados e havia destinatários, marca como FAILED
    const finalStatus =
      sentCount === 0 && filtered.length > 0 ? 'FAILED' : 'SENT';
    if (finalStatus === 'FAILED') {
      this.logger.error(
        `Campanha ${campaignId}: todos os ${filtered.length} envios falharam. Verifique a chave Resend e o domínio remetente.`,
      );
    }

    await this.dataSource.query(
      `UPDATE crm.email_campaigns
       SET status = $3, sent_count = $1, updated_at = NOW()
       WHERE id = $2`,
      [sentCount, campaignId, finalStatus],
    );
  }

  async trackOpen(recipientId: string): Promise<void> {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(recipientId)) return;

    const updated: { campaign_id: string }[] = await this.dataSource.query(
      `UPDATE crm.email_campaign_recipients
       SET status = 'OPENED', opened_at = NOW()
       WHERE id = $1 AND status = 'SENT'
       RETURNING campaign_id`,
      [recipientId],
    );

    if (updated.length > 0) {
      await this.dataSource.query(
        `UPDATE crm.email_campaigns SET open_count = open_count + 1, updated_at = NOW() WHERE id = $1`,
        [updated[0].campaign_id],
      );
    }
  }

  async processWebhook(payload: any): Promise<void> {
    const type: string = payload?.type ?? '';
    const messageId: string | undefined =
      payload?.data?.email_id ?? payload?.data?.id ?? undefined;

    if (!messageId) {
      this.logger.warn('Webhook recebido sem message_id', payload);
      return;
    }

    const recipients = await this.dataSource.query(
      `SELECT * FROM crm.email_campaign_recipients WHERE resend_message_id = $1`,
      [messageId],
    );

    if (!recipients.length) {
      this.logger.warn(
        `Recipient não encontrado para message_id: ${messageId}`,
      );
      return;
    }

    const recipient = recipients[0];

    switch (type) {
      case 'email.opened': {
        await this.dataSource.query(
          `UPDATE crm.email_campaign_recipients
           SET status = 'OPENED', opened_at = NOW()
           WHERE id = $1 AND (status = 'SENT' OR status = 'OPENED')`,
          [recipient.id],
        );
        await this.dataSource.query(
          `UPDATE crm.email_campaigns SET open_count = open_count + 1, updated_at = NOW() WHERE id = $1`,
          [recipient.campaign_id],
        );
        break;
      }

      case 'email.clicked': {
        await this.dataSource.query(
          `UPDATE crm.email_campaign_recipients
           SET status = 'CLICKED', clicked_at = NOW()
           WHERE id = $1`,
          [recipient.id],
        );
        await this.dataSource.query(
          `UPDATE crm.email_campaigns SET click_count = click_count + 1, updated_at = NOW() WHERE id = $1`,
          [recipient.campaign_id],
        );
        break;
      }

      case 'email.bounced': {
        const bounceReason: string =
          payload?.data?.bounce?.message ?? payload?.data?.reason ?? 'Bounce';
        await this.dataSource.query(
          `UPDATE crm.email_campaign_recipients
           SET status = 'BOUNCED', bounce_reason = $2
           WHERE id = $1`,
          [recipient.id, bounceReason],
        );
        await this.dataSource.query(
          `UPDATE crm.email_campaigns SET bounce_count = bounce_count + 1, updated_at = NOW() WHERE id = $1`,
          [recipient.campaign_id],
        );
        break;
      }

      case 'email.complained': {
        await this.dataSource.query(
          `UPDATE crm.email_campaign_recipients
           SET status = 'UNSUBSCRIBED'
           WHERE id = $1`,
          [recipient.id],
        );
        await this.dataSource.query(
          `INSERT INTO crm.email_unsubscribes (email, campaign_id, reason)
           VALUES ($1, $2, 'spam_complaint')
           ON CONFLICT (email) DO NOTHING`,
          [recipient.email, recipient.campaign_id],
        );
        await this.dataSource.query(
          `UPDATE crm.email_campaigns SET unsubscribe_count = unsubscribe_count + 1, updated_at = NOW() WHERE id = $1`,
          [recipient.campaign_id],
        );
        break;
      }

      default:
        this.logger.log(`Webhook event ignorado: ${type}`);
    }
  }

  private async resolveAudience(campaign: any): Promise<AudienceMember[]> {
    const audienceType: string = campaign.audience_type ?? 'all_clients';

    switch (audienceType) {
      case 'all_clients':
      case 'active_clients':
        return this.dataSource.query(
          `SELECT email, company_name AS name, id, 'client' AS type
           FROM crm.clients
           WHERE deleted_at IS NULL AND email IS NOT NULL AND email != ''`,
        );

      case 'all_leads':
        return this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''`,
        );

      case 'new_leads':
        return this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'NEW'`,
        );

      case 'qualified_leads':
        return this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'QUALIFIED'`,
        );

      case 'won_leads':
        return this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'WON'`,
        );

      case 'lost_leads':
        return this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'LOST'`,
        );

      case 'proposal_leads':
        return this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'PROPOSAL'`,
        );

      case 'negotiation_leads':
        return this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'NEGOTIATION'`,
        );

      case 'manual': {
        const filters: Record<string, unknown> =
          typeof campaign.audience_filters === 'string'
            ? JSON.parse(campaign.audience_filters)
            : (campaign.audience_filters ?? {});
        const emails: string[] = Array.isArray(filters['emails'])
          ? (filters['emails'] as string[])
          : [];
        return emails
          .map((e: string) => e.trim().toLowerCase())
          .filter((e: string) => e.includes('@'))
          .map((email: string) => ({
            email,
            name: null,
            type: 'lead' as const,
            id: null as unknown as string,
          }));
      }

      default:
        this.logger.warn(`audience_type desconhecido: ${audienceType}`);
        return [];
    }
  }

  private injectUnsubscribeFooter(
    html: string,
    email: string,
    campaignId: string,
    recipientId?: string,
  ): string {
    const encodedEmail = encodeURIComponent(email);
    const unsubscribeUrl = `${this.appUrl}/unsubscribe?email=${encodedEmail}&campaign=${campaignId}`;
    const pixelTag = recipientId
      ? `<img src="${this.backendUrl}/api/email-marketing/webhooks/track/${recipientId}" width="1" height="1" style="display:none;width:1px;height:1px;" alt="" />`
      : '';

    // If already a full HTML document, just inject footer before </body>
    if (html.includes('</body>') || html.includes('<html')) {
      const footer = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-family:sans-serif;font-size:12px;color:#9ca3af;">
  <p style="margin:4px 0;">Você está recebendo este e-mail porque está cadastrado em nossa lista.</p>
  <p style="margin:4px 0;"><a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Cancelar inscrição</a></p>
</div>${pixelTag}`;
      return html.includes('</body>')
        ? html.replace('</body>', `${footer}</body>`)
        : html + footer;
    }

    // Wrap TipTap/prose HTML in a proper email shell
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <!-- Header -->
          <tr>
            <td style="background:#ffffff;padding:24px 32px 16px;border-bottom:3px solid #e36420;text-align:center;">
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;margin-bottom:10px;line-height:1;">
                <span style="font-size:28px;font-weight:900;color:#e36420;letter-spacing:-0.5px;">Quality</span><span style="font-size:28px;font-weight:900;color:#1a2332;letter-spacing:-0.5px;">SMI</span>
                <div style="font-size:10px;color:#9ca3af;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;margin-top:3px;">Sistema de Marketing para Internet</div>
              </div>
              <div>
                <span style="display:inline-block;background:#4285F4;border-radius:4px;padding:3px 10px;font-size:10px;color:#ffffff;font-weight:700;margin:0 3px;letter-spacing:0.2px;">Google Partner</span>
                <span style="display:inline-block;background:#0866FF;border-radius:4px;padding:3px 10px;font-size:10px;color:#ffffff;font-weight:700;margin:0 3px;letter-spacing:0.2px;">Meta Partner</span>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;color:#1f2937;font-size:15px;line-height:1.7;">
              <style>
                h1{font-size:26px;font-weight:700;color:#111827;margin:0 0 16px;line-height:1.3}
                h2{font-size:20px;font-weight:600;color:#1f2937;margin:24px 0 12px;line-height:1.4}
                h3{font-size:17px;font-weight:600;color:#374151;margin:20px 0 10px}
                p{margin:0 0 14px;color:#374151}
                ul,ol{margin:0 0 14px;padding-left:20px;color:#374151}
                li{margin-bottom:6px}
                a{color:#1d4ed8}
                strong{color:#111827}
                blockquote{margin:16px 0;padding:12px 16px;border-left:3px solid #e36420;background:#fef3e8;color:#92400e;font-style:italic;border-radius:0 6px 6px 0}
                hr{border:none;border-top:1px solid #e5e7eb;margin:24px 0}
              </style>
              ${html}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
              <p style="margin:0 0 4px;font-weight:600;color:#6b7280;">Quality SMI — Sistema de Marketing para Internet</p>
              <p style="margin:0 0 8px;">
                <span style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:3px;padding:2px 6px;font-size:10px;color:#6b7280;font-weight:600;margin:0 2px;">Google Partner</span>
                <span style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:3px;padding:2px 6px;font-size:10px;color:#6b7280;font-weight:600;margin:0 2px;">Meta Partner</span>
              </p>
              <p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Cancelar inscrição</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${pixelTag}
</body>
</html>`;
  }
}
