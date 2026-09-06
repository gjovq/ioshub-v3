import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="font-display text-6xl font-bold text-chalk-800">404</div>
      <h1 className="mt-3 font-display text-xl font-bold text-chalk-100">
        Nothing here
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-chalk-500">
        That match, team, player or tournament does not exist in the IOSoccer database —
        or the ID is wrong.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/"
          className="rounded-lg bg-turf-500 px-4 py-2 text-sm font-semibold text-pitch-950 transition-colors hover:bg-turf-400"
        >
          Go home
        </Link>
        <Link
          href="/matches"
          className="rounded-lg border border-[var(--line-strong)] px-4 py-2 text-sm font-semibold text-chalk-300 transition-colors hover:bg-white/[0.05]"
        >
          Browse matches
        </Link>
      </div>
    </div>
  );
}
