import apiClient from './client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export const notificationsApi = {
  list(): Promise<Notification[]> {
    return apiClient.get<{ data: Notification[] }>('/notifications').then(r => r.data.data);
  },
  unreadCount(): Promise<number> {
    return apiClient.get<{ data: { count: number } }>('/notifications/unread-count').then(r => r.data.data.count);
  },
  markRead(id: string): Promise<void> {
    return apiClient.patch(`/notifications/${id}/read`).then(() => undefined);
  },
  markAllRead(): Promise<void> {
    return apiClient.patch('/notifications/read-all').then(() => undefined);
  },
};
