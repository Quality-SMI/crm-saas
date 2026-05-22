import apiClient from './client';
import type { AxiosResponse } from 'axios';

export type LeadStage = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';
export type LeadOrigin = 'WEBSITE' | 'REFERRAL' | 'COLD_CALL' | 'SOCIAL_MEDIA' | 'EVENT' | 'OTHER';
export type InteractionType = 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'STATUS_CHANGE';

export interface LeadInteraction {
  id: string;
  lead_id: string;
  user_id: string | null;
  user: { id: string; name: string } | null;
  type: InteractionType;
  description: string;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  stage: LeadStage;
  origin: LeadOrigin | null;
  estimated_value: string | null;
  street: string | null;
  state: string | null;
  notes: string | null;
  lost_reason: string | null;
  owner: { id: string; name: string } | null;
  owner_id: string | null;
  interactions: LeadInteraction[];
  created_at: string;
  updated_at: string;
}

export interface PaginatedLeads {
  data: Lead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeadsQuery {
  page?: number;
  limit?: number;
  search?: string;
  stage?: LeadStage;
  owner_id?: string;
}

export interface CreateLeadBody {
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  stage?: LeadStage;
  origin?: LeadOrigin;
  estimated_value?: number;
  street?: string;
  state: string;
  notes?: string;
  owner_id?: string;
}

export interface UpdateLeadBody {
  name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  stage?: LeadStage;
  origin?: LeadOrigin;
  estimated_value?: number;
  street?: string;
  state?: string;
  notes?: string;
  lost_reason?: string;
  owner_id?: string;
}

export const STAGE_LABELS: Record<LeadStage, string> = {
  NEW:         'Novo',
  QUALIFIED:   'Qualificado',
  PROPOSAL:    'Proposta',
  NEGOTIATION: 'Negociação',
  WON:         'Ganho',
  LOST:        'Perdido',
};

export const ORIGIN_LABELS: Record<LeadOrigin, string> = {
  WEBSITE:      'Site',
  REFERRAL:     'Indicação',
  COLD_CALL:    'Prospecção',
  SOCIAL_MEDIA: 'Redes Sociais',
  EVENT:        'Evento',
  OTHER:        'Outro',
};

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  CALL:          'Ligação',
  EMAIL:         'E-mail',
  MEETING:       'Reunião',
  NOTE:          'Nota',
  STATUS_CHANGE: 'Mudança de etapa',
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  NEW:         'bg-gray-100 text-gray-700',
  QUALIFIED:   'bg-blue-100 text-blue-700',
  PROPOSAL:    'bg-yellow-100 text-yellow-700',
  NEGOTIATION: 'bg-orange-100 text-orange-700',
  WON:         'bg-green-100 text-green-700',
  LOST:        'bg-red-100 text-red-700',
};

export const leadsApi = {
  list(params: LeadsQuery = {}): Promise<PaginatedLeads> {
    return apiClient.get<PaginatedLeads>('/leads', { params }).then((r: AxiosResponse<PaginatedLeads>) => r.data);
  },

  get(id: string): Promise<{ data: Lead }> {
    return apiClient.get<{ data: Lead }>(`/leads/${id}`).then((r: AxiosResponse<{ data: Lead }>) => r.data);
  },

  create(body: CreateLeadBody): Promise<{ data: Lead; message: string }> {
    return apiClient.post<{ data: Lead; message: string }>('/leads', body).then((r: AxiosResponse<{ data: Lead; message: string }>) => r.data);
  },

  update(id: string, body: UpdateLeadBody): Promise<{ data: Lead; message: string }> {
    return apiClient.patch<{ data: Lead; message: string }>(`/leads/${id}`, body).then((r: AxiosResponse<{ data: Lead; message: string }>) => r.data);
  },

  addInteraction(id: string, type: InteractionType, description: string): Promise<{ data: LeadInteraction }> {
    return apiClient.post<{ data: LeadInteraction }>(`/leads/${id}/interactions`, { type, description }).then((r: AxiosResponse<{ data: LeadInteraction }>) => r.data);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/leads/${id}`).then(() => undefined);
  },

  statsByStage(): Promise<{ data: Record<LeadStage, number> }> {
    return apiClient.get<{ data: Record<LeadStage, number> }>('/leads/stats/by-stage').then((r: AxiosResponse<{ data: Record<LeadStage, number> }>) => r.data);
  },
};
