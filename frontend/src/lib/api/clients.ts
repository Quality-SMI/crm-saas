import apiClient from './client';
import type { AxiosResponse } from 'axios';

export interface ClientEmail {
  id: string;
  email: string;
  label: string | null;
  is_primary: boolean;
}

export interface ClientPhone {
  id: string;
  phone: string;
  label: string | null;
  is_primary: boolean;
}

export interface ClientServiceItem {
  id: string;
  service_type_id: string;
  service_type: { id: string; name: string; code: string | null };
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  contract_months: number | null;
  management_fee: string | null;
  media_budget: string | null;
  monthly_value: string | null;
  one_time_value: string | null;
  renewal_count: number;
  started_at: string | null;
  config: Record<string, unknown>;
}

export interface Client {
  id: string;
  company_name: string;
  legal_name: string | null;
  cnpj: string | null;
  domain: string;
  contact_name: string | null;
  status: 'ACTIVE' | 'PAYING' | 'CANCELLED' | 'RENEWED' | 'PAUSED' | 'FINISHED';
  segment: { id: string; name: string } | null;
  segment_id: string | null;
  market_segment: { id: string; name: string } | null;
  market_segment_id: string | null;
  business_model: { id: string; name: string } | null;
  business_model_id: string | null;
  company_size: { id: string; name: string } | null;
  company_size_id: string | null;
  tags: { id: string; tag: { id: string; name: string } }[];
  seller: { id: string; name: string } | null;
  seller_id: string | null;
  service_type: { id: string; name: string } | null;
  service_type_id: string | null;
  monthly_value: string | null;
  billing_type: string | null;
  contract_keywords_qty: number | null;
  contracted_at: string | null;
  contracted_keywords: string[];
  city: string | null;
  state: string | null;
  webhook_deploy: string | null;
  clarity_project_id: string | null;
  notes: string | null;
  emails: ClientEmail[];
  phones: ClientPhone[];
  services: ClientServiceItem[];
  created_at: string;
}

export interface PaginatedClients {
  data: Client[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClientsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  seller_id?: string;
  segment_id?: string;
  company_size_id?: string;
}

export interface ClientBody {
  company_name?: string;
  legal_name?: string;
  cnpj?: string;
  domain?: string;
  contact_name?: string;
  status?: string;
  segment_id?: string;
  market_segment_id?: string;
  business_model_id?: string;
  company_size_id?: string;
  tag_ids?: string[];
  seller_id?: string;
  technical_id?: string;
  service_type_id?: string;
  service_subtype_id?: string;
  monthly_value?: number;
  billing_type?: string;
  contract_keywords_qty?: number;
  contracted_at?: string;
  contracted_keywords?: string[];
  webhook_deploy?: string;
  clarity_project_id?: string | null;
  notes?: string;
  emails?: Partial<ClientEmail>[];
  phones?: Partial<ClientPhone>[];
  services?: Array<{
    id?: string;
    service_type_id: string;
    status?: string;
    contract_months?: number;
    management_fee?: number;
    media_budget?: number;
    monthly_value?: number;
    one_time_value?: number;
    renewal_count?: number;
    started_at?: string;
    config?: Record<string, unknown>;
  }>;
}

export const clientsApi = {
  list(params: ClientsQuery = {}): Promise<PaginatedClients> {
    return apiClient.get<PaginatedClients>('/clients', { params }).then((r: AxiosResponse<PaginatedClients>) => r.data);
  },

  get(id: string): Promise<{ data: Client }> {
    return apiClient.get<{ data: Client }>(`/clients/${id}`).then((r: AxiosResponse<{ data: Client }>) => r.data);
  },

  create(body: ClientBody): Promise<{ data: Client; message: string }> {
    return apiClient.post<{ data: Client; message: string }>('/clients', body).then((r: AxiosResponse<{ data: Client; message: string }>) => r.data);
  },

  update(id: string, body: ClientBody): Promise<{ data: Client; message: string }> {
    return apiClient.patch<{ data: Client; message: string }>(`/clients/${id}`, body).then((r: AxiosResponse<{ data: Client; message: string }>) => r.data);
  },

  updateKeywords(id: string, keywords: string[]): Promise<void> {
    return apiClient.patch(`/clients/${id}/keywords`, { keywords }).then(() => undefined);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/clients/${id}`).then(() => undefined);
  },

  countByPlan(): Promise<{ company_size_id: string | null; count: number }[]> {
    return apiClient.get<{ company_size_id: string | null; count: number }[]>('/clients/counts/by-plan').then((r) => r.data);
  },

  dashboardStats(): Promise<{ activeClients: number; openLeads: number; mrr: number; newClientsThisMonth: number }> {
    return apiClient.get('/clients/dashboard/stats').then((r) => r.data);
  },
};
