'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SearchTrigger } from './search';

const NAV = [
  { href: '/live', label: 'Live' },
  { href: '/matches', label: 'Matches' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/teams', label: 'Teams' },
  { href: '/players', label: 'Players' },
  { href: '/scout', label: 'Scout' },
  { href: '/leaders', label: 'Leaderboards' },
];

export function Nav({ liveCount = 0 }: { liveCount?: number }) {
  const pathname = usePathname();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // Menu is open only while the route it was opened on is still current,
  // so navigating closes it without an effect.
  const open = openFor === pathname;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header
      className={`sticky top-0 z-50 transition-all ${
        scrolled
          ? 'border-b border-[var(--line)] bg-pitch-950/85 backdrop-blur-xl'
          : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-turf-500 to-turf-600 shadow-lg shadow-turf-500/20 transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-pitch-950" fill="currentColor">
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2.2l3.1 2.2-1.2 3.6h-3.8L8.9 6.4 12 4.2zM5.6 8.1l2.9.5 1.2 3.6-2.4 2.9-2.7-1a8 8 0 01.9-6zm12.8 0a8 8 0 01.9 6l-2.7 1-2.4-2.9 1.2-3.6 2.9-.5zM9.3 17.5l1-2.8h3.4l1 2.8-1.4 2.2a8 8 0 01-2.6 0l-1.4-2.2z" />
            </svg>
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight text-chalk-100">
            IOSoccer<span className="text-turf-500">Hub</span>
          </span>
        </Link>

        <nav className="ml-3 hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'text-chalk-100'
                    : 'text-chalk-500 hover:bg-white/[0.03] hover:text-chalk-200'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {item.label}
                  {item.href === '/live' && liveCount > 0 && (
                    <span className="flex h-1.5 w-1.5">
                      <span className="animate-live h-1.5 w-1.5 rounded-full bg-red-500" />
                    </span>
                  )}
                </span>
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-turf-500" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchTrigger />
          <button
            type="button"
            onClick={() => setOpenFor(open ? null : pathname)}
            aria-label="Menu"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-chalk-400 transition-colors hover:bg-white/[0.04] hover:text-chalk-100 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--line)] bg-pitch-950/95 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto grid max-w-[1400px] gap-0.5 px-4 py-3 sm:px-6">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive(item.href)
                    ? 'bg-white/[0.05] text-chalk-100'
                    : 'text-chalk-400'
                }`}
              >
                {item.label}
                {item.href === '/live' && liveCount > 0 && (
                  <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                    {liveCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
