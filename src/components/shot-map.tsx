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
  /** which period the shot happened in, used to account for end swaps */
  period?: string;
};

/**
 * Rough xG estimate from shot distance and angle to the shooting team's
 * *attacking* goal. Not an official model — the engine's per-shot
 * expectedGoals stat is only in aggregate stat arrays, never on the event
 * itself.
 */
function estimateXg(
  p: Vec2,
  team: 'home' | 'away',
  field: { halfX: number; halfY: number },
  swapped: boolean,
): number {
  // goal mouth centre of the team's attacking end; teams swap ends at half-time
  const attackingEnd = team === 'home' ? (swapped ? -1 : 1) : swapped ? 1 : -1;
  const goalY = attackingEnd * field.halfY;
  // normalised offsets from the goal mouth: 1 unit = half pitch width/length
  const dx = p.x / field.halfX;
  const dy = (p.y - goalY) / (field.halfY * 2);
  // across axis contributes less (pitch is ~2x longer than wide)
  const dist = Math.hypot(dx * 0.45, dy);

  // angle: how much of the goal is visible from the shot position
  const goalHalfWidth = 0.12; // goal mouth as a fraction of pitch width, tuned
  const angle = Math.atan2(goalHalfWidth, Math.max(0.02, dist)) / Math.PI; // 0..0.5
  const angleFactor = Math.min(1, angle / 0.35); // saturates once fairly central+close

  // distance decay tuned so: 6-yard box ~0.45, penalty spot ~0.30, edge of box
  // ~0.12, halfway ~0.02
  const base = 0.6 * Math.exp(-3.2 * dist);
  return Math.max(0.01, Math.min(0.85, base * (0.08 + 0.92 * angleFactor)));
}

/**
 * Shot map on a full vertical pitch. The engine's pitch runs -x..+x across and
 * -y..+y along the length; home attacks +y (top), away attacks -y (bottom).
 * Every shot is plotted at its real position. Shots are clickable: selecting
 * one shows shooter, event type, body part, minute and the estimated xG.
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
  const spanX = Math.max(1, fieldMax.x - fieldMin.x);
  const spanY = Math.max(1, fieldMax.y - fieldMin.y);
  // teams swap ends at half-time; shots after the first half attack the other goal
  const secondHalf = (s: Shot) => /SECOND|2ND|2nd/i.test(s.period ?? '');

  const plotted = shots
    .map((s, i) => {
      if (!s.startPosition) return null;
      const p = s.startPosition;
      const swapped = secondHalf(s);
      // -1..1 across the full pitch, -1..1 along it (top = home attack)
      const nx = Math.max(-1, Math.min(1, (2 * (p.x - fieldMin.x)) / spanX - 1));
      // mirror vertically in the second half so each team's shots stay on its
      // attacking end of the rendered pitch
      const nyRaw = (2 * (p.y - fieldMin.y)) / spanY - 1;
      const ny = Math.max(-1, Math.min(1, swapped ? -nyRaw : nyRaw));
      return {
        key: i,
        cx: W / 2 + (nx * (W / 2 - 10)),
        // engine +y (home first-half attack) maps to the top of the SVG
        cy: H / 2 - (ny * (H / 2 - 10)),
        xg: estimateXg(p, s.team, { halfX: spanX / 2, halfY: spanY / 2 }, swapped),
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
          {/* both penalty boxes and six-yard boxes */}
          <rect x={W / 2 - 66} y="4" width="132" height="52" />
          <rect x={W / 2 - 30} y="4" width="60" height="20" />
          <rect x={W / 2 - 66} y={H - 56} width="132" height="52" />
          <rect x={W / 2 - 30} y={H - 24} width="60" height="20" />
          <circle cx={W / 2} cy={H / 2} r="3" fill="rgba(148,163,184,0.35)" stroke="none" />
          <circle cx={W / 2} cy={H / 2} r="30" />
          {/* halfway line */}
          <line x1="4" y1={H / 2} x2={W - 4} y2={H / 2} strokeDasharray="4 4" />
        </g>
        {/* goals: home attacks top, away attacks bottom */}
        <rect x={W / 2 - 22} y="0" width="44" height="5" fill="rgba(226,232,240,0.5)" rx="1" />
        <rect
          x={W / 2 - 22}
          y={H - 5}
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
          <span className="text-chalk-400">⬆ {homeName} attack</span>
          <span className="text-chalk-400">⬇ {awayName} attack</span>
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

function bodyPartOf(shot: Shot): number {
  return shot.bodyPart ?? 0;
}
