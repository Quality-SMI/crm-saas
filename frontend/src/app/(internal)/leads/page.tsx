'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, TrendingUp, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import {
  leadsApi,
  Lead,
  LeadStage,
  STAGE_LABELS,
  STAGE_COLORS,
  ORIGIN_LABELS,
} from '@/lib/api/leads';
import { Tooltip } from '@/components/ui/tooltip';

const STAGES: LeadStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

export default function LeadsPage() {
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [stage, setStage] = useState<LeadStage | ''>('');
  const [loading, setLoading] = useState(true);
  const [stageCounts, setStageCounts] = useState<Record<LeadStage, number> | null>(null);
  const [colWidths, setColWidths] = useState([220, 160, 180, 110, 120, 130]);
  const resizingRef = useRef<{ col: number; startX: number; startW: number } | null>(null);

  const startResize = (col: number, e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = { col, startX: e.clientX, startW: colWidths[col] };
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      setColWidths((prev) => {
        const next = [...prev];
        next[resizingRef.current!.col] = Math.max(60, resizingRef.current!.startW + delta);
        return next;
      });
    };
    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leadsApi.list({
        page,
        limit,
        search: search || undefined,
        stage: stage || undefined,
      });
      setLeads(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, stage]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    leadsApi.statsByStage().then((r) => setStageCounts(r.data)).catch(() => null);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} leads no funil</p>
        </div>
        <Tooltip text="Criar um novo lead no funil">
          <Link
            href="/leads/new"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Novo lead
          </Link>
        </Tooltip>
      </div>

      {/* Stage pills */}
      {stageCounts && (
        <div className="flex gap-2 flex-wrap mb-4">
          <Tooltip text="Mostrar leads de todas as etapas">
            <button
              onClick={() => { setStage(''); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${stage === '' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
            >
              Todos ({Object.values(stageCounts).reduce((a, b) => a + b, 0)})
            </button>
          </Tooltip>
          {STAGES.map((s) => (
            <Tooltip key={s} text={`Filtrar leads na etapa: ${STAGE_LABELS[s]}`}>
              <button
                onClick={() => { setStage(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  stage === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {STAGE_LABELS[s]} ({stageCounts[s]})
              </button>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por empresa, contato ou email..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Tooltip text="Buscar leads pelo nome, empresa ou email">
            <button type="submit" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 rounded-lg transition-colors">
              Buscar
            </button>
          </Tooltip>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Carregando...</div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <TrendingUp size={32} className="mb-3 opacity-30" />
            <p className="text-sm">Nenhum lead encontrado</p>
          </div>
        ) : (
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 text-left">
                {(['Lead', 'Site', 'Contato', 'Etapa', 'Origem', 'Responsável'] as const).map((label, i) => (
                  <th key={label} className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide relative select-none">
                    {label}
                    <div
                      onMouseDown={(e) => startResize(i, e)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-200 opacity-0 hover:opacity-100 transition-opacity"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => router.push(`/leads/${l.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{l.name}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    {l.website ? (
                      <a
                        href={l.website.startsWith('http') ? l.website : `https://${l.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Globe size={12} />
                        {l.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    <p>{l.contact_name ?? '—'}</p>
                    {l.contact_email && <p className="text-xs text-gray-400 mt-0.5">{l.contact_email}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[l.stage]}`}>
                      {STAGE_LABELS[l.stage]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    {l.origin ? ORIGIN_LABELS[l.origin] : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 text-xs">
                    {l.owner?.name ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500">
              {totalPages > 1 ? `Página ${page} de ${totalPages}` : `${total} lead${total !== 1 ? 's' : ''}`}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Exibir:</span>
              {([50, 100, 250, 500] as const).map((n) => (
                <Tooltip key={n} text={`Exibir ${n} leads por página`}>
                  <button
                    onClick={() => { setLimit(n); setPage(1); }}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                      limit === n
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {n}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
          <div className="flex gap-1">
            <Tooltip text="Página anterior">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={16} />
              </button>
            </Tooltip>
            <Tooltip text="Próxima página">
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
