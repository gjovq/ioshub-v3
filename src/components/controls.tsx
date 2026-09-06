import Link from 'next/link';

export type QueryValue = string | number | boolean | undefined | null;

/**
 * Build a URL preserving current params, dropping empties and defaults.
 * `defaults` entries are omitted from the querystring when they match.
 */
export function buildQuery(
  base: string,
  current: Record<string, QueryValue>,
  over: Record<string, QueryValue> = {},
  defaults: Record<string, QueryValue> = {},
): string {
  const merged: Record<string, QueryValue> = { ...current, ...over };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v == null || v === '' || v === false) continue;
    if (k in defaults && String(defaults[k]) === String(v)) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

export function Tabs({
  items,
  size = 'md',
}: {
  items: { label: string; href: string; active: boolean; count?: number }[];
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--line)] bg-white/[0.02] p-0.5">
      {items.map((t) => (
        <Link
          key={t.href + t.label}
          href={t.href}
          className={`flex items-center gap-1.5 rounded-md font-medium transition-colors ${
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
          } ${
            t.active
              ? 'bg-white/[0.08] text-chalk-100'
              : 'text-chalk-500 hover:text-chalk-200'
          }`}
        >
          {t.label}
          {t.count != null && (
            <span
              className={`tabular rounded px-1 text-[10px] ${
                t.active ? 'bg-white/10 text-chalk-300' : 'text-chalk-600'
              }`}
            >
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function Pills<T extends string | number | undefined>({
  label,
  options,
  active,
  hrefFor,
}: {
  label?: string;
  options: { value: T; label: string }[];
  active: T;
  hrefFor: (v: T) => string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="label-xs hidden sm:inline">{label}</span>}
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <Link
            key={String(o.value)}
            href={hrefFor(o.value)}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              String(o.value) === String(active)
                ? 'bg-turf-500/15 text-turf-400 ring-1 ring-inset ring-turf-500/25'
                : 'text-chalk-500 hover:bg-white/[0.04] hover:text-chalk-300'
            }`}
          >
            {o.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (p: number) => string;
}) {
  if (totalPages <= 1) return null;
  const window: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let i = start; i < start + 5 && i <= totalPages; i++) window.push(i);

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5">
      <PageLink href={hrefFor(Math.max(1, page - 1))} disabled={page <= 1}>
        ←
      </PageLink>
      {start > 1 && (
        <>
          <PageLink href={hrefFor(1)}>1</PageLink>
          <span className="px-1 text-chalk-700">…</span>
        </>
      )}
      {window.map((p) => (
        <PageLink key={p} href={hrefFor(p)} active={p === page}>
          {p}
        </PageLink>
      ))}
      {start + 5 <= totalPages && (
        <>
          <span className="px-1 text-chalk-700">…</span>
          <PageLink href={hrefFor(totalPages)}>{totalPages}</PageLink>
        </>
      )}
      <PageLink href={hrefFor(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
        →
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  children,
  active,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  const cls = `tabular flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors ${
    active
      ? 'bg-turf-500 text-pitch-950'
      : disabled
        ? 'cursor-not-allowed text-chalk-700'
        : 'border border-[var(--line)] text-chalk-400 hover:bg-white/[0.05] hover:text-chalk-100'
  }`;
  if (disabled) return <span className={cls}>{children}</span>;
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/** Column header that toggles sort direction via querystring. */
export function SortableTh({
  label,
  field,
  activeField,
  activeOrder,
  hrefFor,
  align = 'center',
  title,
}: {
  label: string;
  field: string;
  activeField: string;
  activeOrder: 'ASC' | 'DESC';
  hrefFor: (field: string, order: 'ASC' | 'DESC') => string;
  align?: 'left' | 'center' | 'right';
  title?: string;
}) {
  const active = field === activeField;
  const nextOrder: 'ASC' | 'DESC' = active && activeOrder === 'DESC' ? 'ASC' : 'DESC';
  return (
    <th
      className={`label-xs whitespace-nowrap px-2.5 py-2 ${
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
      }`}
      title={title}
    >
      <Link
        href={hrefFor(field, nextOrder)}
        className={`inline-flex items-center gap-0.5 transition-colors hover:text-chalk-200 ${
          active ? 'text-turf-400' : ''
        }`}
      >
        {label}
        {active && (
          <span className="text-[8px]">{activeOrder === 'DESC' ? '▼' : '▲'}</span>
        )}
      </Link>
    </th>
  );
}
