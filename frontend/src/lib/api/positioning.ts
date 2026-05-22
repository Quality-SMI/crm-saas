import apiClient from './client';

export interface GscSnapshot {
  id: string;
  client_id: string;
  date: string;
  total_clicks: number;
  total_impressions: number;
  avg_position: number | null;
  avg_ctr: number | null;
  keywords: { query: string; clicks: number; impressions: number; position: number; ctr: number }[];
  pages: { page: string; clicks: number; impressions: number; position: number }[];
  sessions: number;
  users: number;
  synced_at: string;
  created_at: string;
}

export const positioningApi = {
  getSnapshots(clientId: string, days = 90): Promise<GscSnapshot[]> {
    return apiClient.get(`/positioning/${clientId}/snapshots`, { params: { days } }).then((r) => r.data);
  },
  getLatest(clientId: string): Promise<GscSnapshot | null> {
    return apiClient.get(`/positioning/${clientId}/latest`).then((r) => r.data);
  },
  sync(clientId: string): Promise<{ message: string }> {
    return apiClient.post(`/positioning/${clientId}/sync`).then((r) => r.data);
  },

  syncAll(): Promise<{ message: string }> {
    return apiClient.post('/positioning/sync/all').then((r) => r.data);
  },

  discoveryStatus(): Promise<{ total: number; gscLinked: number; ga4Linked: number; unlinked: number }> {
    return apiClient.get('/positioning/discovery/status').then((r) => r.data);
  },

  runDiscovery(): Promise<{ matched: number; gscMatched: number; ga4Matched: number; unmatched: string[] }> {
    return apiClient.post('/positioning/discovery/run').then((r) => r.data);
  },
};
