'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Send, Eye, MousePointerClick, AlertCircle, Ban,
  Mail, Edit, Play, RefreshCw, Users, Clock, BarChart2,
} from 'lucide-react';
import { emailMarketingApi, EmailCampaign, EmailRecipient, CampaignStatus } from '@/lib/api/email-marketing';

const STATUS_LABELS: Record<CampaignStatus, { label: string; color: string }> = {
  DRAFT:     { label: 'Rascunho',  color: 'bg-gray-100 text-gray-600' },
  SCHEDULED: { label: 'Agendado',  color: 'bg-blue-100 text-blue-700' },
  SENDING:   { label: 'Enviando…', color: 'bg-yellow-100 text-yellow-700' },
  SENT:      { label: 'Enviado',   color: 'bg-green-100 text-green-700' },
  FAILED:    { label: 'Falhou',    color: 'bg-red-100 text-red-700' },
  PAUSED:    { label: 'Pausado',   color: 'bg-orange-100 text-orange-700' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

const AUDIENCE_LABELS: Record<string, string> = {
  manual:            '🧪 Destinatários manuais',
  all_clients:       'Todos os clientes',
  active_clients:    'Clientes ativos',
  all_leads:         'Todos os leads',
  new_leads:         'Leads novos',
  qualified_leads:   'Leads qualificados',
  proposal_leads:    'Leads em proposta',
  negotiation_leads: 'Leads em negociação',
  won_leads:         'Leads ganhos',
  lost_leads:        'Leads perdidos',
};

const RECIPIENT_STYLES: Record<string, string> = {
  PENDING:      'bg-gray-100 text-gray-500',
  SENT:         'bg-blue-100 text-blue-600',
  OPENED:       'bg-emerald-100 text-emerald-700',
  CLICKED:      'bg-purple-100 text-purple-700',
  BOUNCED:      'bg-red-100 text-red-600',
  UNSUBSCRIBED: 'bg-orange-100 text-orange-600',
  COMPLAINED:   'bg-red-200 text-red-700',
  FAILED:       'bg-red-100 text-red-600',
};

const RECIPIENT_LABELS: Record<string, string> = {
  PENDING: 'Pendente', SENT: 'Enviado', OPENED: 'Aberto', CLICKED: 'Clicou',
  BOUNCED: 'Bounce', UNSUBSCRIBED: 'Descadastrou', COMPLAINED: 'Spam', FAILED: 'Falhou',
};

function pct(num: number, den: number) {
  if (!den) return '—';
  return `${((num / den) * 100).toFixed(1)}%`;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1.5 rounded-lg ${color}`}><Icon size={13} /></div>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const PAGE_SIZE = 50;

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingR, setLoadingR] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [sendLimit, setSendLimit] = useState(1000);
  const [sendOffset, setSendOffset] = useState(0);

  useEffect(() => {
    emailMarketingApi.getCampaign(id)
      .then(setCampaign).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const loadRecipients = useCallback(async (p: number) => {
    setLoadingR(true);
    try {
      const res = await emailMarketingApi.getRecipients(id, { limit: PAGE_SIZE, offset: p * PAGE_SIZE });
      setRecipients(res.data);
      setTotal(res.total);
    } catch { /* noop */ } finally {
      setLoadingR(false);
    }
  }, [id]);

  useEffect(() => {
    if (!campaign) return;
    if (campaign.status === 'SENT' || campaign.status === 'SENDING') {
      loadRecipients(page);
    }
  }, [campaign, page, loadRecipients]);

  const confirmSend = async () => {
    if (!campaign) return;
    setSending(true);
    try {
      const sendOpts = limitEnabled ? { limit: sendLimit, offset: sendOffset || undefined } : undefined;
      await emailMarketingApi.sendCampaign(campaign.id, sendOpts);
      const updated = await emailMarketingApi.getCampaign(campaign.id);
      setCampaign(updated);
    } catch { /* noop */ } finally {
      setSending(false);
      setShowSendModal(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-sm text-gray-400">Carregando…</div>;
  if (!campaign) return <div className="text-center py-20 text-sm text-gray-400">Campanha não encontrada.</div>;

  const st = STATUS_LABELS[campaign.status] ?? { label: campaign.status, color: 'bg-gray-100 text-gray-600' };
  const isDraft = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED' || campaign.status === 'FAILED';
  const isActive = campaign.status === 'SENT' || campaign.status === 'SENDING';

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Banner de erro quando falhou */}
      {campaign.status === 'FAILED' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">Envio falhou — nenhum email foi entregue</p>
            <p className="text-xs text-red-600 mt-1">
              O serviço de email (Resend) rejeitou o envio. Verifique se o endereço de remetente usa o domínio verificado <strong>marketing.qualitysmi.com.br</strong>.
            </p>
            <p className="text-xs text-red-500 mt-1">
              Use um remetente como <strong>noreply@marketing.qualitysmi.com.br</strong> e tente reenviar.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/email-marketing')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900 truncate">{campaign.name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{campaign.subject}</p>
        </div>
        {isDraft && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/email-marketing/new?id=${id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Edit size={13} /> Editar
            </button>
            <button
              onClick={() => setShowSendModal(true)}
              disabled={sending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {sending ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
              Enviar agora
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Send} label="Enviados"
          value={campaign.sent_count.toLocaleString('pt-BR')}
          sub={campaign.total_recipients ? `de ${campaign.total_recipients}` : undefined}
          color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={Eye} label="Taxa de abertura"
          value={pct(campaign.open_count, campaign.sent_count)}
          sub={`${campaign.open_count} aberturas`}
          color="bg-blue-50 text-blue-600" />
        <StatCard icon={MousePointerClick} label="Taxa de cliques"
          value={pct(campaign.click_count, campaign.sent_count)}
          sub={`${campaign.click_count} cliques`}
          color="bg-purple-50 text-purple-600" />
        <StatCard icon={AlertCircle} label="Bounces"
          value={pct(campaign.bounce_count, campaign.sent_count)}
          sub={`${campaign.bounce_count} bounces`}
          color="bg-red-50 text-red-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Campaign details */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Mail size={11} /> Detalhes
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-400 w-28 shrink-0">Remetente</dt>
              <dd className="text-gray-700 truncate">{campaign.from_name} &lt;{campaign.from_email}&gt;</dd>
            </div>
            {campaign.reply_to && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-28 shrink-0">Reply-To</dt>
                <dd className="text-gray-700">{campaign.reply_to}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-gray-400 w-28 shrink-0 flex items-center gap-1"><Users size={11} />Audiência</dt>
              <dd className="text-gray-700">{AUDIENCE_LABELS[campaign.audience_type] ?? campaign.audience_type}</dd>
            </div>
            {campaign.scheduled_at && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-28 shrink-0 flex items-center gap-1"><Clock size={11} />Agendado</dt>
                <dd className="text-gray-700">{new Date(campaign.scheduled_at).toLocaleString('pt-BR')}</dd>
              </div>
            )}
            {campaign.sent_at && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-28 shrink-0">Enviado em</dt>
                <dd className="text-gray-700">{new Date(campaign.sent_at).toLocaleString('pt-BR')}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-gray-400 w-28 shrink-0">Criado em</dt>
              <dd className="text-gray-700">{new Date(campaign.created_at).toLocaleDateString('pt-BR')}</dd>
            </div>
          </dl>
        </div>

        {/* Engagement */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart2 size={11} /> Engajamento
          </p>
          <div className="space-y-2.5">
            {[
              { label: 'Descadastros', value: campaign.unsubscribe_count, icon: Ban, color: 'text-orange-500' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon size={13} className={color} />
                <span className="text-sm text-gray-600">{label}</span>
                <span className="ml-auto text-sm font-semibold text-gray-900">{value}</span>
              </div>
            ))}
          </div>

          {campaign.status === 'SENT' && campaign.sent_count > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Distribuição</p>
              <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
                {[
                  { w: (campaign.click_count / campaign.sent_count) * 100, bg: 'bg-purple-400' },
                  { w: (Math.max(0, campaign.open_count - campaign.click_count) / campaign.sent_count) * 100, bg: 'bg-blue-400' },
                  { w: (Math.max(0, campaign.sent_count - campaign.open_count - campaign.bounce_count) / campaign.sent_count) * 100, bg: 'bg-gray-200' },
                  { w: (campaign.bounce_count / campaign.sent_count) * 100, bg: 'bg-red-300' },
                ].filter((s) => s.w > 0).map((s, i) => (
                  <div key={i} style={{ width: `${Math.max(s.w, 1)}%` }} className={`${s.bg} shrink-0`} />
                ))}
              </div>
              <div className="flex gap-3 mt-1.5 flex-wrap">
                {[
                  { bg: 'bg-purple-400', label: 'Clicou' },
                  { bg: 'bg-blue-400', label: 'Abriu' },
                  { bg: 'bg-gray-200', label: 'Entregue' },
                  { bg: 'bg-red-300', label: 'Bounce' },
                ].map(({ bg, label }) => (
                  <span key={label} className="flex items-center gap-1 text-[10px] text-gray-400">
                    <span className={`w-2 h-2 rounded-sm ${bg} inline-block`} />{label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recipients table */}
      {isActive && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              Destinatários
              <span className="text-gray-400 font-normal text-xs ml-1.5">({total.toLocaleString('pt-BR')} total)</span>
            </p>
            {loadingR && <RefreshCw size={13} className="animate-spin text-gray-400" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">Email</th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">Nome</th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">Status</th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">Abertura</th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">Clique</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-gray-700 font-mono text-[11px]">{r.email}</td>
                    <td className="px-4 py-2 text-gray-600">{r.name ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-400">
                      {r.recipient_type === 'client' ? 'Cliente' : 'Lead'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${RECIPIENT_STYLES[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {RECIPIENT_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400">
                      {r.opened_at
                        ? new Date(r.opened_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-400">
                      {r.clicked_at
                        ? new Date(r.clicked_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                ))}
                {recipients.length === 0 && !loadingR && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum destinatário encontrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total.toLocaleString('pt-BR')}
              </span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                  className="px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">
                  ← Anterior
                </button>
                <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}
                  className="px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">
                  Próximo →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email preview for draft */}
      {isDraft && campaign.html_body && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-700">Pré-visualização do email</p>
          </div>
          <div className="p-4">
            <iframe
              srcDoc={campaign.html_body}
              title="Email preview"
              className="w-full rounded-lg border border-gray-100 min-h-96"
              style={{ height: '400px' }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* Send modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-base font-bold text-gray-900 mb-1">Confirmar envio</h2>
            <p className="text-sm text-gray-500 mb-1">
              Campanha: <strong className="text-gray-800">{campaign.name}</strong>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Audiência: <strong className="text-gray-800">{AUDIENCE_LABELS[campaign.audience_type] ?? campaign.audience_type}</strong>
            </p>

            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer mb-1">
              <input type="checkbox" checked={limitEnabled} onChange={(e) => setLimitEnabled(e.target.checked)}
                className="rounded accent-emerald-600" />
              Limitar quantidade enviada
            </label>
            <p className="text-xs text-gray-400 mb-4 ml-6">Útil para envios em lotes — ex: enviar 1.000 por vez em uma lista de 70.000</p>

            {limitEnabled && (
              <div className="space-y-3 mb-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Enviar para no máximo</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={sendLimit} onChange={(e) => setSendLimit(Math.max(1, Number(e.target.value)))}
                        min={1} className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <span className="text-xs text-gray-400">destinatários</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Pular os primeiros</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={sendOffset} onChange={(e) => setSendOffset(Math.max(0, Number(e.target.value)))}
                        min={0} className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <span className="text-xs text-gray-400">da lista</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                  Destinatários <strong>#{(sendOffset + 1).toLocaleString('pt-BR')}</strong> a{' '}
                  <strong>#{(sendOffset + sendLimit).toLocaleString('pt-BR')}</strong> da lista ordenada
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowSendModal(false)} disabled={sending}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmSend} disabled={sending}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                <Send size={13} />
                {sending ? 'Enviando…' : limitEnabled ? `Enviar ${sendLimit.toLocaleString('pt-BR')}` : 'Enviar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
