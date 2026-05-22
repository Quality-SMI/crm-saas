import axios from 'axios';

// URL relativa em prod (NGINX proxy /api → backend) e em dev (next.config.ts rewrites).
// Permite override via NEXT_PUBLIC_API_URL caso queira apontar para outro host.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  withCredentials: true, // envia HttpOnly cookies access_token / refresh_token
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  failedQueue = [];
};

// Renova access_token automaticamente quando expira (401)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthRoute =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/forgot-password') ||
      original?.url?.includes('/auth/reset-password');
    if (error.response?.status !== 401 || original._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => api(original));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      await api.post('/auth/refresh');
      processQueue(null);
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
