import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface AudienceMember {
  email: string;
  name: string | null;
  type: 'client' | 'lead';
  id: string;
}

export interface EmailAttachment {
  name: string;
  content: string;
  type: string;
}

export interface CreateCampaignDto {
  name: string;
  subject: string;
  preview_text?: string;
  html_body: string;
  from_name?: string;
  from_email: string;
  reply_to?: string;
  audience_type?: string;
  audience_filters?: Record<string, unknown>;
  template_id?: string;
  scheduled_at?: string;
  attachments?: EmailAttachment[];
}

export interface UpdateCampaignDto {
  name?: string;
  subject?: string;
  preview_text?: string;
  html_body?: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  audience_type?: string;
  audience_filters?: Record<string, unknown>;
  template_id?: string;
  scheduled_at?: string;
  status?: string;
  attachments?: EmailAttachment[];
}

export interface CreateTemplateDto {
  name: string;
  subject: string;
  preview_text?: string;
  html_body: string;
  category?: string;
}

export interface UpdateTemplateDto {
  name?: string;
  subject?: string;
  preview_text?: string;
  html_body?: string;
  category?: string;
}

@Injectable()
export class EmailMarketingService {
  constructor(private readonly dataSource: DataSource) {}

  async listCampaigns(userId: string): Promise<unknown[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM crm.email_campaigns WHERE deleted_at IS NULL ORDER BY created_at DESC`,
    );
    return rows;
  }

  async getCampaign(id: string): Promise<unknown> {
    const rows = await this.dataSource.query(
      `SELECT c.*,
         (SELECT COUNT(*) FROM crm.email_campaign_recipients r WHERE r.campaign_id = c.id) AS recipient_count
       FROM crm.email_campaigns c
       WHERE c.id = $1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException('Campanha não encontrada');
    return rows[0];
  }

  async createCampaign(
    dto: CreateCampaignDto,
    userId: string,
  ): Promise<unknown> {
    const rows = await this.dataSource.query(
      `INSERT INTO crm.email_campaigns
         (name, subject, preview_text, html_body, from_name, from_email, reply_to,
          audience_type, audience_filters, template_id, scheduled_at, created_by, attachments)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        dto.name,
        dto.subject,
        dto.preview_text ?? null,
        dto.html_body,
        dto.from_name ?? 'Quality SMI',
        dto.from_email,
        dto.reply_to ?? null,
        dto.audience_type ?? 'all_clients',
        JSON.stringify(dto.audience_filters ?? {}),
        dto.template_id ?? null,
        dto.scheduled_at ?? null,
        userId,
        JSON.stringify(dto.attachments ?? []),
      ],
    );
    return rows[0];
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto): Promise<unknown> {
    await this.getCampaign(id);

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const addField = (col: string, val: unknown) => {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    };

    if (dto.name !== undefined) addField('name', dto.name);
    if (dto.subject !== undefined) addField('subject', dto.subject);
    if (dto.preview_text !== undefined)
      addField('preview_text', dto.preview_text);
    if (dto.html_body !== undefined) addField('html_body', dto.html_body);
    if (dto.from_name !== undefined) addField('from_name', dto.from_name);
    if (dto.from_email !== undefined) addField('from_email', dto.from_email);
    if (dto.reply_to !== undefined) addField('reply_to', dto.reply_to);
    if (dto.audience_type !== undefined)
      addField('audience_type', dto.audience_type);
    if (dto.audience_filters !== undefined)
      addField('audience_filters', JSON.stringify(dto.audience_filters));
    if (dto.template_id !== undefined) addField('template_id', dto.template_id);
    if (dto.scheduled_at !== undefined)
      addField('scheduled_at', dto.scheduled_at);
    if (dto.status !== undefined) addField('status', dto.status);
    if (dto.attachments !== undefined)
      addField('attachments', JSON.stringify(dto.attachments));

    if (!fields.length) {
      return this.getCampaign(id);
    }

    addField('updated_at', new Date());
    values.push(id);

    const rows = await this.dataSource.query(
      `UPDATE crm.email_campaigns SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return rows[0];
  }

  async deleteCampaign(id: string): Promise<void> {
    await this.getCampaign(id);
    await this.dataSource.query(
      `UPDATE crm.email_campaigns SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async previewAudience(
    audienceType: string,
    filters: Record<string, unknown> = {},
  ): Promise<AudienceMember[]> {
    let rows: AudienceMember[] = [];

    switch (audienceType) {
      case 'all_clients':
      case 'active_clients':
        rows = await this.dataSource.query(
          `SELECT email, company_name AS name, id, 'client' AS type
           FROM crm.clients
           WHERE deleted_at IS NULL AND email IS NOT NULL AND email != ''`,
        );
        break;

      case 'all_leads':
        rows = await this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''`,
        );
        break;

      case 'new_leads':
        rows = await this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'NEW'`,
        );
        break;

      case 'qualified_leads':
        rows = await this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'QUALIFIED'`,
        );
        break;

      case 'won_leads':
        rows = await this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'WON'`,
        );
        break;

      case 'lost_leads':
        rows = await this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'LOST'`,
        );
        break;

      case 'proposal_leads':
        rows = await this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'PROPOSAL'`,
        );
        break;

      case 'negotiation_leads':
        rows = await this.dataSource.query(
          `SELECT contact_email AS email, COALESCE(contact_name, name) AS name, id, 'lead' AS type
           FROM crm.leads
           WHERE deleted_at IS NULL AND contact_email IS NOT NULL AND contact_email != ''
             AND stage = 'NEGOTIATION'`,
        );
        break;

      case 'manual': {
        const emails: string[] = Array.isArray(filters['emails'])
          ? (filters['emails'] as string[])
          : [];
        return emails
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes('@'))
          .map((email, i) => ({
            email,
            name: null,
            type: 'lead' as const,
            id: `manual_${i}`,
          }));
      }

      default:
        rows = [];
    }

    return rows;
  }

  async listTemplates(): Promise<unknown[]> {
    return this.dataSource.query(
      `SELECT * FROM crm.email_templates WHERE deleted_at IS NULL ORDER BY created_at DESC`,
    );
  }

  async createTemplate(
    dto: CreateTemplateDto,
    userId: string,
  ): Promise<unknown> {
    const rows = await this.dataSource.query(
      `INSERT INTO crm.email_templates (name, subject, preview_text, html_body, category, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        dto.name,
        dto.subject,
        dto.preview_text ?? null,
        dto.html_body,
        dto.category ?? 'custom',
        userId,
      ],
    );
    return rows[0];
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto): Promise<unknown> {
    const existing = await this.dataSource.query(
      `SELECT id FROM crm.email_templates WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!existing.length)
      throw new NotFoundException('Template não encontrado');

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const addField = (col: string, val: unknown) => {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    };

    if (dto.name !== undefined) addField('name', dto.name);
    if (dto.subject !== undefined) addField('subject', dto.subject);
    if (dto.preview_text !== undefined)
      addField('preview_text', dto.preview_text);
    if (dto.html_body !== undefined) addField('html_body', dto.html_body);
    if (dto.category !== undefined) addField('category', dto.category);

    if (!fields.length) return existing[0];

    addField('updated_at', new Date());
    values.push(id);

    const rows = await this.dataSource.query(
      `UPDATE crm.email_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return rows[0];
  }

  async deleteTemplate(id: string): Promise<void> {
    const existing = await this.dataSource.query(
      `SELECT id FROM crm.email_templates WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!existing.length)
      throw new NotFoundException('Template não encontrado');
    await this.dataSource.query(
      `UPDATE crm.email_templates SET deleted_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async getCampaignRecipients(
    campaignId: string,
    opts: { limit: number; offset: number },
  ): Promise<{ data: unknown[]; total: number }> {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    const [rows, countRows] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM crm.email_campaign_recipients
         WHERE campaign_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [campaignId, limit, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) AS total FROM crm.email_campaign_recipients WHERE campaign_id = $1`,
        [campaignId],
      ),
    ]);

    return { data: rows, total: Number(countRows[0]?.total ?? 0) };
  }

  async getCampaignStats(campaignId: string): Promise<unknown> {
    const rows = await this.dataSource.query(
      `SELECT c.*,
         (SELECT COUNT(*) FROM crm.email_campaign_recipients r WHERE r.campaign_id = c.id) AS recipient_count,
         (SELECT COUNT(*) FROM crm.email_campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'OPENED') AS opened_count,
         (SELECT COUNT(*) FROM crm.email_campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'CLICKED') AS clicked_total,
         (SELECT COUNT(*) FROM crm.email_campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'BOUNCED') AS bounced_total,
         (SELECT COUNT(*) FROM crm.email_campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'FAILED') AS failed_total
       FROM crm.email_campaigns c
       WHERE c.id = $1`,
      [campaignId],
    );
    if (!rows.length) throw new NotFoundException('Campanha não encontrada');
    return rows[0];
  }

  async listUnsubscribes(): Promise<unknown[]> {
    return this.dataSource.query(
      `SELECT * FROM crm.email_unsubscribes ORDER BY created_at DESC`,
    );
  }

  async removeUnsubscribe(email: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM crm.email_unsubscribes WHERE email = $1`,
      [email],
    );
  }

  async addUnsubscribe(email: string, reason?: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO crm.email_unsubscribes (email, reason)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [email.toLowerCase().trim(), reason ?? null],
    );
  }
}
