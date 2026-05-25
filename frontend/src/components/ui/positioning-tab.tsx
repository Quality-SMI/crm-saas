'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, TrendingUp, MousePointerClick, Eye, ArrowUpDown, Download, X, AlertTriangle, CheckCircle, ExternalLink, Pencil, Check } from 'lucide-react';
import { positioningApi, GscSnapshot } from '@/lib/api/positioning';
import { keywordsApi } from '@/lib/api/keywords';
import { Tooltip } from '@/components/ui/tooltip';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function SyncStatus({ syncedAt }: { syncedAt: string }) {
  const d = new Date(syncedAt);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffH / 24);

  let label: string;
  if (diffMin < 2) label = 'Atualizado agora';
  else if (diffMin < 60) label = `Atualizado há ${diffMin}min`;
  else if (diffH < 24) label = `Atualizado há ${diffH}h`;
  else label = `Atualizado há ${diffDays}d`;

  const isStale = diffDays >= 2;

  return (
    <span className={`flex items-center gap-1 text-xs ${isStale ? 'text-amber-600' : 'text-gray-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-amber-400' : 'bg-green-400'}`} />
      {label} · auto-sync diário 3h
    </span>
  );
}

interface Props {
  clientId: string;
  clientName?: string;
  clarityProjectId?: string | null;
  onClarityProjectIdChange?: (id: string | null) => void;
}

interface KeywordAlert {
  keyword: string;
  prevPos: number | null;
  currPos: number | null;
  delta: number;
  type: 'improved' | 'declined' | 'new' | 'lost';
}

function computeAlerts(contractedKeywords: string[], snapshots: GscSnapshot[]): KeywordAlert[] {
  if (snapshots.length < 2) return [];
  const prev = snapshots[snapshots.length - 2];
  const curr = snapshots[snapshots.length - 1];
  const alerts: KeywordAlert[] = [];
  for (const kw of contractedKeywords) {
    const lkw = kw.toLowerCase();
    const prevData = prev.keywords.find(k => k.query.toLowerCase() === lkw);
    const currData = curr.keywords.find(k => k.query.toLowerCase() === lkw);
    if (!prevData && currData) {
      alerts.push({ keyword: kw, prevPos: null, currPos: currData.position, delta: 0, type: 'new' });
    } else if (prevData && !currData) {
      alerts.push({ keyword: kw, prevPos: prevData.position, currPos: null, delta: 0, type: 'lost' });
    } else if (prevData && currData) {
      const delta = prevData.position - currData.position;
      if (Math.abs(delta) >= 3) {
        alerts.push({ keyword: kw, prevPos: prevData.position, currPos: currData.position, delta, type: delta > 0 ? 'improved' : 'declined' });
      }
    }
  }
  return alerts.sort((a, b) => {
    const order: Record<KeywordAlert['type'], number> = { declined: 0, lost: 1, improved: 2, new: 3 };
    return order[a.type] - order[b.type];
  });
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

const DOWNLOAD_SECTIONS = [
  { key: 'summary', label: 'Resumo geral (métricas)' },
  { key: 'contracted', label: 'Palavras-chave contratadas' },
  { key: 'topKeywords', label: 'Top keywords' },
  { key: 'topPages', label: 'Top páginas' },
  { key: 'history', label: 'Histórico de posição' },
] as const;

type SectionKey = typeof DOWNLOAD_SECTIONS[number]['key'];

export function PositioningTab({ clientId, clientName, clarityProjectId, onClarityProjectIdChange }: Props) {
  const [snapshots, setSnapshots] = useState<GscSnapshot[]>([]);
  const [latest, setLatest] = useState<GscSnapshot | null>(null);
  const [contractedKeywords, setContractedKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [days, setDays] = useState(30);
  const [showDownload, setShowDownload] = useState(false);
  const [clarityId, setClarityId] = useState(clarityProjectId ?? '');
  const [editingClarity, setEditingClarity] = useState(false);
  const [savingClarity, setSavingClarity] = useState(false);
  const clarityInputRef = useRef<HTMLInputElement>(null);
  const [downloadSections, setDownloadSections] = useState<Record<SectionKey, boolean>>({
    summary: true,
    contracted: true,
    topKeywords: true,
    topPages: true,
    history: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [snaps, lat, kws] = await Promise.allSettled([
        positioningApi.getSnapshots(clientId, days),
        positioningApi.getLatest(clientId, days),
        keywordsApi.list(clientId),
      ]);
      if (snaps.status === 'fulfilled') setSnapshots(snaps.value);
      if (lat.status === 'fulfilled') setLatest(lat.value);
      if (kws.status === 'fulfilled') setContractedKeywords(kws.value.map(k => k.keyword));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clientId, days]);

  useEffect(() => { setClarityId(clarityProjectId ?? ''); }, [clarityProjectId]);

  const handleSaveClarity = async () => {
    setSavingClarity(true);
    try {
      await onClarityProjectIdChange?.(clarityId.trim() || null);
      setEditingClarity(false);
    } finally {
      setSavingClarity(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await positioningApi.sync(clientId);
      await load();
    } catch {
      // sync errors are non-fatal — data may have been partially updated
    } finally {
      setSyncing(false);
    }
  };

  const fmtPos = (n: number | string | null) => n != null ? Number(n).toFixed(1) : '—';
  const fmtCtr = (n: number | string | null) => n != null ? `${(Number(n) * 100).toFixed(1)}%` : '—';
  const fmtNum = (n: number | string) => Number(n).toLocaleString('pt-BR');

  const positionColor = (pos: number | string | null) => {
    const n = Number(pos);
    if (!n) return 'text-gray-400';
    if (n <= 3) return 'text-green-600 font-bold';
    if (n <= 10) return 'text-blue-600 font-semibold';
    if (n <= 20) return 'text-yellow-600';
    return 'text-red-500';
  };

  const generatePdf = async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    const blue: [number, number, number] = [37, 99, 235];
    const gray50: [number, number, number] = [248, 250, 252];
    let y = margin;

    // ── Logo ──────────────────────────────────────────────────────────────────
    try {
      const logoBase64 = await new Promise<string>((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = '/logo.png';
      });
      const logoH = 10;
      const logoW = logoH * 3.5;
      doc.addImage(logoBase64, 'PNG', margin, y, logoW, logoH);
    } catch {}

    // ── Cabeçalho ─────────────────────────────────────────────────────────────
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Posicionamento', pageW / 2, y + 5, { align: 'center' });
    y += 14;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(
      `${clientName || 'Cliente'} · Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
      pageW / 2, y, { align: 'center' },
    );
    y += 6;

    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y, pageW - margin, y);
    y += 7;

    const section = (title: string) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text(title, margin, y);
      doc.setFont('helvetica', 'normal');
      y += 4;
    };

    const tableOpts = {
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: blue, textColor: 255 as unknown as [number, number, number], fontStyle: 'bold' as const },
      alternateRowStyles: { fillColor: gray50 },
    };

    // ── Resumo geral ──────────────────────────────────────────────────────────
    if (downloadSections.summary && latest) {
      section('Resumo Geral');
      autoTable(doc, {
        ...tableOpts,
        startY: y,
        head: [['Métrica', 'Valor']],
        body: [
          ['Posição média', latest.avg_position != null ? Number(latest.avg_position).toFixed(1) : '—'],
          ['Cliques', String(latest.total_clicks)],
          ['Impressões', String(latest.total_impressions)],
          ['CTR', latest.avg_ctr != null ? `${(Number(latest.avg_ctr) * 100).toFixed(1)}%` : '—'],
          ['Sessões orgânicas', String(latest.sessions)],
          ['Data do snapshot', latest.date],
        ],
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Palavras contratadas ──────────────────────────────────────────────────
    if (downloadSections.contracted && latest && contractedKeywords.length > 0) {
      section('Palavras-chave Contratadas');
      autoTable(doc, {
        ...tableOpts,
        startY: y,
        head: [['Palavra-chave', 'Posição', 'Cliques', 'Impressões']],
        body: contractedKeywords.map(kw => {
          const d = latest.keywords.find(k => k.query.toLowerCase() === kw.toLowerCase());
          return [kw, d ? Number(d.position).toFixed(1) : '—', d ? d.clicks : '—', d ? d.impressions : '—'];
        }),
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Top keywords ──────────────────────────────────────────────────────────
    if (downloadSections.topKeywords && latest && latest.keywords.length > 0) {
      section('Top Keywords (Search Console)');
      autoTable(doc, {
        ...tableOpts,
        startY: y,
        head: [['Keyword', 'Posição', 'Cliques', 'Impressões', 'CTR']],
        body: latest.keywords.map(k => [
          k.query,
          Number(k.position).toFixed(1),
          k.clicks,
          k.impressions,
          `${(Number(k.ctr) * 100).toFixed(1)}%`,
        ]),
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Top páginas ───────────────────────────────────────────────────────────
    if (downloadSections.topPages && latest && latest.pages.length > 0) {
      section('Páginas com Mais Cliques');
      autoTable(doc, {
        ...tableOpts,
        startY: y,
        head: [['Página', 'Posição', 'Cliques']],
        body: latest.pages.map(p => [
          p.page.replace(/^https?:\/\/[^/]+/, '') || '/',
          Number(p.position).toFixed(1),
          p.clicks,
        ]),
        columnStyles: { 0: { cellWidth: 'auto' } },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Histórico ─────────────────────────────────────────────────────────────
    if (downloadSections.history && snapshots.length > 0) {
      section('Histórico de Posicionamento');
      autoTable(doc, {
        ...tableOpts,
        startY: y,
        head: [['Data', 'Posição média', 'Cliques', 'Impressões', 'CTR']],
        body: snapshots.map(s => [
          s.date,
          s.avg_position != null ? Number(s.avg_position).toFixed(1) : '—',
          s.total_clicks,
          s.total_impressions,
          s.avg_ctr != null ? `${(Number(s.avg_ctr) * 100).toFixed(1)}%` : '—',
        ]),
      });
    }

    // ── Rodapé em todas as páginas ────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Quality SMI · Página ${i} de ${totalPages}`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' },
      );
    }

    const safeName = (clientName || clientId).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    doc.save(`posicionamento-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
    setShowDownload(false);
  };

  const toggleSection = (key: SectionKey) => {
    setDownloadSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const alerts = computeAlerts(contractedKeywords, snapshots);

  const chartData = snapshots.map(s => ({
    date: s.date.slice(5),
    position: s.avg_position != null ? Number(Number(s.avg_position).toFixed(1)) : null,
    clicks: s.total_clicks,
    impressions: s.total_impressions,
  }));

  if (loading) return <div className="py-16 text-center text-sm text-gray-400">Carregando dados...</div>;

  if (!latest) {
    return (
      <div className="py-16 text-center">
        <TrendingUp size={32} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500 mb-4">Nenhum dado de posicionamento ainda</p>
        <Tooltip text="Buscar dados agora no Search Console e Analytics">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Buscando...' : 'Sincronizar agora'}
          </button>
        </Tooltip>
        <p className="text-xs text-gray-400 mt-3">
          Certifique-se de que as credenciais Google estão configuradas no servidor
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {[30, 60, 90].map((d) => (
            <Tooltip key={d} text={`Ver gráfico histórico dos últimos ${d} dias`}>
              <button
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  days === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d} dias
              </button>
            </Tooltip>
          ))}
          <span className="text-xs text-gray-400">período de análise</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {latest?.synced_at && (
            <SyncStatus syncedAt={latest.synced_at} />
          )}
          <Tooltip text="Baixar relatório de posicionamento em PDF">
            <button
              onClick={() => setShowDownload(true)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Download size={13} />
              Baixar relatório
            </button>
          </Tooltip>
          <Tooltip text="Atualizar dados do Search Console agora (prioridade imediata)">
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                syncing
                  ? 'bg-blue-50 text-blue-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Atualizar agora'}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Posição média" value={fmtPos(latest.avg_position)} icon={ArrowUpDown} color="bg-blue-50 text-blue-600" />
        <MetricCard label="Cliques" value={fmtNum(latest.total_clicks)} icon={MousePointerClick} color="bg-green-50 text-green-600" />
        <MetricCard label="Impressões" value={fmtNum(latest.total_impressions)} icon={Eye} color="bg-purple-50 text-purple-600" />
        <MetricCard label="CTR" value={fmtCtr(latest.avg_ctr)} icon={TrendingUp} color="bg-orange-50 text-orange-600" />
      </div>

      {/* Keyword alerts */}
      {alerts.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-700">Alertas de posicionamento</h3>
            <span className="ml-auto text-xs text-gray-400">Comparando os dois últimos snapshots</span>
          </div>
          <div className="divide-y divide-gray-50">
            {alerts.map((alert) => {
              const isGood = alert.type === 'improved' || alert.type === 'new';
              const isBad = alert.type === 'declined' || alert.type === 'lost';
              return (
                <div
                  key={alert.keyword}
                  className={`px-4 py-3 flex items-center gap-3 ${
                    isGood ? 'bg-green-50/40' : isBad ? 'bg-red-50/40' : ''
                  }`}
                >
                  {isGood ? (
                    <CheckCircle size={14} className="text-green-500 shrink-0" />
                  ) : (
                    <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  )}
                  <span className="text-sm text-gray-700 flex-1 font-medium">{alert.keyword}</span>
                  {alert.type === 'improved' && (
                    <span className="text-xs text-green-700 font-semibold">
                      {alert.prevPos?.toFixed(1)} → {alert.currPos?.toFixed(1)}
                      <span className="ml-1 text-green-600">(+{alert.delta.toFixed(0)} pos.)</span>
                    </span>
                  )}
                  {alert.type === 'declined' && (
                    <span className="text-xs text-red-700 font-semibold">
                      {alert.prevPos?.toFixed(1)} → {alert.currPos?.toFixed(1)}
                      <span className="ml-1 text-red-500">({alert.delta.toFixed(0)} pos.)</span>
                    </span>
                  )}
                  {alert.type === 'new' && (
                    <span className="text-xs text-green-700 font-semibold">
                      Entrou no top 25 · pos. {alert.currPos?.toFixed(1)}
                    </span>
                  )}
                  {alert.type === 'lost' && (
                    <span className="text-xs text-red-700 font-semibold">
                      Saiu do top 25 · era pos. {alert.prevPos?.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Palavras contratadas */}
      {contractedKeywords.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Palavras-chave Contratadas</h3>
              <p className="text-xs text-gray-400 mt-0.5">{contractedKeywords.length} palavra{contractedKeywords.length !== 1 ? 's' : ''} do contrato</p>
            </div>
          </div>
          <div className="overflow-auto max-h-56">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-left bg-white sticky top-0 z-10">
                  <th className="px-4 py-1.5 text-gray-400 font-medium">Palavra-chave</th>
                  <th className="px-4 py-1.5 text-gray-400 font-medium text-right">Posição</th>
                  <th className="px-4 py-1.5 text-gray-400 font-medium text-right">Cliques</th>
                  <th className="px-4 py-1.5 text-gray-400 font-medium text-right">Impressões</th>
                </tr>
              </thead>
              <tbody>
                {[...contractedKeywords]
                  .map((kw) => ({
                    kw,
                    gscData: latest.keywords.find((k) => k.query.toLowerCase() === kw.toLowerCase()),
                  }))
                  .sort((a, b) => {
                    if (a.gscData && !b.gscData) return -1;
                    if (!a.gscData && b.gscData) return 1;
                    if (a.gscData && b.gscData) return a.gscData.position - b.gscData.position;
                    return 0;
                  })
                  .map(({ kw, gscData }) => (
                    <tr key={kw} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-1.5 text-gray-700">{kw}</td>
                      <td className={`px-4 py-1.5 text-right font-semibold ${gscData ? positionColor(gscData.position) : 'text-gray-300'}`}>
                        {gscData ? fmtPos(gscData.position) : '—'}
                      </td>
                      <td className="px-4 py-1.5 text-right text-gray-600">
                        {gscData ? fmtNum(gscData.clicks) : '—'}
                      </td>
                      <td className="px-4 py-1.5 text-right text-gray-400">
                        {gscData ? fmtNum(gscData.impressions) : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {contractedKeywords.some((kw) => !latest.keywords.find((k) => k.query.toLowerCase() === kw.toLowerCase())) && (
            <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">
              Palavras com "—" não aparecem no top 25 do Search Console no período selecionado.
            </p>
          )}
        </div>
      )}

      {/* Analytics row */}
      {(latest.sessions > 0 || latest.users > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Sessões orgânicas" value={fmtNum(latest.sessions)} icon={TrendingUp} color="bg-teal-50 text-teal-600" />
          <MetricCard label="Usuários orgânicos" value={fmtNum(latest.users)} icon={TrendingUp} color="bg-indigo-50 text-indigo-600" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top keywords */}
        {latest.keywords.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Top Keywords</h3>
              <p className="text-xs text-gray-400 mt-0.5">Últimos {days} dias · Search Console</p>
            </div>
            <div className="overflow-auto max-h-56">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-left bg-white sticky top-0 z-10">
                    <th className="px-4 py-1.5 text-gray-400 font-medium">Keyword</th>
                    <th className="px-4 py-1.5 text-gray-400 font-medium text-right">Pos.</th>
                    <th className="px-4 py-1.5 text-gray-400 font-medium text-right">Cliques</th>
                    <th className="px-4 py-1.5 text-gray-400 font-medium text-right">Imp.</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.keywords.map((kw, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-1.5 text-gray-700 max-w-[180px] truncate">{kw.query}</td>
                      <td className={`px-4 py-1.5 text-right ${positionColor(kw.position)}`}>{fmtPos(kw.position)}</td>
                      <td className="px-4 py-1.5 text-right text-gray-600">{fmtNum(kw.clicks)}</td>
                      <td className="px-4 py-1.5 text-right text-gray-400">{fmtNum(kw.impressions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top pages */}
        {latest.pages.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Páginas com mais cliques</h3>
              <p className="text-xs text-gray-400 mt-0.5">Últimos {days} dias · Search Console</p>
            </div>
            <div className="overflow-auto max-h-56">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-left bg-white sticky top-0 z-10">
                    <th className="px-4 py-1.5 text-gray-400 font-medium">Página</th>
                    <th className="px-4 py-1.5 text-gray-400 font-medium text-right">Pos.</th>
                    <th className="px-4 py-1.5 text-gray-400 font-medium text-right">Cliques</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.pages.map((p, i) => {
                    const path = p.page.replace(/^https?:\/\/[^/]+/, '') || '/';
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-1.5 text-gray-700 max-w-[220px] truncate" title={p.page}>{path}</td>
                        <td className={`px-4 py-1.5 text-right ${positionColor(p.position)}`}>{fmtPos(p.position)}</td>
                        <td className="px-4 py-1.5 text-right text-gray-600">{fmtNum(p.clicks)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      {snapshots.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Position line chart (Y axis inverted: 1 is best = top) */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Histórico de posição média</h3>
            <p className="text-xs text-gray-400 mb-4">Posição 1 = melhor (eixo invertido)</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis
                  reversed
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={(v) => String(v)}
                />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value) => [`${value ?? '—'}`, 'Posição média']}
                />
                <Line
                  type="monotone"
                  dataKey="position"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3b82f6' }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Clicks + Impressions area chart */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Cliques e Impressões</h3>
            <p className="text-xs text-gray-400 mb-4">Evolução no período selecionado</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value, name) => [
                    value != null ? Number(value).toLocaleString('pt-BR') : '—',
                    name === 'clicks' ? 'Cliques' : 'Impressões',
                  ]}
                />
                <Legend
                  formatter={(value) => value === 'clicks' ? 'Cliques' : 'Impressões'}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#colorClicks)"
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fill="url(#colorImpressions)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Microsoft Clarity */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none">
            <rect width="24" height="24" rx="4" fill="#0078D4" />
            <path d="M5 12 L9 8 L12 11 L15 7 L19 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="9" cy="8" r="1.5" fill="white" />
            <circle cx="15" cy="7" r="1.5" fill="white" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-700">Microsoft Clarity</h3>
          {clarityId && !editingClarity && (
            <button
              onClick={() => { setEditingClarity(true); setTimeout(() => clarityInputRef.current?.focus(), 50); }}
              className="ml-auto text-gray-400 hover:text-blue-600 transition-colors"
              title="Editar ID do projeto"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>

        <div className="px-4 py-4">
          {editingClarity || !clarityId ? (
            <div className="flex items-center gap-2">
              <input
                ref={clarityInputRef}
                type="text"
                value={clarityId}
                onChange={(e) => setClarityId(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveClarity(); if (e.key === 'Escape') { setEditingClarity(false); setClarityId(clarityProjectId ?? ''); } }}
                placeholder="Ex: abc123xyz"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSaveClarity}
                disabled={savingClarity}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Check size={12} />
                {savingClarity ? 'Salvando...' : 'Salvar'}
              </button>
              {editingClarity && (
                <button
                  onClick={() => { setEditingClarity(false); setClarityId(clarityProjectId ?? ''); }}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-2 py-2"
                >
                  Cancelar
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                ID do projeto: <span className="font-mono text-gray-600 font-medium">{clarityId}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://clarity.microsoft.com/projects/view/${clarityId}/dashboard`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink size={11} />
                  Dashboard
                </a>
                <a
                  href={`https://clarity.microsoft.com/projects/view/${clarityId}/heatmaps`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <ExternalLink size={11} />
                  Heatmaps
                </a>
                <a
                  href={`https://clarity.microsoft.com/projects/view/${clarityId}/recordings`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <ExternalLink size={11} />
                  Gravações
                </a>
                <a
                  href={`https://clarity.microsoft.com/projects/view/${clarityId}/settings`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <ExternalLink size={11} />
                  Configurações
                </a>
              </div>
            </div>
          )}
          {!clarityId && !editingClarity && (
            <p className="text-xs text-gray-400 mt-2">
              Adicione o ID do projeto do Clarity para acessar dados de comportamento de usuário diretamente daqui.
            </p>
          )}
        </div>
      </div>

      {/* Download modal */}
      {showDownload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Download size={16} className="text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-800">Baixar relatório</h2>
              </div>
              <Tooltip text="Fechar">
                <button
                  onClick={() => setShowDownload(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </Tooltip>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-500">Selecione as seções a incluir no relatório PDF:</p>
              {DOWNLOAD_SECTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={downloadSections[key]}
                    onChange={() => toggleSection(key)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{label}</span>
                </label>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <button
                onClick={() => setShowDownload(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={generatePdf}
                disabled={!Object.values(downloadSections).some(Boolean)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                <Download size={13} />
                Gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
