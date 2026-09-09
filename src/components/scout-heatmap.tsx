'use client';

import { positionGroupOfStats, roleAxes } from '@/lib/scouting';
import type { PlayerStatistics } from '@/lib/types';

type Zone = { x: number; y: number; w: number; h: number };

/**
 * Illustrative pitch heatmap. Positions are NOT tracked movement — the API
 * only returns aggregate statistics, so this visualises where a player with
 * this ESTIMATED role tends to operate based on a hand-tuned role template,
 * with the intensity of each zone driven by that role's key stat axes.
 */
export function ScoutHeatmap({ player }: { player: PlayerStatistics }) {
  const role = positionGroupOfStats(player);
  const axes = roleAxes(player);
  const byLabel = Object.fromEntries(axes.map((a) => [a.label, a.value]));
  const val = (label: string) => byLabel[label] ?? 0;

  // Hand-tuned zone templates per estimated role. Zone opacity scales with the
  // player's value on the role axes that drive that zone. Heuristic only.
  const templates: Record<string, { zones: Zone[]; drive: string[] }> = {
    GK: {
      zones: [
        { x: 0.08, y: 0.7, w: 0.84, h: 0.28 },
        { x: 0.08, y: 0.5, w: 0.84, h: 0.22 },
        { x: 0.08, y: 0.08, w: 0.84, h: 0.44 },
      ],
      drive: ['Saves', 'Save %', 'Passing'],
    },
    DEF: {
      zones: [
        { x: 0.08, y: 0.72, w: 0.84, h: 0.26 },
        { x: 0.08, y: 0.48, w: 0.84, h: 0.26 },
        { x: 0.08, y: 0.08, w: 0.84, h: 0.42 },
      ],
      drive: ['Interceptions', 'Passing', 'Goal prevention'],
    },
    MID: {
      zones: [
        { x: 0.08, y: 0.5, w: 0.84, h: 0.44 },
        { x: 0.08, y: 0.32, w: 0.84, h: 0.2 },
        { x: 0.08, y: 0.08, w: 0.84, h: 0.26 },
      ],
      drive: ['Passing', 'Key passes', 'Chances'],
    },
    ATT: {
      zones: [
        { x: 0.08, y: 0.6, w: 0.84, h: 0.4 },
        { x: 0.08, y: 0.32, w: 0.84, h: 0.3 },
        { x: 0.08, y: 0.08, w: 0.84, h: 0.26 },
      ],
      drive: ['Goals', 'Shots', 'On target'],
    },
    MIX: {
      zones: [
        { x: 0.08, y: 0.6, w: 0.84, h: 0.4 },
        { x: 0.08, y: 0.32, w: 0.84, h: 0.3 },
        { x: 0.08, y: 0.08, w: 0.84, h: 0.26 },
      ],
      drive: ['Goals', 'Assists', 'Passing'],
    },
  };

  const W = 320;
  const H = 240;
  const template = templates[role] ?? templates.MIX;
  const drive = template.drive.map(val).filter((v) => v > 0);
  const base = drive.length ? drive.reduce((a, b) => a + b, 0) / drive.length : 0.3;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Illustrative role heatmap">
        {/* pitch */}
        <rect x="0" y="0" width={W} height={H} fill="rgba(34,197,94,0.035)" rx="6" />
        <g stroke="rgba(148,163,184,0.18)" strokeWidth="1" fill="none">
          <rect x="4" y="4" width={W - 8} height={H - 8} rx="4" />
          <rect x={W / 2 - 66} y="4" width="132" height="52" />
          <rect x={W / 2 - 30} y="4" width="60" height="20" />
          <rect x={W / 2 - 66} y={H - 56} width="132" height="52" />
          <rect x={W / 2 - 30} y={H - 24} width="60" height="20" />
          <circle cx={W / 2} cy={H / 2} r="3" fill="rgba(148,163,184,0.35)" stroke="none" />
          <circle cx={W / 2} cy={H / 2} r="30" />
          <line x1="4" y1={H / 2} x2={W - 4} y2={H / 2} strokeDasharray="4 4" />
        </g>

        {template.zones.map((z, i) => {
          const v = base * (i === 0 ? 0.9 : i === 1 ? 0.7 : 0.4);
          const alpha = 0.06 + 0.5 * v;
          return (
            <rect
              key={i}
              x={z.x * W}
              y={z.y * H}
              width={z.w * W}
              height={z.h * H}
              fill="#f97316"
              fillOpacity={alpha}
            />
          );
        })}
      </svg>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-chalk-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#f97316] opacity-20" /> low
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#f97316] opacity-70" /> high
        </span>
        <span className="text-chalk-600">illustrative · role estimated from stats</span>
      </div>
    </div>
  );
}
