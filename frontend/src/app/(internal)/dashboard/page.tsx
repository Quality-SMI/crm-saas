'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { Tooltip } from '@/components/ui/tooltip';
import { clientsApi } from '@/lib/api/clients';
import { Users, TrendingUp, UserPlus, BarChart2, Eye, EyeOff } from 'lucide-react';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'DIRECTOR', 'FINANCIAL'] as const;

interface Stats {
  activeClients: number;
  openLeads: number;
  mrr: number;
  newClientsThisMonth: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [mrrVisible, setMrrVisible] = useState(false);
  const canSeeMrr = user && (ALLOWED_ROLES as readonly string[]).includes(user.role);

  useEffect(() => {
    if (!canSeeMrr) return;
    clientsApi.dashboardStats().then(setStats).catch(() => {});
  }, [canSeeMrr]);

  const cards = [
    {
      label: 'Clientes ativos',
      value: stats ? stats.activeClients.toLocaleString('pt-BR') : '—',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      restricted: false,
      isMrr: false,
    },
    {
      label: 'Leads em aberto',
      value: stats ? stats.openLeads.toLocaleString('pt-BR') : '—',
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      restricted: false,
      isMrr: false,
    },
    {
      label: 'MRR (clientes ativos)',
      value: stats ? fmt(stats.mrr) : '—',
      icon: BarChart2,
      color: 'text-green-600',
      bg: 'bg-green-50',
      restricted: true,
      isMrr: true,
    },
    {
      label: 'Novos clientes este mês',
      value: stats ? stats.newClientsThisMonth.toLocaleString('pt-BR') : '—',
      icon: UserPlus,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      restricted: true,
      isMrr: false,
    },
  ].filter((c) => !c.restricted || canSeeMrr);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Bem-vindo ao CRM Quality SMI
          </p>
        </div>
        <Tooltip text="Encerrar a sessão atual">
          <button
            onClick={() => logout()}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Sair
          </button>
        </Tooltip>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
            <div className={`${c.bg} ${c.color} p-2.5 rounded-lg`}>
              <c.icon size={20} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 font-medium">{c.label}</p>
              {c.isMrr ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-2xl font-bold text-gray-900">
                    {mrrVisible ? c.value : '••••••'}
                  </p>
                  <button
                    onClick={() => setMrrVisible((v) => !v)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title={mrrVisible ? 'Ocultar MRR' : 'Mostrar MRR'}
                  >
                    {mrrVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              ) : (
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{c.value}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
