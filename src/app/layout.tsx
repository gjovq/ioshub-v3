import type { Metadata } from 'next';
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-stack',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'IOSoccer Hub — live scores, stats and tournaments',
    template: '%s · IOSoccer Hub',
  },
  description:
    'Live scores, match analysis, player and team statistics, standings and tournament coverage for IOSoccer.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-[var(--line)]">
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <div className="font-display text-sm font-bold text-chalk-200">
              IOSoccer<span className="text-turf-500">Hub</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-chalk-600">
              An independent viewer for public IOSoccer data. Not affiliated with or
              endorsed by IOSoccer.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
            <FooterCol
              title="Matches"
              links={[
                ['Live scores', '/live'],
                ['Results', '/matches'],
                ['Fixtures', '/matches?view=upcoming'],
              ]}
            />
            <FooterCol
              title="Data"
              links={[
                ['Teams', '/teams'],
                ['Players', '/players'],
                ['Leaderboards', '/leaders'],
              ]}
            />
            <FooterCol
              title="Competitions"
              links={[
                ['Tournaments', '/tournaments'],
                ['Past editions', '/tournaments?tab=past'],
              ]}
            />
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-[var(--line)] pt-6 text-xs text-chalk-600 sm:flex-row sm:items-center sm:justify-between">
          <span>Data from the public IOSoccer API · read-only</span>
          <a
            href="https://iosoccer.com"
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-chalk-400"
          >
            iosoccer.com ↗
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="label-xs mb-2.5">{title}</div>
      <ul className="space-y-1.5">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-chalk-500 transition-colors hover:text-chalk-200">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
