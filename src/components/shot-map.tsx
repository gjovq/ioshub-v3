'use client';

import { useState } from 'react';
import { BODY_PART_LABEL } from '@/lib/enums';
import type { Vec2 } from '@/lib/types';

export type Shot = {
  playerName: string;
  event: string;
  isGoal: boolean;
  minute: number;
  team: 'home' | 'away';
  startPosition: Vec2 | null;
  bodyPart?: number;
};

/**
 * Rough xG estimate from shot distance and angle. Not an official model — the
 * engine's per-shot expectedGoals stat is only in aggregate stat arrays, never
 * on the event itself. Distance dominates; tight angle reduces the chance.
 */
function estimateXg(p: Vec2, fieldHalfLength: number, fieldHalfWidth: number): number {
  const d = Math.hypot(p.x / fieldHalfWidth, p.y / fieldHalfLength); // 0 = goal line centre
  const angleFactor = Math.max(0.25, 1 - Math.abs(p.x) / (fieldHalfWidth * 1.6));
  return Math.max(0.01, Math.min(0.95, 0.75 * Math.exp(-1.35 * d) * angleFactor));
}

/**
 * Shot map. The engine's pitch runs -x..+x across and -y..+y along the length;
 * home attacks +y, away attacks -y. Both sides are mirrored onto one half so
 * every shot attacks the goal at the top. Shots are clickable: selecting one
 * shows shooter, event type, body part, minute and the estimated xG.
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
  const [selected, setSelected] = useState<number | null>(null);

  const W = 320;
  const H = 240;
  const halfX = Math.max(1, (fieldMax.x - fieldMin.x) / 2);
  const halfY = Math.max(1, (fieldMax.y - fieldMin.y) / 2);

  const plotted = shots
    .map((s, i) => {
      if (!s.startPosition) return null;
      const p = s.startPosition;
      // mirror the away side so every shot attacks the top goal
      const x = s.team === 'home' ? p.x : -p.x;
      const y = s.team === 'home' ? p.y : -p.y;
      // -1..1 across, 0..1 depth from own half towards the top goal
      const nx = Math.max(-1, Math.min(1, x / halfX));
      const ny = Math.max(0, Math.min(1, y / halfY));
      return {
        key: i,
        cx: W / 2 + (nx * (W / 2 - 10)),
        // 0..1 depth maps to bottom (own half) .. top (goal)
        cy: H - 8 - ny * (H - 30),
        xg: estimateXg({ x, y }, halfY, halfX),
        shot: s,
      };
    })
    .filter((p) => p !== null);

  const goals = plotted.filter((p) => p.shot.isGoal);
  const others = plotted.filter((p) => !p.shot.isGoal);
  const sel = selected != null ? plotted.find((p) => p.key === selected) : null;

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
          {/* halfway line */}
          <line x1="4" y1={H / 2} x2={W - 4} y2={H / 2} strokeDasharray="4 4" />
        </g>
        {/* goal */}
        <rect x={W / 2 - 22} y="0" width="44" height="5" fill="rgba(226,232,240,0.5)" rx="1" />

        {others.map((p) => (
          <circle
            key={`o${p.key}`}
            cx={p.cx}
            cy={p.cy}
            r={selected === p.key ? 5.5 : 3.5}
            fill="none"
            strokeWidth="1.5"
            stroke={p.shot.team === 'home' ? homeColor : awayColor}
            opacity={selected == null || selected === p.key ? 0.8 : 0.3}
            className="cursor-pointer transition-all"
            onClick={() => setSelected(selected === p.key ? null : p.key)}
          />
        ))}
        {goals.map((p) => (
          <g
            key={`g${p.key}`}
            className="cursor-pointer"
            onClick={() => setSelected(selected === p.key ? null : p.key)}
          >
            <circle
              cx={p.cx}
              cy={p.cy}
              r={selected === p.key ? 9 : 7}
              fill={p.shot.team === 'home' ? homeColor : awayColor}
              opacity={selected == null || selected === p.key ? 0.25 : 0.1}
              className="transition-all"
            />
            <circle
              cx={p.cx}
              cy={p.cy}
              r={selected === p.key ? 6 : 4.5}
              fill={p.shot.team === 'home' ? homeColor : awayColor}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="1.2"
              className="transition-all"
            />
          </g>
        ))}
      </svg>

      {sel ? (
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.05]"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-6 w-1 shrink-0 rounded-full"
              style={{ background: sel.shot.team === 'home' ? homeColor : awayColor }}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-chalk-100">
                {sel.shot.isGoal ? '⚽ ' : ''}
                {sel.shot.playerName}
              </span>
              <span className="block truncate text-[11px] text-chalk-500">
                {sel.shot.event.toLowerCase()} · {sel.shot.minute}&apos;
                {bodyPartOf(sel.shot) > 0 && ` · ${BODY_PART_LABEL[bodyPartOf(sel.shot)]}`}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[10px] uppercase tracking-wider text-chalk-600">xG</span>
            <span className="tabular block font-display text-base font-bold text-chalk-100">
              {sel.xg.toFixed(2)}
            </span>
          </span>
        </button>
      ) : (
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
          <span className="text-chalk-600">tap a shot for details</span>
        </div>
      )}
    </div>
  );
}

/** bodyPart rides on the event; carry it through the plotted shot. */
function bodyPartOf(shot: Shot): number {
  return shot.bodyPart ?? 0;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="max-w-[9rem] truncate">{label}</span>
    </span>
  );
}
