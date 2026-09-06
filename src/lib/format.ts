import { MATCH_TYPE_LABEL } from './enums';
import type { AssetImage, Match, Team } from './types';

/** Normalise the inconsistent image hosts returned by the API. */
export function imageUrl(
  img: AssetImage | null | undefined,
  size: ImageSize = 'sm',
): string | null {
  if (!img) return null;
  const pick =
    size === 'xs'
      ? img.extraSmallUrl
      : size === 'sm'
        ? img.smallUrl
        : size === 'md'
          ? img.mediumUrl
          : size === 'lg'
            ? img.largeUrl
            : img.originalUrl;
  const url = pick ?? img.originalUrl ?? img.mediumUrl;
  return url ? fixUrl(url, size) : null;
}

/**
 * Normalises the several URL shapes the API returns:
 *  - `badgeImageUrl` from the statistics endpoints contains a literal
 *    `[[SIZE]]` placeholder that must be substituted (verified: `_sm.png` 200s).
 *  - some records still point at the legacy `iosoccer.co.uk` host.
 *  - some contain a doubled slash before `/images`.
 */
export function fixUrl(url: string, size: ImageSize = 'sm'): string {
  return url
    .replace('[[SIZE]]', size)
    .replace('http://', 'https://')
    .replace('www.iosoccer.co.uk', 'www.iosoccer.com')
    .replace(/([^:])\/\/images/, '$1/images');
}

export type ImageSize = 'xs' | 'sm' | 'md' | 'lg' | 'orig';

export function teamBadge(team: Team | null | undefined, size: 'xs' | 'sm' | 'md' = 'sm') {
  return imageUrl(team?.badgeImage, size);
}

export function teamLabel(team: Team | null | undefined, fallback = 'TBD'): string {
  if (!team) return fallback;
  return team.name || team.teamCode || fallback;
}

/** displayName is often a raw Discord emote/mention — never render it. */
export function cleanName(name: string | null | undefined): string {
  if (!name) return '';
  return name.replace(/<a?:\w+:\d+>/g, '').replace(/<@!?\d+>/g, '').trim();
}

export function teamInitials(team: Team | null | undefined): string {
  if (!team) return '?';
  if (team.teamCode) return team.teamCode.slice(0, 3).toUpperCase();
  const words = (team.name || '?').split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
}

export function matchScore(m: Match): { home: number; away: number } | null {
  const ms = m.matchStatistics;
  if (!ms) return null;
  const home = ms.homeGoals ?? ms.matchGoalsHome;
  const away = ms.awayGoals ?? ms.matchGoalsAway;
  if (home == null || away == null) return null;
  return { home, away };
}

export function hasPlayed(m: Match): boolean {
  return matchScore(m) !== null;
}

export function matchTypeLabel(m: Match): string {
  return MATCH_TYPE_LABEL[m.matchType] ?? 'Match';
}

// ------------------------------------------------------------------ format

const NUM = new Intl.NumberFormat('en-GB');

export function num(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return '–';
  if (digits > 0)
    return n.toLocaleString('en-GB', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  return NUM.format(Math.round(n));
}

export function compact(n: number | null | undefined): string {
  if (n == null) return '–';
  if (Math.abs(n) >= 1000)
    return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })
      .format(n);
  return NUM.format(n);
}

/** API percentages come as 0–1 fractions in some fields, 0–100 in others. */
export function pct(v: number | null | undefined, alreadyScaled = false): string {
  if (v == null || Number.isNaN(v)) return '–';
  const scaled = alreadyScaled ? v : v * 100;
  return `${scaled.toFixed(1)}%`;
}

export function duration(seconds: number | null | undefined): string {
  if (!seconds) return '–';
  const h = Math.floor(seconds / 3600);
  if (h >= 1000) return `${compact(h)} h`;
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${NUM.format(h)}h ${m}m` : `${m}m`;
}

export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const DATETIME_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const TIME_FMT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1900) return '–';
  return DATE_FMT.format(d);
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1900) return '–';
  return DATETIME_FMT.format(d);
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return TIME_FMT.format(d);
}

export function relative(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
  if (mins < 60) return rtf.format(Math.sign(diff) * mins, 'minute');
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(Math.sign(diff) * hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return rtf.format(Math.sign(diff) * days, 'day');
  const months = Math.round(days / 30);
  if (months < 12) return rtf.format(Math.sign(diff) * months, 'month');
  return rtf.format(Math.sign(diff) * Math.round(months / 12), 'year');
}

export function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

export function mapLabel(name: string | null | undefined): string {
  if (!name) return '–';
  return name.replace(/^\d+v\d+_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Readable text colour for an arbitrary team hex. */
export function contrastOn(hex: string | null | undefined): string {
  if (!hex) return '#ffffff';
  const h = hex.replace('#', '');
  if (h.length < 6) return '#ffffff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#0b0f14' : '#ffffff';
}

export function safeColor(hex: string | null | undefined, fallback = '#5b6b7f'): string {
  if (!hex || !/^#?[0-9a-fA-F]{6}$/.test(hex)) return fallback;
  return hex.startsWith('#') ? hex : `#${hex}`;
}

/**
 * Team colours are arbitrary and many are very dark (e.g. #0D1929), which is
 * unreadable as text on the dark UI. This lifts a colour's lightness until it
 * clears a contrast ratio against the app background, preserving its hue.
 */
export function readableOn(
  hex: string | null | undefined,
  bgHex = '#0a0e14',
  minRatio = 4.5,
): string {
  const rgb = hexToRgb(safeColor(hex));
  const bg = hexToRgb(bgHex);
  if (!rgb || !bg) return '#dde4ec';

  const { h, s } = rgbToHsl(rgb);
  let { l } = rgbToHsl(rgb);
  // Very desaturated dark colours read better as plain light grey.
  if (s < 0.08) return '#c3ccd8';

  for (let i = 0; i < 24; i++) {
    const candidate = hslToRgb({ h, s, l });
    if (contrastRatio(candidate, bg) >= minRatio) return rgbToHex(candidate);
    l = Math.min(1, l + 0.04);
    if (l >= 0.97) break;
  }
  return '#dde4ec';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }) {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return { r: hue(h + 1 / 3) * 255, g: hue(h) * 255, b: hue(h - 1 / 3) * 255 };
}

function relLum({ r, g, b }: { r: number; g: number; b: number }): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  const l1 = relLum(a) + 0.05;
  const l2 = relLum(b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}
