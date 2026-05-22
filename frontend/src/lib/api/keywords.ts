import apiClient from './client';
import type { AxiosResponse } from 'axios';

export interface KeywordCategory {
  id: string;
  name: string;
  client_id: string;
  created_at: string;
}

export interface ClientKeyword {
  id: string;
  client_id: string;
  keyword: string;
  slug: string | null;
  category_id: string | null;
  category: KeywordCategory | null;
  is_active: boolean;
  created_at: string;
}

const wrap = <T>(r: AxiosResponse<{ data: T }>) => r.data.data;

export const keywordsApi = {
  list(clientId: string): Promise<ClientKeyword[]> {
    return apiClient.get(`/keywords/clients/${clientId}`).then(wrap<ClientKeyword[]>);
  },
  create(clientId: string, body: { keyword: string; slug?: string; category_id?: string }): Promise<ClientKeyword> {
    return apiClient.post(`/keywords/clients/${clientId}`, body).then(wrap<ClientKeyword>);
  },
  bulkCreate(clientId: string, body: { keywords: string[]; category_id?: string }): Promise<ClientKeyword[]> {
    return apiClient.post(`/keywords/clients/${clientId}/bulk`, body).then(wrap<ClientKeyword[]>);
  },
  update(id: string, body: { keyword?: string; slug?: string; category_id?: string; is_active?: boolean }): Promise<ClientKeyword> {
    return apiClient.patch(`/keywords/${id}`, body).then(wrap<ClientKeyword>);
  },
  remove(id: string): Promise<void> {
    return apiClient.delete(`/keywords/${id}`).then(() => undefined);
  },
  listCategories(clientId: string): Promise<KeywordCategory[]> {
    return apiClient.get(`/keywords/clients/${clientId}/categories`).then(wrap<KeywordCategory[]>);
  },
  createCategory(clientId: string, body: { name: string }): Promise<KeywordCategory> {
    return apiClient.post(`/keywords/clients/${clientId}/categories`, body).then(wrap<KeywordCategory>);
  },
  removeCategory(id: string): Promise<void> {
    return apiClient.delete(`/keywords/categories/${id}`).then(() => undefined);
  },
};
