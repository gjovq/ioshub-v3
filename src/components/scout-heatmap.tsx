'use client';

import { useId } from 'react';
import type { ScoutAxis, ScoutPlayer } from '@/lib/scouting';

// Illustrative templates only: x runs from own goal (0) to opposition goal (100).
const ROLES: Record<string, [number, number]> = {
  GK: [10, 50],
  CB: [28, 50], LCB: [28, 35], RCB: [28, 65], SWP: [20, 50],
  LB: [34, 16], RB: [34, 84], LWB: [46, 13], RWB: [46, 87],
  CDM: [42, 50],
  CM: [54, 50], LCM: [54, 32], RCM: [54, 68],
  LM: [56, 16], RM: [56, 84], CAM: [68, 50],
  LW: [77, 16], RW: [77, 84],
  ST: [84, 50], CF: [81, 50], SS: [74, 50], LF: [81, 30], RF: [81, 70],
};

export function ScoutHeatmap({ p, axes }: { p: ScoutPlayer; axes: ScoutAxis[] }) {
  const id = useId().replace(/:/g, '');
  const role = p.scoutPosition?.name;
  const anchor = role && Object.hasOwn(ROLES, role) ? ROLES[role] : undefined;
  const available = axes.filter((a) => a.pct !== null && Number.isFinite(a.pct));

  return (
    <figure className="rounded-lg border border-[var(--line)] bg-pitch-950/50 p-3">
      <figcaption className="text-sm font-semibold text-chalk-200">Illustrative activity zones</figcaption>
      {!anchor || available.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-chalk-500">
          Map unavailable: {!anchor ? 'no supported exact recorded role template.' : 'no supported axis percentiles.'} No movement data is inferred from an unknown role or missing metric.
        </p>
      ) : (
        <>
          <svg viewBox="0 0 320 210" className="mt-2 h-auto w-full" role="img"
            aria-label={`Illustrative pitch zones for recorded role ${role}, based on ${available.length} available aggregate-stat percentiles. Attacking left to right. Not tracked player coordinates or actual movement.`}>
            <defs>
              <radialGradient id={`${id}-heat`}>
                <stop offset="0" stopColor="#f97316" stopOpacity="0.85" />
                <stop offset="0.4" stopColor="#facc15" stopOpacity="0.55" />
                <stop offset="1" stopColor="#22c55e" stopOpacity="0" />
              </radialGradient>
              <clipPath id={`${id}-pitch`}><rect x="12" y="12" width="296" height="176" rx="2" /></clipPath>
            </defs>
            <rect x="12" y="12" width="296" height="176" rx="2" fill="#102e22" />
            <g clipPath={`url(#${id}-pitch)`}>
              {available.map((axis) => {
                const attacking = /Goals|Shots|Conversion|Shot accuracy|Assists|Chances|Key passes/.test(axis.label);
                const defensive = /Saves|Save %|Catches|Conceded|Interceptions|Tackles|Fouls/.test(axis.label);
                // Percentiles modulate template intensity, never claimed as measured occupancy.
                const x = anchor[0] + (attacking ? 10 : defensive ? -8 : 0);
                return <ellipse key={axis.label} cx={12 + x * 2.96} cy={12 + anchor[1] * 1.76}
                  rx={attacking ? 48 : 60} ry={32} fill={`url(#${id}-heat)`}
                  opacity={0.12 + (axis.pct! / 100) * 0.55} />;
              })}
            </g>
            <g stroke="#d1fae5" strokeOpacity="0.5" fill="none" strokeWidth="1">
              <rect x="12" y="12" width="296" height="176" rx="2" />
              <path d="M160 12v176 M12 52h46v96H12 M308 52h-46v96h46 M12 77h17v46H12 M308 77h-17v46h17" />
              <circle cx="160" cy="100" r="25" /><circle cx="160" cy="100" r="1.5" fill="#d1fae5" />
            </g>
            <text x="12" y="204" fontSize="9" fill="#94a3b8">Own goal</text>
            <text x="160" y="204" textAnchor="middle" fontSize="9" fill="#94a3b8">Attack →</text>
            <text x="308" y="204" textAnchor="end" fontSize="9" fill="#94a3b8">Opposition goal</text>
          </svg>
          <p className="mt-2 text-[11px] leading-relaxed text-chalk-400">
            Estimated template for <strong>{role}</strong>, not tracked coordinates or actual movement. The exact all-time role sets location; {available.length}/6 aggregate-stat axis percentiles adjust glow intensity. Brighter means stronger heuristic emphasis, not time spent there. Missing axes are omitted; left/right are shown facing the opposition goal.
          </p>
        </>
      )}
    </figure>
  );
}
