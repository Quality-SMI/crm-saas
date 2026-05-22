'use client';

interface Props {
  score: number | null;
  size?: 'sm' | 'md';
}

function scoreColor(s: number) {
  if (s >= 70) return 'bg-green-100 text-green-700 border-green-200';
  if (s >= 40) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function scoreLabel(s: number) {
  if (s >= 70) return 'Bom';
  if (s >= 40) return 'Médio';
  return 'Ruim';
}

export function ScoreBadge({ score, size = 'sm' }: Props) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-gray-100 text-gray-400 border-gray-200">
        —
      </span>
    );
  }

  const color = scoreColor(score);
  const label = scoreLabel(score);
  const rounded = Math.round(score);

  if (size === 'md') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${color}`}>
        <span>{rounded}</span>
        <span className="text-xs font-normal opacity-70">{label}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      {rounded}
    </span>
  );
}
