import { contrastOn } from '@/lib/format';

/** Two-sided comparison bar. Values are compared proportionally. */
export function CompareBar({
  label,
  home,
  away,
  homeColor,
  awayColor,
  format = (v: number) => String(Math.round(v)),
  invert = false,
}: {
  label: string;
  home: number;
  away: number;
  homeColor: string;
  awayColor: string;
  format?: (v: number) => string;
  invert?: boolean;
}) {
  const total = home + away;
  const homePct = total > 0 ? (home / total) * 100 : 50;
  const awayPct = 100 - homePct;
  const homeBetter = invert ? home < away : home > away;
  const awayBetter = invert ? away < home : away > home;

  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span
          className={`tabular text-sm font-semibold ${
            homeBetter ? 'text-chalk-100' : 'text-chalk-500'
          }`}
        >
          {format(home)}
        </span>
        <span className="label-xs shrink-0">{label}</span>
        <span
          className={`tabular text-sm font-semibold ${
            awayBetter ? 'text-chalk-100' : 'text-chalk-500'
          }`}
        >
          {format(away)}
        </span>
      </div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        <div
          className="rounded-l-full transition-all"
          style={{
            width: `${homePct}%`,
            background: homeColor,
            opacity: homeBetter ? 1 : 0.42,
          }}
        />
        <div
          className="rounded-r-full transition-all"
          style={{
            width: `${awayPct}%`,
            background: awayColor,
            opacity: awayBetter ? 1 : 0.42,
          }}
        />
      </div>
    </div>
  );
}

/** Possession-style split header */
export function SplitGauge({
  homeLabel,
  awayLabel,
  homeValue,
  awayValue,
  homeColor,
  awayColor,
  caption,
}: {
  homeLabel: string;
  awayLabel: string;
  homeValue: number;
  awayValue: number;
  homeColor: string;
  awayColor: string;
  caption: string;
}) {
  const total = homeValue + awayValue;
  const homePct = total > 0 ? Math.round((homeValue / total) * 100) : 50;

  return (
    <div>
      <div className="label-xs mb-2 text-center">{caption}</div>
      <div className="flex h-9 overflow-hidden rounded-lg">
        <div
          className="flex items-center justify-start px-3 text-sm font-bold transition-all"
          style={{
            width: `${homePct}%`,
            background: homeColor,
            color: contrastOn(homeColor),
          }}
        >
          {homePct >= 18 && `${homePct}%`}
        </div>
        <div
          className="flex items-center justify-end px-3 text-sm font-bold transition-all"
          style={{
            width: `${100 - homePct}%`,
            background: awayColor,
            color: contrastOn(awayColor),
          }}
        >
          {100 - homePct >= 18 && `${100 - homePct}%`}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-chalk-600">
        <span className="truncate">{homeLabel}</span>
        <span className="truncate">{awayLabel}</span>
      </div>
    </div>
  );
}
