import apiClient from './client';
import type { AxiosResponse } from 'axios';

export interface ApiKey {
  id: string;
  client_id: string;
  name: string;
  key: string;
  is_active: boolean;
  created_at: string;
}

export const apiKeysApi = {
  list(clientId: string): Promise<ApiKey[]> {
    return apiClient
      .get<{ data: ApiKey[] }>(`/api-keys/clients/${clientId}`)
      .then((r: AxiosResponse<{ data: ApiKey[] }>) => r.data.data);
  },

  create(clientId: string, name: string): Promise<ApiKey> {
    return apiClient
      .post<{ data: ApiKey }>(`/api-keys/clients/${clientId}`, { name })
      .then((r: AxiosResponse<{ data: ApiKey }>) => r.data.data);
  },

  update(id: string, body: { name?: string; is_active?: boolean }): Promise<ApiKey> {
    return apiClient
      .patch<{ data: ApiKey }>(`/api-keys/${id}`, body)
      .then((r: AxiosResponse<{ data: ApiKey }>) => r.data.data);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/api-keys/${id}`).then(() => undefined);
  },
};
