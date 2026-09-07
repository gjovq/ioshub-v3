import { NextResponse } from 'next/server';
import { getPlayerStatistics } from '@/lib/api';
import { RECORDED_POSITIONS, recordedPrimaryPosition } from '@/lib/scout-data';
import { configuredPositionStore } from '@/lib/rating-history';

export const dynamic = 'force-dynamic';

/** Run from Vercel Cron. It performs the slow work outside the Scout page request. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const store = configuredPositionStore();
  if (!store) return NextResponse.json({ error: 'Position storage is not configured' }, { status: 503 });
  const totals = await getPlayerStatistics({ page: 1, pageSize: 1000, sortBy: 'SecondsPlayed', sortOrder: 'DESC', filters: { timePeriod: 0, includeSubstituteAppearances: true }, revalidate: 0, timeoutMs: 45000 });
  if (!totals?.items?.length) return NextResponse.json({ error: 'Statistics unavailable' }, { status: 502 });
  const byPlayer = new Map(totals.items.map((p) => [p.playerId, {} as Record<string, number>]));
  const names = Object.keys(RECORDED_POSITIONS);
  for (let offset = 0; offset < names.length; offset += 4) {
    const pages = await Promise.all(names.slice(offset, offset + 4).map((name) =>
      getPlayerStatistics({ page: 1, pageSize: 1000, sortBy: 'SecondsPlayed', sortOrder: 'DESC', filters: { timePeriod: 0, positionName: name, includeSubstituteAppearances: true }, revalidate: 0, timeoutMs: 45000 }),
    ));
    pages.forEach((page, index) => {
      for (const row of page?.items ?? []) {
        const distribution = byPlayer.get(row.playerId);
        if (distribution) distribution[names[offset + index]] = row.secondsPlayed;
      }
    });
  }
  let written = 0;
  for (const player of totals.items) {
    const position = recordedPrimaryPosition(byPlayer.get(player.playerId) ?? {}, player.secondsPlayed);
    if (position) { await store.write({ playerId: player.playerId, ...position }); written++; }
  }
  return NextResponse.json({ written });
}
