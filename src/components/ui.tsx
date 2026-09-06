import Link from 'next/link';
import { outcomeLetter } from '@/lib/enums';
import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  as: As = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <As className={`surface ${className}`}>{children}</As>;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  href,
  actionLabel = 'View all',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-chalk-100 sm:text-xl">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-chalk-500">{subtitle}</p>}
      </div>
      {action ??
        (href && (
          <Link
            href={href}
            className="group shrink-0 text-sm font-medium text-chalk-400 transition-colors hover:text-turf-400"
          >
            {actionLabel}
            <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        ))}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'live' | 'success' | 'warn' | 'info' | 'muted';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-pitch-700/70 text-chalk-300 ring-white/5',
    muted: 'bg-pitch-800/60 text-chalk-500 ring-white/5',
    live: 'bg-red-500/12 text-red-400 ring-red-500/25',
    success: 'bg-turf-500/12 text-turf-400 ring-turf-500/25',
    warn: 'bg-flare-500/12 text-flare-400 ring-flare-500/25',
    info: 'bg-sky-500/12 text-sky-400 ring-sky-500/25',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="animate-live absolute inline-flex h-full w-full rounded-full bg-red-500" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="surface-flat px-4 py-3.5">
      <div className="label-xs">{label}</div>
      <div
        className={`tabular mt-1.5 font-display text-2xl font-semibold ${
          accent ? 'text-turf-400' : 'text-chalk-100'
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-chalk-500">{sub}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon = '⚽',
}: {
  title: string;
  hint?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/8 px-6 py-14 text-center">
      <div className="mb-3 text-3xl opacity-30 grayscale">{icon}</div>
      <p className="font-medium text-chalk-300">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-chalk-500">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

/** Result strip. API MatchOutcome: 0=win, 1=draw, 2=loss, 3=unknown. Oldest first. */
export function FormRun({
  form,
  max = 5,
  size = 'md',
}: {
  form: number[] | null | undefined;
  max?: number;
  size?: 'sm' | 'md';
}) {
  const shown = (form ?? []).filter((r) => r !== 3).slice(-max);
  if (shown.length === 0) return <span className="text-xs text-chalk-600">–</span>;

  const dims = size === 'sm' ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 text-[10px]';
  const style = (r: number) =>
    r === 0
      ? 'bg-turf-500/18 text-turf-400 ring-turf-500/30'
      : r === 1
        ? 'bg-chalk-500/15 text-chalk-400 ring-chalk-500/25'
        : 'bg-red-500/15 text-red-400 ring-red-500/25';
  const title = (r: number) => (r === 0 ? 'Win' : r === 1 ? 'Draw' : 'Loss');

  return (
    <div className="flex gap-1">
      {shown.map((r, i) => (
        <span
          key={i}
          title={title(r)}
          className={`flex items-center justify-center rounded font-bold ring-1 ring-inset ${dims} ${style(r)}`}
        >
          {outcomeLetter(r)}
        </span>
      ))}
    </div>
  );
}

export function Divider({ label }: { label?: string }) {
  if (!label)
    return <div className="my-6 h-px w-full bg-[var(--line)]" />;
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-[var(--line)]" />
      <span className="label-xs">{label}</span>
      <div className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300/90">
      {message}
    </div>
  );
}
