'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail, Plus, Send, Clock, FileText, Users, TrendingUp,
  Eye, MousePointerClick, AlertCircle, Ban, ChevronRight,
  Trash2, Edit, Play, BarChart2, RefreshCw, Inbox,
} from 'lucide-react';
import { emailMarketingApi, EmailCampaign, CampaignStatus } from '@/lib/api/email-marketing';

const STATUS_LABELS: Record<CampaignStatus | 'FAILED', { label: string; color: string }> = {
  DRAFT:     { label: 'Rascunho',   color: 'bg-gray-100 text-gray-600' },
  SCHEDULED: { label: 'Agendado',   color: 'bg-blue-100 text-blue-700' },
  SENDING:   { label: 'Enviando…',  color: 'bg-yellow-100 text-yellow-700' },
  SENT:      { label: 'Enviado',    color: 'bg-green-100 text-green-700' },
  FAILED:    { label: 'Falhou',     color: 'bg-red-100 text-red-700' },
  PAUSED:    { label: 'Pausado',    color: 'bg-orange-100 text-orange-700' },
  CANCELLED: { label: 'Cancelado',  color: 'bg-red-100 text-red-700' },
};

const AUDIENCE_LABELS: Record<string, string> = {
  manual:             '🧪 Destinatários manuais',
  all_clients:        'Todos os clientes',
  active_clients:     'Clientes ativos',
  all_leads:          'Todos os leads',
  new_leads:          'Leads novos',
  qualified_leads:    'Leads qualificados',
  proposal_leads:     'Leads em proposta',
  negotiation_leads:  'Leads em negociação',
  won_leads:          'Leads ganhos',
  lost_leads:         'Leads perdidos',
};

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}><Icon size={16} /></div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function pct(num: number, den: number) {
  if (!den) return '—';
  return `${((num / den) * 100).toFixed(1)}%`;
}

export default function EmailMarketingPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [tab, setTab] = useState<'campaigns' | 'templates' | 'unsubscribes'>('campaigns');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await emailMarketingApi.listCampaigns();
      setCampaigns(data);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Confirmar envio da campanha para todos os destinatários?')) return;
    setSending(id);
    try {
      await emailMarketingApi.sendCampaign(id);
      setTimeout(load, 2000);
    } catch { /* noop */ } finally {
      setSending(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent, status: string) => {
    e.stopPropagation();
    const msg = status === 'SENT'
      ? 'Excluir esta campanha? Os dados de envio e métricas serão perdidos.'
      : 'Excluir esta campanha?';
    if (!confirm(msg)) return;
    await emailMarketingApi.deleteCampaign(id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  // Aggregate stats from sent campaigns
  const sent = campaigns.filter(c => c.status === 'SENT');
  const totalSent     = sent.reduce((s, c) => s + c.sent_count, 0);
  const totalOpens    = sent.reduce((s, c) => s + c.open_count, 0);
  const totalClicks   = sent.reduce((s, c) => s + c.click_count, 0);
  const totalBounces  = sent.reduce((s, c) => s + c.bounce_count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Mail size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Email Marketing</h1>
            <p className="text-sm text-gray-500">{campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/email-marketing/new')}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus size={15} />
          Nova campanha
        </button>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Send}               label="Emails enviados"     value={totalSent.toLocaleString('pt-BR')}          color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Eye}                label="Taxa de abertura"    value={pct(totalOpens, totalSent)}                  color="bg-blue-50 text-blue-600" />
        <StatCard icon={MousePointerClick}  label="Taxa de cliques"     value={pct(totalClicks, totalSent)}                 color="bg-purple-50 text-purple-600" />
        <StatCard icon={AlertCircle}        label="Taxa de bounce"      value={pct(totalBounces, totalSent)}                color="bg-red-50 text-red-500" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {(['campaigns', 'templates', 'unsubscribes'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {{ campaigns: 'Campanhas', templates: 'Templates', unsubscribes: 'Descadastros' }[t]}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-gray-400 hover:text-gray-600 p-2"><RefreshCw size={14} /></button>
      </div>

      {tab === 'campaigns' && (
        loading ? (
          <div className="text-center py-16 text-sm text-gray-400">Carregando campanhas…</div>
        ) : campaigns.length === 0 ? (
          <div className="py-20 text-center">
            <Inbox size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-500 mb-4">Nenhuma campanha criada ainda</p>
            <button
              onClick={() => router.push('/email-marketing/new')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
            >
              <Plus size={14} />Criar primeira campanha
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => {
              const st = STATUS_LABELS[c.status] ?? { label: c.status, color: 'bg-gray-100 text-gray-600' };
              const isSending = sending === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => router.push(`/email-marketing/${c.id}`)}
                  className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-emerald-200 hover:bg-emerald-50/30 cursor-pointer transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{c.subject}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Users size={11} />{AUDIENCE_LABELS[c.audience_type] ?? c.audience_type}</span>
                      {c.status === 'SENT' && (
                        <>
                          <span className="flex items-center gap-1"><Send size={11} />{c.sent_count.toLocaleString('pt-BR')}</span>
                          <span className="flex items-center gap-1 text-blue-500"><Eye size={11} />{pct(c.open_count, c.sent_count)}</span>
                          <span className="flex items-center gap-1 text-purple-500"><MousePointerClick size={11} />{pct(c.click_count, c.sent_count)}</span>
                        </>
                      )}
                      {c.scheduled_at && c.status === 'SCHEDULED' && (
                        <span className="flex items-center gap-1"><Clock size={11} />{new Date(c.scheduled_at).toLocaleString('pt-BR')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                      <>
                        <button
                          onClick={() => router.push(`/email-marketing/new?id=${c.id}`)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={(e) => handleSend(c.id, e)}
                          disabled={isSending}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                          title="Enviar agora"
                        >
                          {isSending ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                        </button>
                      </>
                    )}
                    {c.status === 'SENT' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/email-marketing/${c.id}`); }}
                        className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                        title="Ver relatório"
                      >
                        <BarChart2 size={14} />
                      </button>
                    )}
                    {c.status !== 'SENDING' && (
                      <button
                        onClick={(e) => handleDelete(c.id, e, c.status)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-emerald-400 shrink-0 transition-colors" />
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'templates' && <TemplatesTab />}
      {tab === 'unsubscribes' && <UnsubscribesTab />}
    </div>
  );
}

// ── Templates Tab ──────────────────────────────────────────────────────────────

function TemplatesTab() {
  const router = useRouter();
  const [templates, setTemplates] = useState<import('@/lib/api/email-marketing').EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    emailMarketingApi.listTemplates()
      .then(setTemplates).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este template?')) return;
    await emailMarketingApi.deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  if (loading) return <div className="text-center py-12 text-sm text-gray-400">Carregando templates…</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => router.push('/email-marketing/new?template=1')}
          className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          <Plus size={14} />Novo template
        </button>
      </div>
      {templates.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          <FileText size={32} className="mx-auto mb-3 text-gray-200" />
          Nenhum template salvo
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-2 hover:border-emerald-200 transition-colors group">
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold text-gray-800 truncate flex-1">{t.name}</p>
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full ml-2 shrink-0">{t.category}</span>
              </div>
              <p className="text-xs text-gray-500 truncate">{t.subject}</p>
              <div className="flex gap-1 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => router.push(`/email-marketing/new?templateId=${t.id}`)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100 transition-colors"
                >
                  <Plus size={11} />Usar
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors ml-auto"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Unsubscribes Tab ───────────────────────────────────────────────────────────

function UnsubscribesTab() {
  const [list, setList] = useState<import('@/lib/api/email-marketing').EmailUnsubscribe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    emailMarketingApi.listUnsubscribes()
      .then(setList).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleRemove = async (email: string) => {
    if (!confirm(`Reativar o email ${email}?`)) return;
    await emailMarketingApi.removeUnsubscribe(email);
    setList(prev => prev.filter(u => u.email !== email));
  };

  if (loading) return <div className="text-center py-12 text-sm text-gray-400">Carregando…</div>;

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">{list.length} email{list.length !== 1 ? 's' : ''} descadastrado{list.length !== 1 ? 's' : ''}</p>
      {list.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">
          <Ban size={32} className="mx-auto mb-3 text-gray-200" />
          Nenhum descadastro
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-2 text-gray-400 font-medium">Email</th>
                <th className="px-4 py-2 text-gray-400 font-medium">Data</th>
                <th className="px-4 py-2 text-gray-400 font-medium">Motivo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{u.email}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2 text-gray-400">{u.reason ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleRemove(u.email)}
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      Reativar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
