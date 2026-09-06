import { NextResponse } from 'next/server';
import { getActiveTeamSummaries, safe, searchPlayers } from '@/lib/api';

export const revalidate = 120;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ players: [], teams: [] });
  }

  const [players, ...regionTeams] = await Promise.all([
    safe(searchPlayers(q)),
    safe(getActiveTeamSummaries(1)),
    safe(getActiveTeamSummaries(2)),
    safe(getActiveTeamSummaries(6)),
  ]);

  const needle = q.toLowerCase();
  const teams = regionTeams
    .flatMap((r) => r ?? [])
    .filter(
      (t) =>
        t.name?.toLowerCase().includes(needle) ||
        t.teamCode?.toLowerCase().includes(needle),
    )
    .slice(0, 8);

  return NextResponse.json({
    players: (players ?? []).slice(0, 8).map((p) => ({
      id: p.id,
      name: p.name,
      rating: p.rating,
    })),
    teams: teams.map((t) => ({ id: t.id, name: t.name, teamCode: t.teamCode })),
  });
}
