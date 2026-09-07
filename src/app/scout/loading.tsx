export default function ScoutLoading() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8" role="status" aria-live="polite">
      <h1 className="font-display text-2xl font-bold text-chalk-100">Scout</h1>
      <p className="mt-2 text-sm text-chalk-400">Loading scouting statistics and recorded positions…</p>
      <p className="mt-1 text-xs text-chalk-500">
        The first position-index refresh can take several minutes. Incomplete data will not be ranked.
      </p>
    </div>
  );
}
