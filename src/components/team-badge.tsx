import Link from 'next/link';
import { fixUrl, safeColor, teamBadge, teamInitials, teamLabel } from '@/lib/format';
import type { Team } from '@/lib/types';

const SIZES = {
  xs: { box: 'h-5 w-5', text: 'text-[8px]', img: 'xs' as const },
  sm: { box: 'h-7 w-7', text: 'text-[10px]', img: 'sm' as const },
  md: { box: 'h-10 w-10', text: 'text-xs', img: 'sm' as const },
  lg: { box: 'h-14 w-14', text: 'text-sm', img: 'md' as const },
  xl: { box: 'h-20 w-20', text: 'text-lg', img: 'md' as const },
};

export function TeamBadge({
  team,
  size = 'md',
  url,
  name,
  className = '',
}: {
  team?: Team | null;
  size?: keyof typeof SIZES;
  /** direct badge url, for endpoints that only return a string */
  url?: string | null;
  name?: string | null;
  className?: string;
}) {
  const s = SIZES[size];
  // Statistics endpoints return a templated URL, so always normalise it.
  const src = url ? fixUrl(url, s.img) : teamBadge(team, s.img);
  const initials = team ? teamInitials(team) : (name ?? '?').slice(0, 3).toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        className={`${s.box} shrink-0 rounded-md object-contain ${className}`}
      />
    );
  }
  return (
    <div
      className={`${s.box} ${s.text} flex shrink-0 items-center justify-center rounded-md font-bold tracking-tight text-white/90 ring-1 ring-inset ring-white/10 ${className}`}
      style={{ background: safeColor(team?.color, '#1e2836') }}
    >
      {initials}
    </div>
  );
}

export function TeamLink({
  team,
  size = 'sm',
  showBadge = true,
  className = '',
  bold = false,
  truncate = true,
}: {
  team: Team | null | undefined;
  size?: keyof typeof SIZES;
  showBadge?: boolean;
  className?: string;
  bold?: boolean;
  truncate?: boolean;
}) {
  const label = teamLabel(team);
  const content = (
    <>
      {showBadge && <TeamBadge team={team} size={size} />}
      <span
        className={`${truncate ? 'truncate' : ''} ${bold ? 'font-semibold' : 'font-medium'}`}
      >
        {label}
      </span>
    </>
  );
  if (!team) {
    return (
      <span className={`inline-flex items-center gap-2 text-chalk-500 ${className}`}>
        {content}
      </span>
    );
  }
  return (
    <Link
      href={`/teams/${team.id}`}
      className={`inline-flex items-center gap-2 text-chalk-200 transition-colors hover:text-turf-400 ${className}`}
    >
      {content}
    </Link>
  );
}

export function PlayerLink({
  id,
  name,
  className = '',
  country,
}: {
  id: number | null | undefined;
  name: string;
  className?: string;
  country?: string | null;
}) {
  const inner = (
    <>
      {country && <span className="text-chalk-600">{country}</span>}
      <span className="truncate">{name}</span>
    </>
  );
  if (!id) return <span className={`text-chalk-400 ${className}`}>{inner}</span>;
  return (
    <Link
      href={`/players/${id}`}
      className={`inline-flex items-center gap-1.5 text-chalk-200 transition-colors hover:text-turf-400 ${className}`}
    >
      {inner}
    </Link>
  );
}
