'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Building2, Globe, Phone, ChevronLeft, ChevronRight } from 'lucide-react';
import { clientsApi, Client } from '@/lib/api/clients';
import { scoresApi, ScoreOverview } from '@/lib/api/scores';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Tooltip } from '@/components/ui/tooltip';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVE:    { label: 'Ativo',      color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelado',  color: 'bg-red-100 text-red-700' },
  RENEWED:   { label: 'Renovado',   color: 'bg-purple-100 text-purple-700' },
  PAUSED:    { label: 'Pausado',    color: 'bg-yellow-100 text-yellow-700' },
  FINISHED:  { label: 'Encerrado', color: 'bg-gray-100 text-gray-600' },
  PAYING:    { label: 'Ativo',      color: 'bg-green-100 text-green-700' },
};

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [planCounts, setPlanCounts] = useState<Record<string, number>>({});
  const [limit, setLimit] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clients_limit');
      return saved ? Number(saved) : 20;
    }
    return 20;
  });
  const [loading, setLoading] = useState(true);
  const [scoreMap, setScoreMap] = useState<Record<string, number>>({});

  const PLANS = [
    { label: 'Todos',     id: '' },
    { label: 'Silver',    id: 'e9978d91-ec42-44e5-9afa-7a298d872c25' },
    { label: 'Gold',      id: '6f4144d8-55b4-486b-a7c9-c4c1a0974010' },
    { label: 'Diamond',   id: 'f3934adb-2208-46d9-803d-eff4dddad95b' },
    { label: 'Parceiros', id: '39d3e744-88bb-4c99-8144-4b3c040c99ee' },
  ];

  const loadCounts = useCallback(() => {
    clientsApi.countByPlan().then((rows) => {
      const map: Record<string, number> = {};
      rows.forEach((r) => { if (r.company_size_id) map[r.company_size_id] = r.count; });
      setPlanCounts(map);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientsApi.list({ page, limit, search: search || undefined, status: status || undefined, company_size_id: plan || undefined });
      setClients(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      scoresApi.overview().then((rows: ScoreOverview[]) => {
        const map: Record<string, number> = {};
        rows.forEach((r: ScoreOverview) => { map[r.client_id] = Number(r.score); });
        setScoreMap(map);
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status, plan]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} clientes cadastrados</p>
        </div>
        <Tooltip text="Cadastrar um novo cliente no sistema">
          <Link
            href="/clients/new"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Novo cliente
          </Link>
        </Tooltip>
      </div>

      {/* Plan filter buttons */}
      <div className="flex gap-2 mb-4">
        {PLANS.map((p) => (
          <Tooltip
            key={p.id}
            text={p.id === '' ? 'Mostrar clientes de todos os planos' : `Filtrar clientes do plano ${p.label}`}
          >
            <button
              onClick={() => { setPlan(p.id); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                plan === p.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.id ? `${p.label} (${planCounts[p.id] ?? 0})` : p.label}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-60">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por empresa, domínio ou contato..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Tooltip text="Buscar clientes pelo nome, domínio ou contato">
            <button type="submit" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 rounded-lg transition-colors">
              Buscar
            </button>
          </Tooltip>
        </form>

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="CANCELLED">Cancelado</option>
          <option value="RENEWED">Renovado</option>
          <option value="PAUSED">Pausado</option>
          <option value="FINISHED">Encerrado</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Carregando...
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Building2 size={32} className="mb-3 opacity-30" />
            <p className="text-sm">Nenhum cliente encontrado</p>
            {search && (
              <Tooltip text="Remover o filtro de busca">
                <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="mt-2 text-xs text-blue-600 hover:underline">
                  Limpar busca
                </button>
              </Tooltip>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide w-10">#</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Empresa</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Domínio</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Contato</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Serviço</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Valor</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Score</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => {
                const st = STATUS_LABEL[c.status] ?? { label: c.status, color: 'bg-gray-100 text-gray-600' };
                const primaryPhone = c.phones?.find((p) => p.is_primary) ?? c.phones?.[0];
                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/clients/${c.id}`)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 text-xs text-gray-400 tabular-nums">
                      {(page - 1) * limit + i + 1}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{c.company_name}</p>
                      {c.segment && <p className="text-xs text-gray-400 mt-0.5">{c.segment.name}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-1 text-gray-600">
                        <Globe size={13} className="opacity-50" />
                        {c.domain}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-gray-700">{c.contact_name ?? '—'}</p>
                      {primaryPhone && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <Phone size={11} />
                          {primaryPhone.phone}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {c.service_type?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 font-medium">
                      {c.monthly_value
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(c.monthly_value))
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <Tooltip text="Clique para ver análise detalhada de desempenho SEO (0–100)">
                        <button onClick={() => router.push(`/clients/${c.id}?score=1`)}>
                          <ScoreBadge score={scoreMap[c.id] ?? null} />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination + limit selector */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500">
              {totalPages > 1 ? `Página ${page} de ${totalPages}` : `${total} resultado${total !== 1 ? 's' : ''}`}
            </p>
            <div className="flex gap-1">
              {[20, 50, 100, 200].map((n) => (
                <Tooltip key={n} text={`Mostrar ${n} resultados por página`}>
                  <button
                    onClick={() => { setLimit(n); setPage(1); localStorage.setItem('clients_limit', String(n)); }}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      limit === n
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {n}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <Tooltip text="Página anterior">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
              </Tooltip>
              <Tooltip text="Próxima página">
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
