import { NextResponse } from 'next/server';
import { getPlayer } from '@/lib/api';
import { configuredRatingStore, ratingPoint } from '@/lib/rating-history';

export const dynamic = 'force-dynamic';

/** Optional cron endpoint. Configure CRON_SECRET and POSTGRES_URL before enabling it. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const store = configuredRatingStore();
  if (!store) return NextResponse.json({ error: 'Rating storage is not configured' }, { status: 503 });
  const body = await req.json().catch(() => null) as { playerIds?: unknown } | null;
  const ids = Array.isArray(body?.playerIds)
    ? [...new Set(body.playerIds.filter((id): id is number => Number.isInteger(id) && id > 0))].slice(0, 100)
    : [];
  let recorded = 0;
  for (const id of ids) {
    const point = ratingPoint(await getPlayer(id));
    if (point) { await store.record(point); recorded++; }
  }
  return NextResponse.json({ recorded });
}
