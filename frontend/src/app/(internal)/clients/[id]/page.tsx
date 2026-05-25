'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Trash2, Eye, EyeOff, Pencil } from 'lucide-react';
import { ClientForm, ClientFormData } from '@/components/ui/client-form';
import { PositioningTab } from '@/components/ui/positioning-tab';
import { KeywordsTab } from '@/components/ui/keywords-tab';
import { ApiKeysTab } from '@/components/ui/api-keys-tab';
import { clientsApi, Client, ClientBody } from '@/lib/api/clients';
import { scoresApi, ClientScore } from '@/lib/api/scores';
import { ScoreBadge } from '@/components/ui/score-badge';
import { ScorePanel } from '@/components/ui/score-panel';
import { Tooltip } from '@/components/ui/tooltip';

const STATUS_OPTIONS = [
  { value: 'ACTIVE',    label: 'Ativo',     active: 'bg-green-600 text-white',   idle: 'bg-green-50 text-green-700 hover:bg-green-100' },
  { value: 'CANCELLED',label: 'Cancelado', active: 'bg-red-600 text-white',     idle: 'bg-red-50 text-red-700 hover:bg-red-100' },
  { value: 'RENEWED',  label: 'Renovado',  active: 'bg-purple-600 text-white',  idle: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
  { value: 'PAUSED',   label: 'Pausado',   active: 'bg-yellow-500 text-white',  idle: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
  { value: 'FINISHED', label: 'Encerrado', active: 'bg-gray-500 text-white',    idle: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
] as const;

type ClientStatusValue = typeof STATUS_OPTIONS[number]['value'];

const PLAN_IDS = {
  SILVER:    'e9978d91-ec42-44e5-9afa-7a298d872c25',
  GOLD:      '6f4144d8-55b4-486b-a7c9-c4c1a0974010',
  DIAMOND:   'f3934adb-2208-46d9-803d-eff4dddad95b',
  PARCEIROS: '39d3e744-88bb-4c99-8144-4b3c040c99ee',
} as const;

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  [PLAN_IDS.SILVER]:    { label: 'Silver',   cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
  [PLAN_IDS.GOLD]:      { label: 'Gold',     cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' },
  [PLAN_IDS.DIAMOND]:   { label: 'Diamond',  cls: 'bg-sky-50 text-sky-700 border border-sky-200' },
  [PLAN_IDS.PARCEIROS]: { label: 'Parceiro', cls: 'bg-purple-50 text-purple-700 border border-purple-200' },
};


export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (searchParams.get('tab') as 'dados' | 'palavras-chave' | 'posicionamento' | 'api-keys') ?? 'dados';
  const openScore = searchParams.get('score') === '1';

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [tab, setTab] = useState<'dados' | 'palavras-chave' | 'posicionamento' | 'api-keys'>(initialTab);
  const [valueVisible, setValueVisible] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [score, setScore] = useState<ClientScore | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);

  useEffect(() => {
    clientsApi.get(id).then((res) => setClient(res.data)).finally(() => setLoading(false));
    scoresApi.latest(id).then(setScore).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (openScore) setScoreOpen(true);
  }, [openScore]);

  const handleSubmit = async (data: ClientFormData) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await clientsApi.update(id, data as ClientBody);
      setClient(res.data);
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(' • ') : raw;
      setError(msg ?? 'Erro ao atualizar cliente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: ClientStatusValue) => {
    if (!client || client.status === newStatus || statusUpdating) return;
    setStatusUpdating(true);
    try {
      const res = await clientsApi.update(id, { status: newStatus } as ClientBody);
      setClient(res.data);
    } catch {
      setError('Erro ao atualizar status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Deseja excluir "${client?.company_name}"? Esta ação pode ser desfeita pelo suporte.`)) return;
    setDeleting(true);
    try {
      await clientsApi.delete(id);
      router.push('/clients');
    } catch {
      setDeleting(false);
      setError('Erro ao excluir cliente.');
    }
  };

  if (loading) return <div className="text-sm text-gray-400 py-16 text-center">Carregando...</div>;
  if (!client) return <div className="text-sm text-gray-500 py-16 text-center">Cliente não encontrado.</div>;

  const planBadge = client.company_size_id ? (PLAN_BADGE[client.company_size_id] ?? null) : null;
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Tooltip text="Voltar para a lista de clientes" position="right">
          <Link href="/clients" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
        </Tooltip>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{client.company_name}</h1>
            {planBadge && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${planBadge.cls}`}>
                {planBadge.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <a
              href={client.domain.startsWith('http') ? client.domain : `https://${client.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-blue-600 hover:underline transition-colors"
            >
              {client.domain}
            </a>
            {client.monthly_value && (
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-green-700">
                  {valueVisible
                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(client.monthly_value))
                    : '••••••'}
                  <span className="text-xs font-normal text-gray-400">/mês</span>
                </span>
                <Tooltip text={valueVisible ? 'Ocultar valor' : 'Mostrar valor'}>
                  <button
                    onClick={() => setValueVisible((v) => !v)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {valueVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </Tooltip>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {STATUS_OPTIONS.map((opt) => (
              <Tooltip
                key={opt.value}
                text={client.status === opt.value ? `Status atual: ${opt.label}` : `Alterar status para ${opt.label}`}
              >
                <button
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange(opt.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-60 ${
                    client.status === opt.value ? opt.active : opt.idle
                  }`}
                >
                  {opt.label}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
        <Tooltip text="Editar dados do cliente">
          <button
            onClick={() => setTab('dados')}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
          >
            <Pencil size={15} /> Editar
          </button>
        </Tooltip>
        <Tooltip text="Excluir este cliente do sistema">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
          >
            <Trash2 size={15} /> Excluir
          </button>
        </Tooltip>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Score card */}
      <button
        onClick={() => setScoreOpen(true)}
        className="w-full text-left mb-5 bg-white border border-gray-100 rounded-xl px-5 py-3.5 flex items-center gap-4 hover:border-blue-200 hover:shadow-sm transition-all group"
      >
        <ScoreBadge score={score ? Number(score.score) : null} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">Score de Desempenho</p>
          <p className="text-xs text-gray-400">
            {score
              ? `Atualizado em ${new Date(score.calculated_at).toLocaleDateString('pt-BR')} · clique para ver análise`
              : 'Clique para calcular e ver análise completa'}
          </p>
        </div>
        <span className="text-xs text-blue-600 group-hover:underline shrink-0">Ver análise →</span>
      </button>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {([
          { key: 'dados', label: 'Dados do cliente' },
          { key: 'palavras-chave', label: 'Palavras-chave' },
          { key: 'posicionamento', label: 'Posicionamento Google' },
          { key: 'api-keys', label: 'API Keys' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dados' && (
        <ClientForm defaultValues={client} onSubmit={handleSubmit} isLoading={isLoading} submitLabel="Salvar alterações" />
      )}
      {tab === 'palavras-chave' && <KeywordsTab clientId={client.id} />}
      {tab === 'posicionamento' && (
        <PositioningTab
          clientId={client.id}
          clientName={client.company_name}
          clarityProjectId={client.clarity_project_id}
          onClarityProjectIdChange={async (newId) => {
            const res = await clientsApi.update(id, { clarity_project_id: newId });
            setClient(res.data);
          }}
        />
      )}
      {tab === 'api-keys' && <ApiKeysTab clientId={client.id} />}

      {scoreOpen && <ScorePanel clientId={client.id} onClose={() => setScoreOpen(false)} />}
    </div>
  );
}
