import apiClient from './client';
import type { AxiosResponse } from 'axios';

export interface LookupItem {
  id: string;
  name: string;
  code?: string;
  sort_order?: number;
}

export const lookupApi = {
  segments(): Promise<LookupItem[]> {
    return apiClient.get<LookupItem[]>('/lookup/segments').then((r: AxiosResponse<LookupItem[]>) => r.data);
  },
  serviceTypes(): Promise<LookupItem[]> {
    return apiClient.get<LookupItem[]>('/lookup/service-types').then((r: AxiosResponse<LookupItem[]>) => r.data);
  },
  serviceSubtypes(serviceTypeId?: string): Promise<LookupItem[]> {
    return apiClient
      .get<LookupItem[]>('/lookup/service-subtypes', { params: { service_type_id: serviceTypeId } })
      .then((r: AxiosResponse<LookupItem[]>) => r.data);
  },
  hostingTypes(): Promise<LookupItem[]> {
    return apiClient.get<LookupItem[]>('/lookup/hosting-types').then((r: AxiosResponse<LookupItem[]>) => r.data);
  },
  marketSegments(): Promise<LookupItem[]> {
    return apiClient.get<LookupItem[]>('/lookup/market-segments').then((r: AxiosResponse<LookupItem[]>) => r.data);
  },
  businessModels(): Promise<LookupItem[]> {
    return apiClient.get<LookupItem[]>('/lookup/business-models').then((r: AxiosResponse<LookupItem[]>) => r.data);
  },
  companySizes(): Promise<LookupItem[]> {
    return apiClient.get<LookupItem[]>('/lookup/company-sizes').then((r: AxiosResponse<LookupItem[]>) => r.data);
  },
  tags(search?: string): Promise<LookupItem[]> {
    return apiClient
      .get<LookupItem[]>('/lookup/tags', { params: search ? { search } : {} })
      .then((r: AxiosResponse<LookupItem[]>) => r.data);
  },
};
