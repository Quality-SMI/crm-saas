import apiClient from './client';

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'PAUSED' | 'CANCELLED';
export type AudienceType =
  | 'all_clients'
  | 'active_clients'
  | 'all_leads'
  | 'new_leads'
  | 'qualified_leads'
  | 'proposal_leads'
  | 'negotiation_leads'
  | 'won_leads'
  | 'lost_leads'
  | 'manual'
  | 'seo_blast_all_leads'
  | 'seo_blast_new_leads'
  | 'seo_blast_qualified_leads'
  | 'seo_blast_all_active_leads';

export interface EmailAttachment {
  name: string;
  content: string;
  type: string;
}

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  preview_text: string | null;
  html_body: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  audience_type: AudienceType;
  audience_filters: Record<string, unknown>;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  sent_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
  unsubscribe_count: number;
  template_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  attachments: EmailAttachment[];
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  preview_text: string | null;
  html_body: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface EmailRecipient {
  id: string;
  campaign_id: string;
  email: string;
  name: string | null;
  recipient_type: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounce_reason: string | null;
}

export interface AudiencePreview {
  email: string;
  name: string | null;
  type: 'client' | 'lead';
  id: string;
}

export interface EmailUnsubscribe {
  id: string;
  email: string;
  reason: string | null;
  created_at: string;
}

export const emailMarketingApi = {
  // Campaigns
  listCampaigns(): Promise<EmailCampaign[]> {
    return apiClient.get<{ data: EmailCampaign[] }>('/email-marketing/campaigns').then((r) => r.data.data);
  },
  getCampaign(id: string): Promise<EmailCampaign> {
    return apiClient.get<{ data: EmailCampaign }>(`/email-marketing/campaigns/${id}`).then((r) => r.data.data);
  },
  createCampaign(data: Partial<EmailCampaign>): Promise<EmailCampaign> {
    return apiClient.post<{ data: EmailCampaign }>('/email-marketing/campaigns', data).then((r) => r.data.data);
  },
  updateCampaign(id: string, data: Partial<EmailCampaign>): Promise<EmailCampaign> {
    return apiClient.patch<{ data: EmailCampaign }>(`/email-marketing/campaigns/${id}`, data).then((r) => r.data.data);
  },
  deleteCampaign(id: string): Promise<void> {
    return apiClient.delete(`/email-marketing/campaigns/${id}`).then(() => undefined);
  },
  sendCampaign(id: string, opts?: { limit?: number; offset?: number }): Promise<{ message: string }> {
    return apiClient.post<{ data: { message: string } }>(`/email-marketing/campaigns/${id}/send`, opts ?? {}).then((r) => r.data.data);
  },
  getRecipients(id: string, params?: { limit?: number; offset?: number }): Promise<{ data: EmailRecipient[]; total: number }> {
    return apiClient
      .get<{ data: { data: EmailRecipient[]; total: number } }>(`/email-marketing/campaigns/${id}/recipients`, { params })
      .then((r) => r.data.data);
  },

  // Audience
  previewAudience(audienceType: AudienceType, filters?: Record<string, unknown>): Promise<AudiencePreview[]> {
    return apiClient
      .get<{ data: AudiencePreview[] }>('/email-marketing/audience/preview', {
        params: {
          audience_type: audienceType,
          ...(filters ? { filters: JSON.stringify(filters) } : {}),
        },
      })
      .then((r) => r.data.data);
  },

  // Templates
  listTemplates(): Promise<EmailTemplate[]> {
    return apiClient.get<{ data: EmailTemplate[] }>('/email-marketing/templates').then((r) => r.data.data);
  },
  createTemplate(data: Partial<EmailTemplate>): Promise<EmailTemplate> {
    return apiClient.post<{ data: EmailTemplate }>('/email-marketing/templates', data).then((r) => r.data.data);
  },
  updateTemplate(id: string, data: Partial<EmailTemplate>): Promise<EmailTemplate> {
    return apiClient.patch<{ data: EmailTemplate }>(`/email-marketing/templates/${id}`, data).then((r) => r.data.data);
  },
  deleteTemplate(id: string): Promise<void> {
    return apiClient.delete(`/email-marketing/templates/${id}`).then(() => undefined);
  },

  // SEO Blast
  sendSeoBlast(data: {
    name: string;
    subject: string;
    from_name?: string;
    from_email: string;
    reply_to?: string;
    audience_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ campaignId: string; message: string }> {
    return apiClient
      .post<{ data: { campaignId: string; message: string } }>('/email-marketing/seo-blast', data)
      .then((r) => r.data.data);
  },
  previewSeoBlastAudience(audienceType: string): Promise<{ total: number; withSite: number }> {
    return apiClient
      .get<{ data: { total: number; withSite: number } }>('/email-marketing/seo-blast/preview', {
        params: { audience_type: audienceType },
      })
      .then((r) => r.data.data);
  },

  // Unsubscribes
  listUnsubscribes(): Promise<EmailUnsubscribe[]> {
    return apiClient.get<{ data: EmailUnsubscribe[] }>('/email-marketing/unsubscribes').then((r) => r.data.data);
  },
  removeUnsubscribe(email: string): Promise<void> {
    return apiClient.delete(`/email-marketing/unsubscribes/${encodeURIComponent(email)}`).then(() => undefined);
  },
  publicUnsubscribe(email: string, reason?: string): Promise<void> {
    return apiClient.post('/email-marketing/webhooks/unsubscribe', { email, reason }).then(() => undefined);
  },
};
