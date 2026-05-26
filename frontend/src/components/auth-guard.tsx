'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user, initUser } = useAuthStore();
  // Zustand persist hydrates from localStorage inside useEffect.
  // We wait one tick so the store has time to rehydrate before checking.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // isAuthenticated = true mas user não carregado (após refresh de página) —
    // buscar perfil do backend em vez de ler dados sensíveis do localStorage
    if (!user) {
      initUser();
    }
  }, [hydrated, isAuthenticated, user, initUser, router]);

  if (!hydrated || !isAuthenticated || !user) return null;
  return <>{children}</>;
}
