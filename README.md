# IOSoccer Hub

A modern, read-only web client for the public [IOSoccer](https://iosoccer.com) API —
live scores, full match breakdowns, player and team analytics, tournament standings
and league-wide leaderboards.

Built with Next.js 16 (App Router, RSC), TypeScript and Tailwind v4.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build && npm start
```

No environment variables or API keys are required. Every endpoint used is public
and read-only.

---

## What's in it

| Route | What it shows |
|---|---|
| `/` | Live ticker, latest results, upcoming fixtures, active tournaments, top scorers, form table, region activity |
| `/live` | All in-progress matches worldwide, auto-refreshing every 12s, grouped into *in play* and *warming up*, filterable by region |
| `/matches` | Results and fixtures, grouped by day, filtered by region and match type, paginated |
| `/matches/[id]` | Full match analysis — see below |
| `/teams` | Sortable team table: points, goals, GD, win %, pass %, form |
| `/teams/[id]` | Team profile: aggregate stats, squad with per-player numbers, fixtures, results, monthly trend, activity heatmap, style profile, competitions |
| `/players` | Sortable player table across 11 statistical columns |
| `/players/[id]` | Player profile: career totals, monthly form chart, full club history, activity heatmap, results split, shooting/passing/defensive breakdown |
| `/tournaments` | Active and past competitions, grouped by organiser |
| `/tournaments/[id]` | Standings tables, fixtures, results, entrants, stages, champion |
| `/leaders` | 11 leaderboards (8 player, 3 team), filterable by period, region and minimum appearances |

### Match analysis (`/matches/[id]`)

The API ships a full `matchData` blob for completed matches. The app decodes it into:

- **Timeline** — goals, cards and own goals with the running score, assist credit
  and minute, laid out on a two-sided track.
- **Team comparison** — possession split plus 10 proportional comparison bars
  (shots, accuracy, passes, interceptions, saves, corners, fouls, offsides, distance).
- **Player statistics** — per-player match totals for both squads, merged across
  periods, with position, goals, assists, shot accuracy, pass %, interceptions,
  keeper saves, distance and cards.
- **Shot map** — every attempt plotted from its pitch coordinates, with both sides
  mirrored onto one half so the attacking direction is always upward.
- **Player of the match** and a computed *standout performers* list.

---

## Architecture

```
src/
  app/                 routes (RSC by default)
    api/live           live-score proxy (no-store)
    api/search         player + team search proxy
  components/          UI primitives, charts, match cards, search dialog
  lib/
    api.ts             typed client for every endpoint used
    types.ts           response models
    enums.ts           enums decoded from the live client bundle
    match-analysis.ts  matchData decoding (stat arrays, timeline, shot map)
    format.ts          formatting, colour and URL normalisation
    entities.ts        request-deduplicated loaders + 404 handling
    limiter.ts         concurrency limiter and retry policy
```

### Why the API is proxied

The upstream API lives on `https://iosoccer.com:44380` and sets no CORS headers,
so the browser cannot call it directly. All reads happen in server components;
the two client-side features (live polling, search) go through thin Next route
handlers.

### Notes on the upstream API

Several behaviours were established by probing the live service and are worth
knowing before changing this code:

- **Read queries are POSTs.** `/api/match`, `/api/player-statistics` and
  `/api/teamstatistics` are read-only but require a POST body with
  `{ page, pageSize, sortBy, sortOrder, filters }`. `filters` must be an object —
  passing `null` produces a server error.
- **Match filters.** The filter object is `{ timePeriod, includeUpcoming,
  includePast, includeUnpublished, includePlaceholders, regionId, matchFormat,
  matchType, teamId, tournamentId, ... }`. Both `includePast` and `includeUpcoming`
  default to `false`, which returns an empty page — one of them must be set.
- **`form` arrays are `MatchOutcome`, not W/D/L order.** `0 = win, 1 = draw,
  2 = loss, 3 = unknown`. Getting this backwards silently inverts every form strip.
- **Unknown IDs return `500`, not `404`.** `lib/entities.ts` treats a null result
  as not-found so the app can serve a real 404.
- **`teamstatistics/match-totals/{id}` is a per-day match count**, not aggregate
  statistics. Team and player career totals come from the list endpoints filtered
  by `teamId` / `playerId`.
- **`badgeImageUrl` contains a literal `[[SIZE]]` placeholder** that must be
  substituted (`xs`/`sm`/`md`/`lg`/`orig`). Some records also still point at the
  legacy `iosoccer.co.uk` host, and some have a doubled slash before `/images`.
  `fixUrl()` normalises all three.
- **All-time aggregates are slow.** A single all-time statistics query was measured
  between 18s and 100s. Those requests use a 120s timeout, are not retried, and
  every leaderboard board is wrapped in its own `<Suspense>` so the page shell
  still paints in ~100ms while results stream in.
- **The service degrades under parallel load.** A burst of concurrent statistics
  queries caused upstream timeouts during development, so all outbound calls pass
  through a concurrency limiter (`lib/limiter.ts`).
- **`displayName` is often a raw Discord emote or mention** (`<:AET1:139...>`),
  never a human name. Use `name`, or `cleanName()` for player-supplied strings.

### Caching

Every request sets an explicit `revalidate`: 1h for reference data (regions,
countries), 5–10min for statistics and profiles, 60s for match lists, and
`no-store` for live scores.

---

## Design

Dark, pitch-inspired theme. Team colours are used throughout for scorelines,
comparison bars and timelines, but arbitrary hex values from the API are passed
through `readableOn()`, which lifts lightness while preserving hue until the
colour clears a 4.5:1 contrast ratio — many real team colours (`#0D1929`) are
otherwise unreadable on a dark background.

## QA

`qa/` holds the Playwright harness used to verify the build:

```bash
node qa/audit.cjs      # contrast, overflow, broken images, tap targets
node qa/interact.cjs   # search, filters, sorting, pagination, mobile nav
node qa/shots.cjs      # desktop + mobile screenshots of every page
```

Point them at a running server (`npx next start -p 3100` by default).

Current status: 11/11 pages with zero WCAG AA contrast failures, zero broken
images and zero layout overflow; 12/12 interaction tests passing.

---

Independent project. Not affiliated with or endorsed by IOSoccer.
