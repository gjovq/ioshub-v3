import type { Vec2 } from '@/lib/types';

type Shot = {
  playerName: string;
  event: string;
  isGoal: boolean;
  minute: number;
  team: 'home' | 'away';
  startPosition: Vec2 | null;
};

/**
 * Shot map. The engine's pitch runs -x..+x across and -y..+y along the length;
 * home attacks +y, away attacks -y. Both sides are mirrored onto one half so
 * the attacking direction is always upward.
 */
export function ShotMap({
  shots,
  fieldMin,
  fieldMax,
  homeColor,
  awayColor,
  homeName,
  awayName,
}: {
  shots: Shot[];
  fieldMin: Vec2;
  fieldMax: Vec2;
  homeColor: string;
  awayColor: string;
  homeName: string;
  awayName: string;
}) {
  const W = 320;
  const H = 240;
  const spanX = Math.max(1, fieldMax.x - fieldMin.x);
  const spanY = Math.max(1, fieldMax.y - fieldMin.y);

  const plotted = shots
    .filter((s) => s.startPosition)
    .map((s, i) => {
      const p = s.startPosition!;
      // mirror the away side so every shot attacks the same goal
      const y = s.team === 'home' ? p.y : -p.y;
      const x = s.team === 'home' ? p.x : -p.x;
      // normalise to 0..1 over the attacking half
      const ny = Math.min(1, Math.max(0, (y - fieldMin.y) / spanY));
      const nx = Math.min(1, Math.max(0, (x - fieldMin.x) / spanX));
      return {
        key: i,
        cx: nx * W,
        cy: H - Math.max(0, (ny - 0.5) * 2) * H,
        shot: s,
      };
    });

  const goals = plotted.filter((p) => p.shot.isGoal);
  const others = plotted.filter((p) => !p.shot.isGoal);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Shot map">
        {/* pitch */}
        <rect x="0" y="0" width={W} height={H} fill="rgba(34,197,94,0.035)" rx="6" />
        <g stroke="rgba(148,163,184,0.18)" strokeWidth="1" fill="none">
          <rect x="4" y="4" width={W - 8} height={H - 8} rx="4" />
          <rect x={W / 2 - 66} y="4" width="132" height="52" />
          <rect x={W / 2 - 30} y="4" width="60" height="20" />
          <circle cx={W / 2} cy="42" r="3" fill="rgba(148,163,184,0.35)" stroke="none" />
          <path d={`M ${W / 2 - 40} 56 A 44 44 0 0 0 ${W / 2 + 40} 56`} />
          <line x1="4" y1={H - 4} x2={W - 4} y2={H - 4} strokeDasharray="4 4" />
        </g>
        {/* goal */}
        <rect
          x={W / 2 - 22}
          y="0"
          width="44"
          height="5"
          fill="rgba(226,232,240,0.5)"
          rx="1"
        />

        {others.map((p) => (
          <circle
            key={`o${p.key}`}
            cx={p.cx}
            cy={p.cy}
            r="3.5"
            fill="none"
            strokeWidth="1.5"
            stroke={p.shot.team === 'home' ? homeColor : awayColor}
            opacity="0.55"
          >
            <title>{`${p.shot.playerName} · ${p.shot.event.toLowerCase()} · ${p.shot.minute}'`}</title>
          </circle>
        ))}
        {goals.map((p) => (
          <g key={`g${p.key}`}>
            <circle
              cx={p.cx}
              cy={p.cy}
              r="7"
              fill={p.shot.team === 'home' ? homeColor : awayColor}
              opacity="0.18"
            />
            <circle
              cx={p.cx}
              cy={p.cy}
              r="4.5"
              fill={p.shot.team === 'home' ? homeColor : awayColor}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="1.2"
            >
              <title>{`⚽ ${p.shot.playerName} · ${p.shot.minute}'`}</title>
            </circle>
          </g>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-chalk-500">
        <LegendDot color={homeColor} label={homeName} />
        <LegendDot color={awayColor} label={awayName} />
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-chalk-500" />
          attempt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-chalk-300" />
          goal
        </span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="max-w-[9rem] truncate">{label}</span>
    </span>
  );
}
