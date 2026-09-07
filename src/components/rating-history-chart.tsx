import type { RatingPoint } from '@/lib/rating-history';

export function RatingHistoryChart({ points }: { points: RatingPoint[] }) {
  const data = points.filter((p) => Number.isFinite(p.rating)).slice(-24);
  if (data.length < 2) return null;
  const min = Math.min(...data.map((p) => p.rating));
  const max = Math.max(...data.map((p) => p.rating));
  const range = Math.max(1, max - min);
  const x = (i: number) => (i / (data.length - 1)) * 600;
  const y = (rating: number) => 120 - ((rating - min) / range) * 100;
  const line = data.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p.rating).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox="0 0 600 140" className="w-full" role="img"
        aria-label={`Rating history from ${data.length} stored observations, from ${min.toFixed(2)} to ${max.toFixed(2)}`}>
        <line x1="0" y1="120" x2="600" y2="120" stroke="rgba(148,163,184,0.2)" />
        <path d={line} fill="none" stroke="#22c55e" strokeWidth="2.5" />
        {data.map((p, i) => <circle key={`${p.observedAt}-${i}`} cx={x(i)} cy={y(p.rating)} r="3" fill="#22c55e"><title>{`${new Date(p.observedAt).toLocaleDateString('en-GB')} · ${p.rating.toFixed(2)}`}</title></circle>)}
      </svg>
      <p className="mt-1 text-[11px] text-chalk-500">Stored snapshots only. This history is not supplied by IOSoccer.</p>
    </div>
  );
}
