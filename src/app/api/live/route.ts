import { NextResponse } from 'next/server';
import { getLiveScores, safe } from '@/lib/api';
import type { LiveScoreEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

const REGIONS = [1, 2, 3, 4, 6];

export async function GET(req: Request) {
  const param = new URL(req.url).searchParams.get('region');
  const regions = param ? [Number(param)] : REGIONS;

  const results = await Promise.all(regions.map((r) => safe(getLiveScores(r))));

  const entries: (LiveScoreEntry & { regionId: number })[] = [];
  results.forEach((list, i) => {
    (list ?? []).forEach((e) => {
      if (e?.item1 && e?.item2) entries.push({ ...e, regionId: regions[i] });
    });
  });

  entries.sort((a, b) => (b.item2.matchSeconds ?? 0) - (a.item2.matchSeconds ?? 0));

  return NextResponse.json(
    { entries, fetchedAt: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
