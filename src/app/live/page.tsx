import { LiveBoard } from '@/components/live-board';
import { LiveDot } from '@/components/ui';

export const metadata = { title: 'Live scores' };

export default function LivePage() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-red-400 ring-1 ring-inset ring-red-500/20">
          <LiveDot />
          Auto-refreshing
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-100 sm:text-3xl">
          Live scores
        </h1>
        <p className="mt-1 text-sm text-chalk-500">
          Every match currently running on IOSoccer servers worldwide.
        </p>
      </header>

      <LiveBoard />
    </div>
  );
}
