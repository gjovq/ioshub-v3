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
| `/scout` | Searchable, paginated player list with current-division filters, recorded-position groups, role-relative percentiles, radar profiles and illustrative pitch zones |

### Scouting (`/scout`)

- **Division** uses current squad membership, excluding departed or pending entries.
  Statistics follow the selected period, region and thresholds, including substitutes.
- **Most-played position** means the unique individual position with the most
  all-time recorded playing time, then mapped to GK, DEF, MID or ATT. Profile
  labels, goals and saves never determine a player's role.
- The server retrieves complete statistics pages and constructs a shared position
  index from all 23 canonical position filters. Each player's positional seconds
  must reconcile with their unfiltered all-time total. Ties, missing queries and
  inconsistent totals remain unclassified, not guessed. The first refresh can be slow.
- **Percentiles** compare only players in the same recorded group within the
  selected population. Each axis needs five valid observations. Ties use midranks;
  search, position chips and list pagination do not change the comparison sample.
- **Scout heat** is a weighted average of available axis percentiles, not a global
  rank or a percentile of the combined score. The expanded profile explains the
  role weights and any missing metrics. Passing fractions such as `0.85` display
  as `85.0%`.
- **Pitch zones are illustrative**, using exact-role templates and aggregate-stat
  percentiles. They do not show tracked movement or time spent in an area.

Live verification of the full 23-position aggregate reconciliation was blocked
by upstream connection failures during this change. Regression tests verify the
data contract with synthetic fixtures; the loader rejects unreconciled evidence
at runtime rather than treating unavailable positions as zero minutes.

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

Scouting regression tests need no running server or network:

```bash
node --test qa/scouting-math.test.cjs qa/scout-data.test.cjs qa/scout-loader.test.cjs qa/scout-presentation.test.cjs
```

After a production build, `node qa/scout-browser.cjs` serves the actual scouting
components with synthetic players and built CSS at `http://127.0.0.1:3102`.
This harness is separate from the production API and is not live-data validation.

### Optional rating history

IOSoccer exposes the current player rating, but not a historical series. To store
snapshots on Vercel, create the table in `docs/rating-history.sql`, configure
`POSTGRES_URL` and `CRON_SECRET`, then call `POST /api/rating-snapshots` with
`Authorization: Bearer <CRON_SECRET>` and a JSON body such as
`{"playerIds":[123,456]}`. The endpoint accepts at most 100 IDs per run and the
player page displays the chart after at least two snapshots exist. Without the
database configuration, no local-disk writes are attempted.

Point them at a running server (`npx next start -p 3100` by default).

Current status: 11/11 pages with zero WCAG AA contrast failures, zero broken
images and zero layout overflow; 12/12 interaction tests passing.

---

Independent project. Not affiliated with or endorsed by IOSoccer.
