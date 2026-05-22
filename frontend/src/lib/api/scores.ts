import apiClient from './client';

export interface ClientScore {
  id: string;
  client_id: string;
  score: number;
  score_access: number;
  score_clicks: number;
  score_positioning: number;
  score_indexation: number;
  metadata: {
    currentImpressions: number;
    prevImpressions: number;
    currentClicks: number;
    prevClicks: number;
    latestSnapshotDate: string | null;
    pagesCount: number;
    avgPosition: number | null;
    hasPrevious: boolean;
  } | null;
  calculated_at: string;
}

export interface ScoreOverview {
  client_id: string;
  score: number;
  calculated_at: string;
}

export const scoresApi = {
  overview: () => apiClient.get<ScoreOverview[]>('/scores/overview').then((r) => r.data),
  latest: (clientId: string) => apiClient.get<ClientScore | null>(`/scores/clients/${clientId}/latest`).then((r) => r.data),
  history: (clientId: string) => apiClient.get<ClientScore[]>(`/scores/clients/${clientId}/history`).then((r) => r.data),
  recalculate: (clientId: string) => apiClient.post<ClientScore>(`/scores/clients/${clientId}/recalculate`).then((r) => r.data),
};
