import type { PerformancePoint } from '@/lib/types';

/** Compact multi-series line chart for monthly performance. */
export function PerformanceChart({
  points,
  height = 150,
}: {
  points: PerformancePoint[];
  height?: number;
}) {
  const data = points.filter((p) => p.appearances > 0).slice(-18);
  if (data.length < 2) return null;

  const W = 600;
  const H = height;
  const padL = 4;
  const padB = 22;
  const padT = 8;
  const innerW = W - padL * 2;
  const innerH = H - padB - padT;

  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.averageGoals, d.averageAssists, d.averageGoalsConceded)),
  );

  const x = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const y = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const line = (key: 'averageGoals' | 'averageAssists' | 'averageGoalsConceded') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

  const area = `${line('averageGoals')} L ${x(data.length - 1).toFixed(1)} ${padT + innerH} L ${padL} ${padT + innerH} Z`;

  const labelEvery = Math.ceil(data.length / 6);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={W - padL}
            y1={padT + innerH * f}
            y2={padT + innerH * f}
            stroke="rgba(148,163,184,0.08)"
            strokeWidth="1"
          />
        ))}
        <defs>
          <linearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#goalFill)" />
        <path d={line('averageGoalsConceded')} fill="none" stroke="#ef4444" strokeWidth="1.6" opacity="0.55" strokeLinejoin="round" />
        <path d={line('averageAssists')} fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinejoin="round" />
        <path d={line('averageGoals')} fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.averageGoals)} r="2.4" fill="#22c55e">
            <title>{`${monthLabel(d)} · ${d.averageGoals.toFixed(2)} goals/match over ${d.appearances} apps`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[10px] text-chalk-600">
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <span key={i}>{monthLabel(d)}</span>
          ) : null,
        )}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-chalk-500">
        <Legend color="#22c55e" label="Goals / match" />
        <Legend color="#38bdf8" label="Assists / match" />
        <Legend color="#ef4444" label="Conceded / match" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function monthLabel(p: PerformancePoint): string {
  if (p.month != null) {
    return new Date(p.year, p.month - 1, 1).toLocaleDateString('en-GB', {
      month: 'short',
      year: '2-digit',
    });
  }
  if (p.week != null) return `W${p.week} ${String(p.year).slice(2)}`;
  return String(p.year);
}

/** Win / draw / loss distribution bar. */
export function ResultsBar({
  wins,
  draws,
  losses,
  showLabels = true,
}: {
  wins: number;
  draws: number;
  losses: number;
  showLabels?: boolean;
}) {
  const total = wins + draws + losses;
  if (total === 0) return null;
  const w = (wins / total) * 100;
  const d = (draws / total) * 100;
  const l = (losses / total) * 100;

  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        <div style={{ width: `${w}%` }} className="bg-turf-500" title={`${wins} wins`} />
        <div style={{ width: `${d}%` }} className="bg-chalk-500/50" title={`${draws} draws`} />
        <div style={{ width: `${l}%` }} className="bg-red-500/80" title={`${losses} losses`} />
      </div>
      {showLabels && (
        <div className="mt-2 flex justify-between text-[11px]">
          <span className="text-turf-400">
            <span className="tabular font-bold">{wins}</span> W
          </span>
          <span className="text-chalk-500">
            <span className="tabular font-bold">{draws}</span> D
          </span>
          <span className="text-red-400">
            <span className="tabular font-bold">{losses}</span> L
          </span>
        </div>
      )}
    </div>
  );
}

/** Activity heat strip: matches per day over the last year. */
export function ActivityStrip({
  data,
  weeks = 40,
}: {
  data: { matches: number; matchDayDate: string }[];
  weeks?: number;
}) {
  if (data.length === 0) return null;

  const byDay = new Map<string, number>();
  for (const d of data) {
    const key = new Date(d.matchDayDate).toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + d.matches);
  }

  const today = new Date();
  const days: { key: string; count: number }[] = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const dt = new Date(today.getTime() - i * 86400000);
    const key = dt.toISOString().slice(0, 10);
    days.push({ key, count: byDay.get(key) ?? 0 });
  }

  const max = Math.max(1, ...days.map((d) => d.count));
  const cols: { key: string; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7));

  const shade = (n: number) => {
    if (n === 0) return 'rgba(148,163,184,0.06)';
    const t = Math.min(1, n / max);
    return `rgba(34,197,94,${0.2 + t * 0.7})`;
  };

  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {cols.map((col, ci) => (
          <div key={ci} className="flex shrink-0 flex-col gap-[3px]">
            {col.map((d) => (
              <span
                key={d.key}
                title={`${d.key}: ${d.count} match${d.count === 1 ? '' : 'es'}`}
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ background: shade(d.count) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-chalk-600">
        Less
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span
            key={f}
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ background: shade(f * max) }}
          />
        ))}
        More
      </div>
    </div>
  );
}
