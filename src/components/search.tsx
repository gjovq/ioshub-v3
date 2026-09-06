'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Result = {
  players: { id: number; name: string; rating: number | null }[];
  teams: { id: number; name: string; teamCode: string | null }[];
};

const EMPTY: Result = { players: [], teams: [] };

export function SearchTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white/[0.02] px-2.5 py-1.5 text-sm text-chalk-500 transition-colors hover:border-[var(--line-strong)] hover:text-chalk-300 sm:px-3"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-[var(--line)] px-1.5 py-0.5 font-mono text-[10px] text-chalk-600 md:inline">
          ⌘K
        </kbd>
      </button>
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [fetched, setFetched] = useState<Result>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);

  const term = q.trim();
  // Below the minimum length there is nothing to show, so derive it rather
  // than clearing state from inside the effect.
  const res = term.length < 2 ? EMPTY : fetched;
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: Result) => {
          setFetched(d);
          setCursor(0);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  const flat = useMemo(
    () => [
      ...res.teams.map((t) => ({ href: `/teams/${t.id}` })),
      ...res.players.map((p) => ({ href: `/players/${p.id}` })),
    ],
    [res],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, flat.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === 'Enter' && flat[cursor]) {
        e.preventDefault();
        router.push(flat[cursor].href);
        onClose();
      }
    },
    [flat, cursor, router, onClose],
  );

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-pitch-950/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-rise surface relative w-full max-w-xl overflow-hidden shadow-2xl shadow-black/60">
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-chalk-500" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search players and teams…"
            className="w-full bg-transparent py-3.5 text-[15px] text-chalk-100 outline-none placeholder:text-chalk-600"
          />
          {loading && (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-chalk-600 border-t-turf-500" />
          )}
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {term.length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-chalk-600">
              Type at least 2 characters
            </p>
          ) : flat.length === 0 && !loading ? (
            <p className="px-3 py-8 text-center text-sm text-chalk-600">
              No results for “{q}”
            </p>
          ) : (
            <>
              {res.teams.length > 0 && <Group label="Teams" />}
              {res.teams.map((t, i) => (
                <Row
                  key={`t${t.id}`}
                  href={`/teams/${t.id}`}
                  active={cursor === i}
                  onHover={() => setCursor(i)}
                  onClose={onClose}
                  title={t.name}
                  meta={t.teamCode ?? undefined}
                  icon="shield"
                />
              ))}
              {res.players.length > 0 && <Group label="Players" />}
              {res.players.map((p, i) => (
                <Row
                  key={`p${p.id}`}
                  href={`/players/${p.id}`}
                  active={cursor === res.teams.length + i}
                  onHover={() => setCursor(res.teams.length + i)}
                  onClose={onClose}
                  title={p.name}
                  meta={p.rating ? `${p.rating.toFixed(2)} rating` : undefined}
                  icon="user"
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ label }: { label: string }) {
  return <div className="label-xs px-3 pt-3 pb-1.5">{label}</div>;
}

function Row({
  href,
  title,
  meta,
  active,
  icon,
  onHover,
  onClose,
}: {
  href: string;
  title: string;
  meta?: string;
  active: boolean;
  icon: 'shield' | 'user';
  onHover: () => void;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      onMouseEnter={onHover}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
        active ? 'bg-white/[0.06] text-chalk-100' : 'text-chalk-300'
      }`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white/[0.04] text-chalk-500">
        {icon === 'shield' ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className="flex-1 truncate font-medium">{title}</span>
      {meta && <span className="tabular shrink-0 text-xs text-chalk-600">{meta}</span>}
    </Link>
  );
}
