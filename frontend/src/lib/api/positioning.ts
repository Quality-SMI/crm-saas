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

export interface KeywordChange {
  keyword: string;
  prev_position: number | null;
  curr_position: number | null;
  delta: number | null;
  type: 'improved' | 'declined' | 'new' | 'lost' | 'stable';
  curr_clicks: number;
  curr_impressions: number;
}

export interface MonthlyReport {
  id: string;
  client_id: string;
  report_month: string;
  curr_clicks: number;
  curr_impressions: number;
  curr_position: number | null;
  curr_ctr: number | null;
  curr_sessions: number;
  prev_clicks: number;
  prev_impressions: number;
  prev_position: number | null;
  prev_ctr: number | null;
  prev_sessions: number;
  keyword_changes: KeywordChange[];
  created_at: string;
}

export const positioningApi = {
  getSnapshots(clientId: string, days = 90): Promise<GscSnapshot[]> {
    return apiClient.get(`/positioning/${clientId}/snapshots`, { params: { days } }).then((r) => r.data);
  },
  getLatest(clientId: string, days = 90): Promise<GscSnapshot | null> {
    return apiClient.get(`/positioning/${clientId}/latest`, { params: { days } }).then((r) => r.data);
  },
  sync(clientId: string): Promise<{ message: string }> {
    return apiClient.post(`/positioning/${clientId}/sync`).then((r) => r.data);
  },

  syncAll(): Promise<{ message: string }> {
    return apiClient.post('/positioning/sync/all').then((r) => r.data);
  },

  configStatus(): Promise<{ configured: boolean; hasClientId: boolean; hasSecret: boolean; hasRefreshToken: boolean }> {
    return apiClient.get('/positioning/config/status').then((r) => r.data);
  },

  discoveryStatus(): Promise<{ total: number; gscLinked: number; ga4Linked: number; unlinked: number }> {
    return apiClient.get('/positioning/discovery/status').then((r) => r.data);
  },

  runDiscovery(): Promise<{ matched: number; gscMatched: number; ga4Matched: number; unmatched: string[] }> {
    return apiClient.post('/positioning/discovery/run').then((r) => r.data);
  },

  getLatestMonthlyReport(clientId: string): Promise<MonthlyReport | null> {
    return apiClient.get(`/positioning/${clientId}/monthly-reports/latest`).then((r) => r.data).catch(() => null);
  },

  generateMonthlyReport(clientId: string): Promise<{ message: string; report: MonthlyReport }> {
    return apiClient.post(`/positioning/${clientId}/monthly-reports/generate`).then((r) => r.data);
  },
};
