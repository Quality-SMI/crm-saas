'use client';

import { useEffect, useState } from 'react';
import { X, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { scoresApi, ClientScore } from '@/lib/api/scores';

interface Props {
  clientId: string;
  onClose: () => void;
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-green-500';
  if (s >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function scoreText(s: number) {
  if (s >= 70) return 'text-green-700';
  if (s >= 40) return 'text-yellow-700';
  return 'text-red-700';
}

function scoreBgLight(s: number) {
  if (s >= 70) return 'bg-green-50 border-green-200';
  if (s >= 40) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

function DimBar({ label, value, max = 25 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span className="font-semibold">{Math.round(value)}/{max}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${scoreBg(pct)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TrendIcon({ current, prev }: { current: number; prev: number }) {
  const diff = current - prev;
  if (diff > 2) return <TrendingUp size={14} className="text-green-600" />;
  if (diff < -2) return <TrendingDown size={14} className="text-red-600" />;
  return <Minus size={14} className="text-gray-400" />;
}

function buildSuggestions(score: ClientScore, prev: ClientScore | null): string[] {
  const tips: string[] = [];
  const s = score;
  const m = s.metadata;

  if (Number(s.score_access) < 8) {
    tips.push('Impressões muito baixas: publique mais conteúdo otimizado para as palavras-chave principais e considere link building para aumentar a visibilidade.');
  } else if (Number(s.score_access) < 15) {
    tips.push('Impressões abaixo do potencial: expanda a cobertura com artigos de cauda longa para ganhar mais exposição nos resultados de busca.');
  }

  if (Number(s.score_clicks) < 8) {
    tips.push('Cliques baixos: revise os títulos (title tags) e meta descriptions para torná-los mais atrativos e relevantes ao usuário.');
  } else if (Number(s.score_clicks) < 15) {
    tips.push('CTR pode melhorar: teste variações de title e description nas páginas mais impressionadas.');
  }

  if (Number(s.score_positioning) < 10) {
    const pos = m?.avgPosition;
    tips.push(`Posição média ${pos ? `(${Number(pos).toFixed(1)})` : ''} está alta: priorize otimização on-page das páginas mais importantes — headings, velocidade e conteúdo de qualidade.`);
  } else if (Number(s.score_positioning) < 20) {
    tips.push('Há espaço para melhorar posicionamento: foque em link building interno e externo para as páginas mais próximas do top 3.');
  }

  if (Number(s.score_indexation) < 10) {
    const pages = m?.pagesCount ?? 0;
    tips.push(`Apenas ${pages} página${pages !== 1 ? 's' : ''} com impressões no Google: verifique o sitemap.xml, robots.txt e a cobertura de indexação no Search Console.`);
  } else if (Number(s.score_indexation) < 17) {
    tips.push('Aumente o volume de páginas indexadas: crie novos conteúdos e certifique-se de que todas as páginas estratégicas estão no sitemap.');
  }

  if (prev) {
    const diff = Number(s.score) - Number(prev.score);
    if (diff < -10) {
      tips.push(`Queda de ${Math.abs(Math.round(diff))} pontos em relação à análise anterior: verifique se houve penalidade manual, perda de links ou queda de conteúdo relevante.`);
    } else if (diff > 10) {
      tips.push(`Alta de ${Math.round(diff)} pontos desde a última análise — ótimo resultado! Mantenha a cadência de publicação e monitoramento.`);
    }
  }

  if (tips.length === 0) {
    tips.push('O desempenho está bom! Continue monitorando para identificar oportunidades de crescimento e mantenha a regularidade na produção de conteúdo.');
  }

  return tips;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n);
}

export function ScorePanel({ clientId, onClose }: Props) {
  const [history, setHistory] = useState<ClientScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    scoresApi.history(clientId).then(setHistory).finally(() => setLoading(false));
  }, [clientId]);

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      const updated = await scoresApi.recalculate(clientId);
      setHistory((prev) => [updated, ...prev]);
    } finally {
      setRecalculating(false);
    }
  }

  const current = history[0] ?? null;
  const prev = history[1] ?? null;
  const diff = current && prev ? Number(current.score) - Number(prev.score) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-white shadow-2xl border-l border-gray-200 overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-gray-900">Análise de Desempenho</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Carregando...</div>
        ) : !current ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm font-medium text-gray-700">Score ainda não calculado</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Para calcular, o cliente precisa ter dados no Google Search Console. Vá até a aba
              {' '}<strong>Posicionamento Google</strong> e clique em <strong>Atualizar agora</strong>. Depois clique em Calcular.
            </p>
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              <RefreshCw size={14} className={recalculating ? 'animate-spin' : ''} />
              {recalculating ? 'Calculando...' : 'Calcular agora'}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5 flex-1">
            {/* Score card */}
            <div className={`rounded-xl border p-4 ${scoreBgLight(Number(current.score))}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className={`text-4xl font-bold ${scoreText(Number(current.score))}`}>
                    {Math.round(Number(current.score))}
                    <span className="text-lg font-normal opacity-50">/100</span>
                  </div>
                  {diff !== null && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <TrendIcon current={Number(current.score)} prev={Number(prev!.score)} />
                      {diff > 0 ? '+' : ''}{Math.round(diff)} pts desde {fmtDate(prev!.calculated_at)}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-white border border-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={recalculating ? 'animate-spin' : ''} />
                  Recalcular
                </button>
              </div>
              <p className="text-xs text-gray-500">Última atualização: {fmtDate(current.calculated_at)}</p>
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Breakdown do Score</h3>
              <DimBar label="Acesso (impressões)" value={Number(current.score_access)} />
              <DimBar label="Cliques" value={Number(current.score_clicks)} />
              <DimBar label="Posicionamento" value={Number(current.score_positioning)} />
              <DimBar label="Indexação (páginas)" value={Number(current.score_indexation)} />
            </div>

            {/* Raw data */}
            {current.metadata && (
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Dados do snapshot · {current.metadata.latestSnapshotDate ? new Date(current.metadata.latestSnapshotDate).toLocaleDateString('pt-BR') : ''}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Impressões</p>
                    <p className="font-semibold text-gray-900">{fmtNum(current.metadata.currentImpressions)}</p>
                    {current.metadata.hasPrevious && (
                      <p className="text-xs text-gray-400">ant: {fmtNum(current.metadata.prevImpressions)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Cliques</p>
                    <p className="font-semibold text-gray-900">{fmtNum(current.metadata.currentClicks)}</p>
                    {current.metadata.hasPrevious && (
                      <p className="text-xs text-gray-400">ant: {fmtNum(current.metadata.prevClicks)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Posição média</p>
                    <p className="font-semibold text-gray-900">
                      {current.metadata.avgPosition ? Number(current.metadata.avgPosition).toFixed(1) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Páginas com impressões</p>
                    <p className="font-semibold text-gray-900">{current.metadata.pagesCount}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Sugestões de Melhoria</h3>
              {buildSuggestions(current, prev).map((tip, i) => (
                <div key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                  <p>{tip}</p>
                </div>
              ))}
            </div>

            {/* History */}
            {history.length > 1 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Histórico</h3>
                <div className="space-y-2">
                  {history.slice(0, 6).map((h, i) => (
                    <div key={h.id} className="flex items-center gap-3 text-sm">
                      <span className={`w-10 font-semibold text-right ${scoreText(Number(h.score))}`}>
                        {Math.round(Number(h.score))}
                      </span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${scoreBg(Number(h.score))}`}
                          style={{ width: `${Math.round(Number(h.score))}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-24 text-right">{fmtDate(h.calculated_at)}</span>
                      {i === 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Atual</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
