'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-2xl ring-1 ring-inset ring-red-500/20">
        ⚠️
      </div>
      <h1 className="font-display text-xl font-bold text-chalk-100">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-chalk-500">
        The IOSoccer API may be slow or temporarily unavailable. This page is served
        live, so a retry often resolves it.
      </p>
      <div className="mt-6 flex gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-turf-500 px-4 py-2 text-sm font-semibold text-pitch-950 transition-colors hover:bg-turf-400"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-[var(--line-strong)] px-4 py-2 text-sm font-semibold text-chalk-300 transition-colors hover:bg-white/[0.05]"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
