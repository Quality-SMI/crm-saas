'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Bot, Plus, Trash2, Eye, MessageSquare, Globe, Users,
  TrendingUp, AlertCircle, CheckCircle, MinusCircle,
  X, Star, Filter, ExternalLink, Lightbulb, Check, RefreshCw,
} from 'lucide-react';
import {
  geoApi,
  AiPlatform, AiQuery, AiMention, AiSource, AiCompetitor, GeoOverview, AioMetadata,
} from '@/lib/api/geo';
import { Tooltip } from './tooltip';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SENTIMENT_CONFIG = {
  POSITIVE: { label: 'Positivo', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  NEUTRAL:  { label: 'Neutro',   icon: MinusCircle, color: 'text-gray-500',  bg: 'bg-gray-50 border-gray-200' },
  NEGATIVE: { label: 'Negativo', icon: AlertCircle, color: 'text-red-600',   bg: 'bg-red-50 border-red-200' },
} as const;

const MENTION_TYPE_LABEL: Record<string, string> = {
  DIRECT: 'Direta', INDIRECT: 'Indireta', CITATION: 'Citação', RECOMMENDATION: 'Recomendação',
};

const PLATFORM_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  chatgpt:    { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  gemini:     { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  claude:     { bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  perplexity: { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  copilot:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  'meta-ai':  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  'ai-overview': { bg: 'bg-rose-100', text: 'text-rose-700',    dot: 'bg-rose-500' },
};

const DEFAULT_PLATFORM_COLOR = { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };

function getPlatformColor(slug: string) {
  return PLATFORM_COLORS[slug] ?? DEFAULT_PLATFORM_COLOR;
}

const PLATFORM_TEST_URLS: Record<string, (p: string) => string> = {
  chatgpt:      (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}`,
  gemini:       (p) => `https://gemini.google.com/app?q=${encodeURIComponent(p)}`,
  perplexity:   (p) => `https://www.perplexity.ai/?q=${encodeURIComponent(p)}`,
  claude:       (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}`,
  copilot:      (p) => `https://copilot.microsoft.com/?q=${encodeURIComponent(p)}`,
  'meta-ai':    (_) => `https://www.meta.ai/`,
  'ai-overview':(p) => `https://www.google.com/search?q=${encodeURIComponent(p)}`,
};

function getTestUrl(slug: string, prompt: string): string {
  return (PLATFORM_TEST_URLS[slug] ?? PLATFORM_TEST_URLS.chatgpt)(prompt);
}

const SEGMENT_DISCOVERY: Record<string, string[]> = {
  industrial: [
    'melhores fornecedores industriais do Brasil',
    'qual a melhor indústria de manufatura para contratar?',
    'empresa de fabricação confiável no Brasil',
    'como escolher um fornecedor industrial?',
    'indústrias brasileiras mais recomendadas',
  ],
  b2c: [
    'melhores lojas online do Brasil',
    'qual loja virtual é mais confiável?',
    'onde comprar online com segurança?',
    'lojas de e-commerce mais bem avaliadas',
    'como escolher uma loja online no Brasil?',
  ],
  saude: [
    'melhores clínicas e serviços de saúde',
    'qual clínica médica é mais recomendada?',
    'como escolher um prestador de saúde?',
    'serviços de saúde com boa reputação',
    'profissionais de saúde mais bem avaliados',
  ],
  imobiliario: [
    'melhores imobiliárias do Brasil',
    'qual imobiliária é mais confiável?',
    'como escolher uma imobiliária?',
    'empresa de compra e venda de imóveis recomendada',
    'corretores de imóveis mais bem avaliados',
  ],
  tecnologia: [
    'melhores empresas de tecnologia no Brasil',
    'qual empresa de software é mais recomendada?',
    'como escolher uma empresa de TI?',
    'soluções de tecnologia para empresas confiáveis',
    'startups e empresas de tech mais bem avaliadas',
  ],
  educacao: [
    'melhores cursos e plataformas de ensino online',
    'qual escola ou curso é mais recomendado?',
    'como escolher uma instituição de ensino?',
    'plataformas de educação mais bem avaliadas',
    'cursos profissionalizantes recomendados no Brasil',
  ],
  alimentacao: [
    'melhores restaurantes e serviços de alimentação',
    'qual marca de alimentos é mais confiável?',
    'como escolher um fornecedor de alimentos?',
    'restaurantes e deliveries mais bem avaliados',
    'serviços de alimentação com boa reputação',
  ],
  servicos: [
    'melhores empresas de serviços profissionais',
    'qual consultoria é mais recomendada no Brasil?',
    'como escolher um prestador de serviços?',
    'empresas de serviços com melhor reputação',
    'prestadores de serviço mais bem avaliados',
  ],
  marketing: [
    'melhores agências de marketing digital no Brasil',
    'qual agência de SEO é mais recomendada?',
    'como escolher uma agência de marketing?',
    'empresas de tráfego pago mais confiáveis',
    'agências de gestão de redes sociais mais bem avaliadas',
  ],
  default: [
    'melhores empresas do setor no Brasil',
    'qual empresa é mais recomendada neste mercado?',
    'como escolher um bom prestador de serviços?',
    'empresas mais bem avaliadas no segmento',
    'quais são as referências do setor no Brasil?',
  ],
};

function getSegmentKey(segment: string | null | undefined): string {
  if (!segment) return 'default';
  const s = segment.toLowerCase();
  if (s.includes('indust') || s.includes('manufat') || s.includes('fabric')) return 'industrial';
  if (s.includes('b2c') || s.includes('varejo') || s.includes('e-commerce') || s.includes('ecommerce') || s.includes('comércio')) return 'b2c';
  if (s.includes('saúde') || s.includes('saude') || s.includes('médic') || s.includes('medic') || s.includes('clínic') || s.includes('clinic')) return 'saude';
  if (s.includes('imobil') || s.includes('imóvel') || s.includes('imovel')) return 'imobiliario';
  if (s.includes('tecnol') || s.includes('software') || s.includes('ti ') || s.includes(' ti')) return 'tecnologia';
  if (s.includes('educa') || s.includes('escola') || s.includes('curso') || s.includes('ensino')) return 'educacao';
  if (s.includes('aliment') || s.includes('restau') || s.includes('food')) return 'alimentacao';
  if (s.includes('market') || s.includes('seo') || s.includes('agência') || s.includes('agencia')) return 'marketing';
  if (s.includes('servi')) return 'servicos';
  return 'default';
}

function SuggestionChips({
  clientName,
  segment,
  onAddBatch,
}: {
  clientName: string;
  segment?: string | null;
  onAddBatch: (prompts: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const brandSuggestions = [
    `avaliações da ${clientName}`,
    `${clientName} é confiável?`,
    `o que faz a ${clientName}?`,
    `${clientName} tem boa reputação?`,
    `${clientName} vs concorrentes`,
    `a ${clientName} é recomendada?`,
    `como contratar a ${clientName}`,
    `preços da ${clientName}`,
    `${clientName} atende bem?`,
    `quem é a ${clientName}?`,
  ];

  const segmentKey = getSegmentKey(segment);
  const discoverySuggestions = SEGMENT_DISCOVERY[segmentKey] ?? SEGMENT_DISCOVERY.default;

  const toggle = (s: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    try {
      await onAddBatch([...selected]);
      setSelected(new Set());
    } finally {
      setAdding(false);
    }
  };

  const chipClass = (s: string) =>
    `inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer select-none ${
      selected.has(s)
        ? 'bg-blue-600 text-white border-blue-600 font-medium'
        : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50 hover:border-amber-400'
    }`;

  return (
    <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Lightbulb size={12} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs font-medium text-amber-700">
            Sugestões — selecione uma ou mais e clique em adicionar
          </p>
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus size={11} />
            {adding ? 'Adicionando...' : `Adicionar ${selected.size} prompt${selected.size > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-amber-600 font-medium">Sobre a {clientName}</p>
        <div className="flex flex-wrap gap-1.5">
          {brandSuggestions.map((s) => (
            <button key={s} type="button" onClick={() => toggle(s)} className={chipClass(s)}>
              {selected.has(s) && <Check size={9} />}
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-amber-600 font-medium">Descoberta — onde a {clientName} quer aparecer</p>
        <div className="flex flex-wrap gap-1.5">
          {discoverySuggestions.map((s) => (
            <button key={s} type="button" onClick={() => toggle(s)} className={chipClass(s)}>
              {selected.has(s) && <Check size={9} />}
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlatformPill({ platform, size = 'sm' }: { platform: AiPlatform; size?: 'xs' | 'sm' }) {
  const c = getPlatformColor(platform.slug);
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full ${
      size === 'xs' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
    } ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {platform.name}
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return <span className="text-xs text-gray-400">—</span>;
  const cfg = SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, delta, color = 'blue' }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; delta?: string; color?: string;
}) {
  const iconColors: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50', green: 'text-green-600 bg-green-50',
    purple: 'text-violet-600 bg-violet-50', orange: 'text-orange-600 bg-orange-50',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColors[color]}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <p className="text-xl font-bold text-gray-900">{value}</p>
            {delta && <span className="text-xs font-semibold text-green-600">{delta}</span>}
          </div>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Platform selector ────────────────────────────────────────────────────────

function PlatformSelector({
  platforms, selected, onSelect,
}: {
  platforms: AiPlatform[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 text-xs text-gray-400 mr-1">
        <Filter size={12} /> IA:
      </div>
      <Tooltip text="Ver dados de todas as plataformas de IA">
        <button
          onClick={() => onSelect(null)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${
            selected === null
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          Todas
        </button>
      </Tooltip>
      {platforms.map((p) => {
        const c = getPlatformColor(p.slug);
        const active = selected === p.id;
        return (
          <Tooltip key={p.id} text={active ? `Remover filtro de ${p.name}` : `Filtrar dados por ${p.name}`}>
            <button
              onClick={() => onSelect(active ? null : p.id)}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${
                active
                  ? `${c.bg} ${c.text} border-transparent ring-2 ring-offset-1 ring-current`
                  : `bg-white text-gray-600 border-gray-200 hover:${c.bg} hover:${c.text} hover:border-transparent`
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
              {p.name}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

type SubTab = 'overview' | 'mentions' | 'prompts' | 'sources' | 'competitors';

const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType; tip: string }[] = [
  { key: 'overview',    label: 'Painel',       icon: TrendingUp,    tip: 'Visão geral: scores, sentimentos e menções por plataforma' },
  { key: 'mentions',   label: 'Menções',       icon: Eye,           tip: 'Resultados de monitoramento registrados manualmente' },
  { key: 'prompts',    label: 'Prompts',       icon: MessageSquare, tip: 'Prompts cadastrados para monitorar nas IAs' },
  { key: 'sources',    label: 'Fontes',        icon: Globe,         tip: 'Domínios mais citados pelas IAs ao mencionar o cliente' },
  { key: 'competitors',label: 'Concorrentes',  icon: Users,         tip: 'Concorrentes rastreados para comparação de visibilidade' },
];

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ overview }: { overview: GeoOverview }) {
  const totalSentiment = overview.sentiment.POSITIVE + overview.sentiment.NEUTRAL + overview.sentiment.NEGATIVE;
  const reputation = totalSentiment > 0
    ? Math.round(((overview.sentiment.POSITIVE * 100) + (overview.sentiment.NEUTRAL * 50)) / totalSentiment)
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="Visibilidade"    value={overview.visibility_score != null ? `${overview.visibility_score.toFixed(1)}%` : '—'} sub="score geral"   color="blue" />
        <StatCard icon={Star}       label="Reputação"       value={reputation != null ? reputation : '—'} sub="score sentimento" color="purple" />
        <StatCard icon={Eye}        label="Menções"         value={overview.mention_count} sub="total registrado" color="green" />
        <StatCard icon={MessageSquare} label="Prompts ativos" value={overview.active_queries} sub="monitorados" color="orange" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sentiment */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Análise de Sentimento</h3>
          {totalSentiment === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Nenhuma menção com sentimento registrado</p>
          ) : (
            <div className="space-y-3">
              {(['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const).map((s) => {
                const cfg = SENTIMENT_CONFIG[s];
                const count = overview.sentiment[s];
                const pct = totalSentiment > 0 ? Math.round((count / totalSentiment) * 100) : 0;
                const Icon = cfg.icon;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <Icon size={14} className={cfg.color} />
                    <span className="text-xs text-gray-600 w-16">{cfg.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s === 'POSITIVE' ? 'bg-green-500' : s === 'NEUTRAL' ? 'bg-gray-400' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Platforms */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Menções por Plataforma</h3>
          {overview.platforms.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Nenhuma menção registrada</p>
          ) : (
            <div className="space-y-2.5">
              {overview.platforms.map(({ name, count }) => {
                const total = overview.platforms.reduce((s, p) => s + p.count, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={name} className="flex items-center gap-3">
                    <Bot size={13} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 flex-1 truncate">{name}</span>
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Globe} label="Fontes citadas" value={overview.source_count} color="green" />
        <StatCard icon={Users} label="Concorrentes"   value={overview.competitor_count} sub="rastreados" color="orange" />
      </div>
    </div>
  );
}

// ─── Mentions Tab ─────────────────────────────────────────────────────────────

function AioMetadataCard({ meta }: { meta: AioMetadata }) {
  return (
    <div className="mt-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 space-y-3 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-bold tracking-wide">AI OVERVIEW</span>
        <span className="text-blue-400 text-[10px]">{meta.observacao}</span>
      </div>

      {meta.ai_overview_simulado && (
        <div>
          <p className="font-semibold text-blue-800 mb-1">Resumo gerado</p>
          <p className="text-gray-700 leading-relaxed">{meta.ai_overview_simulado}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {meta.intencao_de_busca && (
          <div>
            <p className="font-semibold text-gray-500 mb-1">Intenção de busca</p>
            <span className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-700 font-medium">{meta.intencao_de_busca}</span>
          </div>
        )}
        {meta.principais_entidades?.length > 0 && (
          <div>
            <p className="font-semibold text-gray-500 mb-1">Principais entidades</p>
            <div className="flex flex-wrap gap-1">
              {meta.principais_entidades.map((e, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-medium">{e}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {meta.topicos_recorrentes?.length > 0 && (
        <div>
          <p className="font-semibold text-gray-500 mb-1">Tópicos recorrentes</p>
          <div className="flex flex-wrap gap-1">
            {meta.topicos_recorrentes.map((t, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600 text-[10px]">{t}</span>
            ))}
          </div>
        </div>
      )}

      {meta.oportunidades_geo?.length > 0 && (
        <div>
          <p className="font-semibold text-green-700 mb-1">Oportunidades GEO</p>
          <ul className="space-y-0.5">
            {meta.oportunidades_geo.map((o, i) => (
              <li key={i} className="flex items-start gap-1.5 text-green-800">
                <span className="text-green-500 mt-0.5">→</span>{o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {meta.padroes_semanticos?.length > 0 && (
        <div>
          <p className="font-semibold text-gray-500 mb-1">Padrões semânticos</p>
          <div className="flex flex-wrap gap-1">
            {meta.padroes_semanticos.map((p, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-purple-50 border border-purple-100 text-purple-700 rounded text-[10px]">{p}</span>
            ))}
          </div>
        </div>
      )}

      {meta.fontes_citadas?.length > 0 && (
        <div>
          <p className="font-semibold text-gray-500 mb-1">Fontes citadas</p>
          <div className="space-y-0.5">
            {meta.fontes_citadas.slice(0, 5).map((url, i) => {
              try {
                const domain = new URL(url).hostname.replace('www.', '');
                return (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline">
                    <ExternalLink size={9} />{domain}
                  </a>
                );
              } catch { return null; }
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MentionRow({ m, clientId, onDelete }: { m: AiMention; clientId: string; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasAio = Boolean(m.geo_metadata);

  return (
    <>
      <tr className={`hover:bg-gray-50/50 transition-colors ${hasAio ? 'cursor-pointer' : ''}`}
        onClick={() => hasAio && setExpanded(e => !e)}>
        <td className="px-4 py-3">
          {m.platform ? <PlatformPill platform={m.platform} size="xs" /> : '—'}
          {hasAio && (
            <span className="ml-1.5 text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">AIO</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-gray-600">{MENTION_TYPE_LABEL[m.mention_type] ?? m.mention_type}</td>
        <td className="px-4 py-3 max-w-xs">
          {m.response_excerpt
            ? <p className="text-xs text-gray-600 line-clamp-2">{m.response_excerpt}</p>
            : <span className="text-xs text-gray-300">—</span>}
        </td>
        <td className="px-4 py-3"><SentimentBadge sentiment={m.sentiment} /></td>
        <td className="px-4 py-3 text-center">
          {m.ranking_position != null
            ? <span className="text-xs font-bold text-gray-800">#{m.ranking_position}</span>
            : <span className="text-xs text-gray-300">—</span>}
        </td>
        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
          {new Date(m.checked_at).toLocaleDateString('pt-BR')}
        </td>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <Tooltip text="Remover este resultado">
            <button onClick={async () => { if (confirm('Remover este resultado?')) { await geoApi.deleteMention(clientId, m.id); onDelete(); } }}
              className="text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 size={13} />
            </button>
          </Tooltip>
        </td>
      </tr>
      {expanded && m.geo_metadata && (
        <tr>
          <td colSpan={7} className="px-4 pb-4 bg-blue-50/30">
            <AioMetadataCard meta={m.geo_metadata as AioMetadata} />
          </td>
        </tr>
      )}
    </>
  );
}

function MentionsTab({
  clientId, platforms, activePlatformId,
}: {
  clientId: string; platforms: AiPlatform[]; activePlatformId: string | null;
}) {
  const [mentions, setMentions] = useState<AiMention[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterSentiment, setFilterSentiment] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    platform_id: activePlatformId ?? '',
    mention_type: 'DIRECT',
    sentiment: '',
    response_excerpt: '',
    ranking_position: '',
    urls_cited: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    geoApi.listMentions(clientId, {
      platform_id: activePlatformId || undefined,
      sentiment: filterSentiment || undefined,
      limit: 50,
    }).then((r) => { setMentions(r.data); setTotal(r.total); }).finally(() => setLoading(false));
  }, [clientId, activePlatformId, filterSentiment]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setForm((f) => ({ ...f, platform_id: activePlatformId ?? '' }));
  }, [activePlatformId]);

  const handleCreate = async () => {
    if (!form.platform_id) return;
    setSubmitting(true);
    try {
      await geoApi.createMention(clientId, {
        platform_id: form.platform_id,
        mention_type: form.mention_type as never,
        sentiment: form.sentiment as never || undefined,
        response_excerpt: form.response_excerpt || undefined,
        ranking_position: form.ranking_position ? Number(form.ranking_position) : undefined,
        urls_cited: form.urls_cited ? form.urls_cited.split('\n').map((u) => u.trim()).filter(Boolean) : undefined,
      });
      setShowForm(false);
      setForm({ platform_id: activePlatformId ?? '', mention_type: 'DIRECT', sentiment: '', response_excerpt: '', ranking_position: '', urls_cited: '' });
      load();
    } catch { /* swallow */ } finally { setSubmitting(false); }
  };

  const activePlatform = platforms.find((p) => p.id === activePlatformId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {!activePlatformId && (
          <select value={filterSentiment} onChange={(e) => setFilterSentiment(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos os sentimentos</option>
            <option value="POSITIVE">Positivo</option>
            <option value="NEUTRAL">Neutro</option>
            <option value="NEGATIVE">Negativo</option>
          </select>
        )}
        {activePlatform && <PlatformPill platform={activePlatform} />}
        <div className="flex-1" />
        <span className="text-xs text-gray-400">{total} resultado(s)</span>
        <Tooltip text="Registrar resultado de monitoramento de IA para este cliente">
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14} /> Registrar resultado
          </button>
        </Tooltip>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-blue-800">Registrar resultado de monitoramento</p>
            <Tooltip text="Fechar formulário">
              <button onClick={() => setShowForm(false)}><X size={14} className="text-gray-400" /></button>
            </Tooltip>
          </div>
          <p className="text-xs text-blue-600">Rode o prompt manualmente na IA e preencha o resultado aqui.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plataforma IA *</label>
              <select value={form.platform_id} onChange={(e) => setForm((f) => ({ ...f, platform_id: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione...</option>
                {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Como foi mencionado</label>
              <select value={form.mention_type} onChange={(e) => setForm((f) => ({ ...f, mention_type: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="DIRECT">Menção direta</option>
                <option value="INDIRECT">Menção indireta</option>
                <option value="CITATION">Citação de fonte</option>
                <option value="RECOMMENDATION">Recomendação</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sentimento percebido</label>
              <select value={form.sentiment} onChange={(e) => setForm((f) => ({ ...f, sentiment: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Não avaliado</option>
                <option value="POSITIVE">Positivo</option>
                <option value="NEUTRAL">Neutro</option>
                <option value="NEGATIVE">Negativo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Posição na resposta</label>
              <input type="number" min="1" value={form.ranking_position}
                onChange={(e) => setForm((f) => ({ ...f, ranking_position: e.target.value }))}
                placeholder="ex: 1 = primeiro citado"
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Trecho da resposta da IA</label>
              <textarea rows={2} value={form.response_excerpt}
                onChange={(e) => setForm((f) => ({ ...f, response_excerpt: e.target.value }))}
                placeholder="Cole aqui o trecho onde o cliente foi mencionado..."
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">URLs citadas na resposta (uma por linha)</label>
              <textarea rows={2} value={form.urls_cited}
                onChange={(e) => setForm((f) => ({ ...f, urls_cited: e.target.value }))}
                placeholder="https://www.exemplo.com.br"
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Tooltip text="Cancelar sem salvar">
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg">Cancelar</button>
            </Tooltip>
            <Tooltip text="Salvar este resultado de monitoramento">
              <button onClick={handleCreate} disabled={!form.platform_id || submitting}
                className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg transition-colors">
                {submitting ? 'Salvando...' : 'Salvar resultado'}
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-8">Carregando...</p>
      ) : mentions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Bot size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum resultado registrado ainda</p>
          <p className="text-xs mt-1">Rode os prompts nas IAs e registre os resultados aqui</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Plataforma</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Como exibido</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Trecho da resposta</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Sentimento</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Posição</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Data</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {mentions.map((m) => (
                  <MentionRow key={m.id} m={m} clientId={clientId} onDelete={() => load()} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Prompts Tab ──────────────────────────────────────────────────────────────

function PromptsTab({ clientId, platforms, activePlatformId, clientName, segment }: { clientId: string; platforms: AiPlatform[]; activePlatformId: string | null; clientName: string; segment?: string | null }) {
  const [queries, setQueries] = useState<AiQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>(
    activePlatformId ? [activePlatformId] : [],
  );

  const load = useCallback(() => {
    setLoading(true);
    geoApi.listQueries(clientId).then(setQueries).finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (activePlatformId) setSelectedPlatformIds([activePlatformId]);
  }, [activePlatformId]);

  const togglePlatform = (id: string) => {
    setSelectedPlatformIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleCreate = async () => {
    if (!newPrompt.trim()) return;
    setSubmitting(true);
    try {
      await geoApi.createQuery(clientId, {
        prompt: newPrompt.trim(),
        category: newCategory || undefined,
        platform_ids: selectedPlatformIds.length > 0 ? selectedPlatformIds : undefined,
      });
      setShowForm(false);
      setNewPrompt('');
      setNewCategory('');
      setSelectedPlatformIds(activePlatformId ? [activePlatformId] : []);
      load();
    } catch { /* swallow */ } finally { setSubmitting(false); }
  };

  const [testMenuOpenId, setTestMenuOpenId] = useState<string | null>(null);

  const handleAddBatch = async (prompts: string[]) => {
    await Promise.all(prompts.map((p) => geoApi.createQuery(clientId, { prompt: p })));
    load();
  };

  const filtered = activePlatformId
    ? queries.filter((q) => !q.platform_ids?.length || q.platform_ids.includes(activePlatformId))
    : queries;

  const active = filtered.filter((q) => q.is_active);
  const inactive = filtered.filter((q) => !q.is_active);

  return (
    <div className="space-y-4">
      {/* Sugestões sempre visíveis no topo */}
      <SuggestionChips clientName={clientName} segment={segment} onAddBatch={handleAddBatch} />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Prompts monitorados</p>
          <p className="text-xs text-gray-400 mt-0.5">{active.length} ativos · {inactive.length} pausados</p>
        </div>
        <Tooltip text="Adicionar um prompt personalizado para monitorar nas IAs">
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14} /> Prompt personalizado
          </button>
        </Tooltip>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-blue-800">Prompt personalizado</p>
            <Tooltip text="Fechar formulário">
              <button onClick={() => setShowForm(false)}><X size={14} className="text-gray-400" /></button>
            </Tooltip>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prompt / Query *</label>
            <input value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)}
              placeholder='ex: "melhores agências de SEO em São Paulo"'
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
              placeholder='ex: SEO, GEO, Marketing Digital'
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Monitorar nas plataformas</label>
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => {
                const c = getPlatformColor(p.slug);
                const sel = selectedPlatformIds.includes(p.id);
                return (
                  <Tooltip key={p.id} text={sel ? `Remover ${p.name}` : `Monitorar em ${p.name}`}>
                    <button type="button" onClick={() => togglePlatform(p.id)}
                      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                        sel ? `${c.bg} ${c.text} border-transparent ring-2 ring-offset-1` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      {p.name}
                      {sel && <X size={10} />}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
            {selectedPlatformIds.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Nenhuma selecionada = todas as plataformas</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg">Cancelar</button>
            <button onClick={handleCreate} disabled={!newPrompt.trim() || submitting}
              className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg transition-colors">
              {submitting ? 'Salvando...' : 'Salvar prompt'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum prompt cadastrado</p>
          <p className="text-xs mt-1">Adicione prompts para monitorar a visibilidade nas IAs</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const assignedPlatforms = platforms.filter((p) => q.platform_ids?.includes(p.id));
            const testPlatforms = assignedPlatforms.length > 0 ? assignedPlatforms : platforms;
            const isTestOpen = testMenuOpenId === q.id;
            return (
              <div key={q.id} className={`rounded-xl border transition-colors ${q.is_active ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                <div className="flex items-start gap-3 p-3.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${q.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium">{q.prompt}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {q.category && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{q.category}</span>
                      )}
                      {assignedPlatforms.length > 0
                        ? assignedPlatforms.map((p) => <PlatformPill key={p.id} platform={p} size="xs" />)
                        : <span className="text-xs text-gray-400">Todas as plataformas</span>
                      }
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Adicionado em {new Date(q.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Tooltip text="Abrir este prompt em uma IA para testar">
                      <button
                        onClick={() => setTestMenuOpenId(isTestOpen ? null : q.id)}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${isTestOpen ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600'}`}
                      >
                        <ExternalLink size={11} />
                        Testar
                      </button>
                    </Tooltip>
                    <Tooltip text={q.is_active ? 'Pausar monitoramento deste prompt' : 'Reativar monitoramento deste prompt'}>
                      <button onClick={async () => { await geoApi.updateQuery(clientId, q.id, { is_active: !q.is_active }); load(); }}
                        className="text-xs text-gray-400 hover:text-blue-600 transition-colors px-2 py-1 rounded">
                        {q.is_active ? 'Pausar' : 'Ativar'}
                      </button>
                    </Tooltip>
                    <Tooltip text="Remover este prompt">
                      <button onClick={async () => { if (confirm('Remover este prompt?')) { await geoApi.deleteQuery(clientId, q.id); load(); } }}
                        className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
                {isTestOpen && (
                  <div className="border-t border-gray-100 px-4 pb-3 pt-2.5">
                    <p className="text-xs text-gray-400 mb-2">Abrir prompt em:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {testPlatforms.map((p) => {
                        const c = getPlatformColor(p.slug);
                        return (
                          <a
                            key={p.id}
                            href={getTestUrl(p.slug, q.prompt)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setTestMenuOpenId(null)}
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium border-0 transition-opacity hover:opacity-80 ${c.bg} ${c.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                            {p.name}
                            <ExternalLink size={9} className="opacity-60" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sources Tab ──────────────────────────────────────────────────────────────

function SourcesTab({ clientId }: { clientId: string }) {
  const [sources, setSources] = useState<AiSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    geoApi.listSources(clientId).then(setSources).finally(() => setLoading(false));
  }, [clientId]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700">Fontes mais citadas pelas IAs</p>
        <p className="text-xs text-gray-400 mt-0.5">Domínios que as IAs referenciam ao mencionar o cliente</p>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-8">Carregando...</p>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Globe size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma fonte registrada ainda</p>
          <p className="text-xs mt-1">Fontes aparecem automaticamente ao registrar resultados com URLs</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Domínio</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Citações</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Autoridade</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Última vez</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sources.map((s, i) => (
                <tr key={s.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe size={12} className="text-gray-400" />
                      <span className="text-sm text-gray-800 font-medium">{s.domain}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{s.citation_count}</span>
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min((s.citation_count / (sources[0]?.citation_count || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.authority_score != null
                      ? <span className="text-xs font-medium text-gray-700">{Number(s.authority_score).toFixed(1)}</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {s.last_seen_at ? new Date(s.last_seen_at).toLocaleDateString('pt-BR') : '—'}
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

// ─── Competitors Tab ──────────────────────────────────────────────────────────

function CompetitorsTab({ clientId }: { clientId: string }) {
  const [competitors, setCompetitors] = useState<AiCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ competitor_name: '', competitor_domain: '' });

  const load = useCallback(() => {
    setLoading(true);
    geoApi.listCompetitors(clientId).then(setCompetitors).finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.competitor_name.trim()) return;
    setSubmitting(true);
    try {
      await geoApi.createCompetitor(clientId, {
        competitor_name: form.competitor_name.trim(),
        competitor_domain: form.competitor_domain || undefined,
      });
      setShowForm(false);
      setForm({ competitor_name: '', competitor_domain: '' });
      load();
    } catch { /* swallow */ } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Concorrentes rastreados</p>
          <p className="text-xs text-gray-400 mt-0.5">Compare a visibilidade nas IAs generativas</p>
        </div>
        <Tooltip text="Adicionar um concorrente para comparar visibilidade nas IAs">
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14} /> Adicionar
          </button>
        </Tooltip>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-blue-800">Novo concorrente</p>
            <Tooltip text="Fechar formulário">
              <button onClick={() => setShowForm(false)}><X size={14} className="text-gray-400" /></button>
            </Tooltip>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
              <input value={form.competitor_name} onChange={(e) => setForm((f) => ({ ...f, competitor_name: e.target.value }))}
                placeholder='ex: Agência Concorrente'
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Domínio</label>
              <input value={form.competitor_domain} onChange={(e) => setForm((f) => ({ ...f, competitor_domain: e.target.value }))}
                placeholder='ex: concorrente.com.br'
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Tooltip text="Cancelar sem salvar">
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg">Cancelar</button>
            </Tooltip>
            <Tooltip text="Salvar o concorrente">
              <button onClick={handleCreate} disabled={!form.competitor_name.trim() || submitting}
                className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg transition-colors">
                {submitting ? 'Salvando...' : 'Salvar'}
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-8">Carregando...</p>
      ) : competitors.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum concorrente cadastrado</p>
          <p className="text-xs mt-1">Adicione concorrentes para comparar visibilidade nas IAs</p>
        </div>
      ) : (
        <div className="space-y-2">
          {competitors.map((c) => (
            <div key={c.id} className={`flex items-center gap-3 p-3.5 rounded-xl border bg-white ${c.is_active ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}>
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Users size={14} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{c.competitor_name}</p>
                {c.competitor_domain && <p className="text-xs text-gray-400 mt-0.5">{c.competitor_domain}</p>}
              </div>
              <Tooltip text="Remover este concorrente">
                <button onClick={async () => { if (confirm('Remover concorrente?')) { await geoApi.deleteCompetitor(clientId, c.id); load(); } }}
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main GeoTab ──────────────────────────────────────────────────────────────

export function GeoTab({ clientId, clientName, segment }: { clientId: string; clientName: string; segment?: string | null }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');
  const [overview, setOverview] = useState<GeoOverview | null>(null);
  const [platforms, setPlatforms] = useState<AiPlatform[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState(false);
  const [activePlatformId, setActivePlatformId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ mentions: number; errors: number } | null>(null);

  const loadOverview = () => {
    geoApi.overview(clientId)
      .then(setOverview)
      .catch(() => setOverviewError(true))
      .finally(() => setLoadingOverview(false));
  };

  useEffect(() => {
    geoApi.platforms().then(setPlatforms).catch(() => {});
    loadOverview();
  }, [clientId]);

  const handleRun = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await geoApi.run(clientId);
      setRunResult(result);
      loadOverview();
    } catch {
      setRunResult({ mentions: 0, errors: 1 });
    } finally {
      setRunning(false);
    }
  };

  const activePlatform = platforms.find((p) => p.id === activePlatformId) ?? null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-blue-900 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">AI Visibility Center</h2>
              <p className="text-sm text-blue-200 mt-0.5">{clientName}</p>
              <p className="text-xs text-blue-300 mt-1.5">
                {activePlatform ? `Filtrando por ${activePlatform.name}` : 'Todas as plataformas · ChatGPT, Gemini, Perplexity, AI Overview...'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {overview && (
              <div className="text-right space-y-1">
                <p className="text-2xl font-black text-white leading-none">
                  {overview.visibility_score != null ? `${overview.visibility_score.toFixed(0)}%` : '—'}
                </p>
                <p className="text-xs text-blue-300">Visibilidade</p>
                {overview.mention_count > 0 && (
                  <p className="text-xs text-blue-200">{overview.mention_count} menções</p>
                )}
              </div>
            )}
            <Tooltip text="Enviar prompts ao ChatGPT e Gemini agora e registrar menções automaticamente">
              <button
                onClick={handleRun}
                disabled={running}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
                {running ? 'Analisando...' : 'Executar análise'}
              </button>
            </Tooltip>
            {runResult && (
              <p className="text-xs text-blue-200">
                {runResult.errors > 0
                  ? `${runResult.mentions} menções · ${runResult.errors} erro(s)`
                  : runResult.mentions > 0
                  ? `✓ ${runResult.mentions} menção(ões) encontrada(s)`
                  : '✓ Nenhuma menção encontrada'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Platform filter */}
      {platforms.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <PlatformSelector platforms={platforms} selected={activePlatformId} onSelect={setActivePlatformId} />
        </div>
      )}

      {/* Sub-tab nav */}
      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
        {SUB_TABS.map(({ key, label, icon: Icon, tip }) => (
          <Tooltip key={key} text={tip} position="bottom">
            <button onClick={() => setActiveSubTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg -mb-px border-b-2 ${
                activeSubTab === key
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={13} />
              {label}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Content */}
      {activeSubTab === 'overview' && (
        loadingOverview
          ? <p className="text-xs text-gray-400 text-center py-8">Carregando painel...</p>
          : overviewError
            ? <div className="text-center py-12 text-gray-400">
                <AlertCircle size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Erro ao carregar dados</p>
                <p className="text-xs mt-1">Verifique a conexão ou tente recarregar</p>
              </div>
            : overview
              ? <OverviewTab overview={overview} />
              : null
      )}
      {activeSubTab === 'mentions'    && <MentionsTab clientId={clientId} platforms={platforms} activePlatformId={activePlatformId} />}
      {activeSubTab === 'prompts'     && <PromptsTab  clientId={clientId} platforms={platforms} activePlatformId={activePlatformId} clientName={clientName} segment={segment} />}
      {activeSubTab === 'sources'     && <SourcesTab  clientId={clientId} />}
      {activeSubTab === 'competitors' && <CompetitorsTab clientId={clientId} />}
    </div>
  );
}
