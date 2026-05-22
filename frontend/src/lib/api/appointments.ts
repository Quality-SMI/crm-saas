import apiClient from './client';
import type { AxiosResponse } from 'axios';

export type AppointmentStatus = 'PENDING' | 'DONE' | 'CANCELLED';

export interface Appointment {
  id: string;
  lead_id: string;
  lead: { id: string; name: string } | null;
  scheduled_at: string;
  scheduled_by_id: string | null;
  scheduled_by: { id: string; name: string } | null;
  assigned_to_id: string | null;
  assigned_to: { id: string; name: string } | null;
  status: AppointmentStatus;
  duration_minutes: number | null;
  notes: string | null;
  meet_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedAppointments {
  data: Appointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AppointmentsQuery {
  assigned_to_id?: string;
  lead_id?: string;
  status?: AppointmentStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface CreateAppointmentBody {
  lead_id: string;
  scheduled_at: string;
  assigned_to_id?: string;
  duration_minutes?: number;
  notes?: string;
}

export interface UpdateAppointmentBody {
  scheduled_at?: string;
  assigned_to_id?: string;
  status?: AppointmentStatus;
  duration_minutes?: number;
  notes?: string;
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING:   'Pendente',
  DONE:      'Realizada',
  CANCELLED: 'Cancelada',
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  DONE:      'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export const appointmentsApi = {
  list(params: AppointmentsQuery = {}): Promise<PaginatedAppointments> {
    return apiClient.get<PaginatedAppointments>('/appointments', { params })
      .then((r: AxiosResponse<PaginatedAppointments>) => r.data);
  },

  get(id: string): Promise<{ data: Appointment }> {
    return apiClient.get<{ data: Appointment }>(`/appointments/${id}`)
      .then((r: AxiosResponse<{ data: Appointment }>) => r.data);
  },

  create(body: CreateAppointmentBody): Promise<{ data: Appointment; message: string }> {
    return apiClient.post<{ data: Appointment; message: string }>('/appointments', body)
      .then((r: AxiosResponse<{ data: Appointment; message: string }>) => r.data);
  },

  update(id: string, body: UpdateAppointmentBody): Promise<{ data: Appointment; message: string }> {
    return apiClient.patch<{ data: Appointment; message: string }>(`/appointments/${id}`, body)
      .then((r: AxiosResponse<{ data: Appointment; message: string }>) => r.data);
  },

  remove(id: string): Promise<void> {
    return apiClient.delete(`/appointments/${id}`).then(() => undefined);
  },
};
