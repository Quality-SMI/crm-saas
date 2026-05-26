'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api/client';

export type UserRole =
  | 'SUPER_ADMIN' | 'DIRECTOR' | 'MANAGER'
  | 'FINANCIAL' | 'TECHNICAL' | 'WRITER' | 'SALES' | 'CLIENT_PORTAL';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  client_id: string | null;
  avatar_url: string | null;
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initUser: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  isInternal: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          const { user } = data.data;
          // Token vive em cookie HttpOnly — gerenciado pelo browser/backend.
          // Dados do usuário ficam apenas em memória (não persistidos no localStorage).
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          set({ user: null, isAuthenticated: false });
        }
      },

      // Chamado pelo AuthGuard após hidratação quando user é null mas isAuthenticated é true
      initUser: async () => {
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data.data, isAuthenticated: true });
        } catch {
          // Token inválido ou expirado — limpar estado
          set({ user: null, isAuthenticated: false });
        }
      },

      hasRole: (...roles) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        return roles.includes(user.role);
      },

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        return (user.permissions ?? []).includes(permission);
      },

      isInternal: () => {
        const { user } = get();
        return !!user && user.role !== 'CLIENT_PORTAL';
      },
    }),
    {
      name: 'crm-auth-v2',
      // Persistir apenas o flag de autenticação — dados do usuário (role, permissions)
      // são recarregados do backend via /auth/me para evitar exposição no localStorage
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
    },
  ),
);
