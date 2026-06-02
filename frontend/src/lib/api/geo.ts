import apiClient from './client';
import type { AxiosResponse } from 'axios';

export interface AiPlatform {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  is_active: boolean;
}

export interface AiQuery {
  id: string;
  client_id: string;
  prompt: string;
  category: string | null;
  platform_ids: string[];
  is_active: boolean;
  last_run_at: string | null;
  last_result: boolean | null;
  created_at: string;
}

export interface AioMetadata {
  query: string;
  ai_overview_simulado: string;
  principais_entidades: string[];
  fontes_citadas: string[];
  intencao_de_busca: string;
  topicos_recorrentes: string[];
  oportunidades_geo: string[];
  padroes_semanticos: string[];
  observacao: string;
}

export interface AiMention {
  id: string;
  client_id: string;
  platform_id: string;
  platform: AiPlatform;
  query_id: string | null;
  query: AiQuery | null;
  mention_type: 'DIRECT' | 'INDIRECT' | 'CITATION' | 'RECOMMENDATION';
  response_excerpt: string | null;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | null;
  sentiment_score: string | null;
  ranking_position: number | null;
  visibility_impact: string | null;
  urls_cited: string[];
  geo_metadata: AioMetadata | null;
  checked_at: string;
  created_at: string;
}

export interface AiSource {
  id: string;
  domain: string;
  citation_count: number;
  authority_score: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface AiCompetitor {
  id: string;
  client_id: string;
  competitor_name: string;
  competitor_domain: string | null;
  is_active: boolean;
  created_at: string;
}

export interface GeoOverview {
  visibility_score: number | null;
  geo_score: number | null;
  mention_count: number;
  active_queries: number;
  source_count: number;
  competitor_count: number;
  sentiment: { POSITIVE: number; NEUTRAL: number; NEGATIVE: number };
  platforms: { name: string; count: number }[];
  last_updated: string | null;
}

const wrap = <T>(r: AxiosResponse<{ data: T }>) => r.data.data;

export const geoApi = {
  platforms(): Promise<AiPlatform[]> {
    return apiClient.get<{ data: AiPlatform[] }>('/geo/platforms').then(wrap);
  },

  overview(clientId: string): Promise<GeoOverview> {
    return apiClient.get<{ data: GeoOverview }>(`/geo/clients/${clientId}/overview`).then(wrap);
  },

  // Queries
  listQueries(clientId: string): Promise<AiQuery[]> {
    return apiClient.get<{ data: AiQuery[] }>(`/geo/clients/${clientId}/queries`).then(wrap);
  },
  createQuery(clientId: string, body: { prompt: string; category?: string; platform_ids?: string[] }): Promise<AiQuery> {
    return apiClient.post<{ data: AiQuery }>(`/geo/clients/${clientId}/queries`, body).then(wrap);
  },
  updateQuery(clientId: string, id: string, body: { prompt?: string; category?: string; is_active?: boolean }): Promise<AiQuery> {
    return apiClient.put<{ data: AiQuery }>(`/geo/clients/${clientId}/queries/${id}`, body).then(wrap);
  },
  deleteQuery(clientId: string, id: string): Promise<void> {
    return apiClient.delete(`/geo/clients/${clientId}/queries/${id}`).then(() => undefined);
  },

  // Mentions
  listMentions(clientId: string, params?: { platform_id?: string; sentiment?: string; limit?: number; offset?: number }): Promise<{ data: AiMention[]; total: number }> {
    return apiClient.get<{ data: { data: AiMention[]; total: number } }>(`/geo/clients/${clientId}/mentions`, { params }).then(wrap);
  },
  createMention(clientId: string, body: {
    platform_id: string;
    query_id?: string;
    mention_type?: string;
    response_excerpt?: string;
    sentiment?: string;
    sentiment_score?: number;
    ranking_position?: number;
    urls_cited?: string[];
    checked_at?: string;
  }): Promise<AiMention> {
    return apiClient.post<{ data: AiMention }>(`/geo/clients/${clientId}/mentions`, body).then(wrap);
  },
  deleteMention(clientId: string, id: string): Promise<void> {
    return apiClient.delete(`/geo/clients/${clientId}/mentions/${id}`).then(() => undefined);
  },

  // Sources
  listSources(clientId: string): Promise<AiSource[]> {
    return apiClient.get<{ data: AiSource[] }>(`/geo/clients/${clientId}/sources`).then(wrap);
  },

  // Competitors
  listCompetitors(clientId: string): Promise<AiCompetitor[]> {
    return apiClient.get<{ data: AiCompetitor[] }>(`/geo/clients/${clientId}/competitors`).then(wrap);
  },
  createCompetitor(clientId: string, body: { competitor_name: string; competitor_domain?: string }): Promise<AiCompetitor> {
    return apiClient.post<{ data: AiCompetitor }>(`/geo/clients/${clientId}/competitors`, body).then(wrap);
  },
  deleteCompetitor(clientId: string, id: string): Promise<void> {
    return apiClient.delete(`/geo/clients/${clientId}/competitors/${id}`).then(() => undefined);
  },

  // Timeline
  timeline(clientId: string): Promise<Array<{ score_date: string; visibility_score: string; geo_score: string; mention_count: string }>> {
    return apiClient.get<{ data: Array<{ score_date: string; visibility_score: string; geo_score: string; mention_count: string }> }>(`/geo/clients/${clientId}/timeline`).then(wrap);
  },

  // Runner (automação LLM) — retorna imediatamente, análise roda em background
  run(clientId: string): Promise<{ started: boolean }> {
    return apiClient.post<{ data: { started: boolean } }>(`/geo/clients/${clientId}/run`).then(wrap);
  },
};
