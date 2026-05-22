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
          // Token agora vive em cookie HttpOnly — gerenciado pelo browser/backend.
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
      name: 'crm-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
