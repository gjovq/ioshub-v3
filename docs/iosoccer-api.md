# IOSoccer public site and API reference

**Research date:** 2026-08-07  
**Scope:** public, read-only football data and the non–My Hub site surface  
**Base API origin found in the live web client:** `https://iosoccer.com:44380`  
**Website origin:** `https://iosoccer.com`

## Important scope and safety note

This is a black-box documentation and compatibility scan of the public IOSoccer website. It uses the public site, its publicly delivered JavaScript client, and low-volume read-only HTTP requests. It does not attempt to bypass authentication, guess credentials, access private accounts, submit moderation/admin changes, create or delete records, or alter match/tournament data.

The API does not expose a usable Swagger/OpenAPI document at the common locations tested. The route inventory below is therefore derived from the live Angular client bundle and then checked against the public API where a safe GET or read-only request was available.

The website currently returns the same 2,582-byte Angular shell for many browser routes. The data is loaded after the shell through the API service on port `44380`.

## Quick start

```bash
# Public reference data
curl -sS 'https://iosoccer.com:44380/api/country'
curl -sS 'https://iosoccer.com:44380/api/region'
curl -sS 'https://iosoccer.com:44380/api/map'
curl -sS 'https://iosoccer.com:44380/api/tournaments/current'
curl -sS 'https://iosoccer.com:44380/api/tournaments/past'

# A match detail and its public supporting data
curl -sS 'https://iosoccer.com:44380/api/match/95300'
curl -sS 'https://iosoccer.com:44380/api/match/95300/player-of-the-match'
curl -sS 'https://iosoccer.com:44380/api/match/95300/live-score'

# A player, team, and search
curl -sS 'https://iosoccer.com:44380/api/player/1'
curl -sS 'https://iosoccer.com:44380/api/team/1'
curl -sS 'https://iosoccer.com:44380/api/player/search?playerName=nuno'
```

Use a descriptive `User-Agent`, cache responses, and keep polling within a reasonable interval. The examples above are read-only and do not require a login at the time of the scan.

## Origins and routing

| URL | Observed behavior |
|---|---|
| `https://iosoccer.com/` | Website shell, served by nginx |
| `https://iosoccer.com/<browser-route>` | Same Angular shell, then client-side route and API calls |
| `https://iosoccer.com/api` | Website shell fallback, not the JSON API |
| `https://iosoccer.com:44380/` | Kestrel API service, `404` |
| `https://iosoccer.com:44380/api` | Kestrel API service, `404` |
| `https://iosoccer.com:44380/api/<route>` | JSON API route, login redirect, method error, or server error depending on route |

The compiled client contains the constant:

```text
https://iosoccer.com:44380
```

The API uses cookie-based authentication. Unauthenticated protected GETs returned a `302` redirect to an unauthorized URL whose `ReturnUrl` query parameter contains the original requested API path.

```text
/unauthorized?ReturnUrl=<url-encoded-original-api-path>
```

Do not follow that redirect if you are writing an API client unless you explicitly want the unauthorized HTML response.

## Page and navigation map

The uploaded image shows these public navigation families. The labels below are the route names found in the live Angular router or the matching public pages discovered from the site.

### Matches

| UI label | Route | Purpose | API family |
|---|---|---|---|
| Results | `/recent-matches` | Completed/recent match list | `POST /api/match` with a page/filter body |
| Fixtures | `/upcoming-matches` | Upcoming match list | `POST /api/match` with an upcoming filter |
| Live Scores | `/live-matches` | Current live match list | `GET /api/match/live-scores/{regionId}` and live-match components |
| Match overview | `/match-overview/{matchId}` | Full match, teams, players, stats and tournament context | `GET /api/match/{id}` plus supporting match endpoints |
| Live match overview | `/live-score/{matchId}` | Live score detail | `GET /api/match/{id}/live-score` |

### Teams

| UI label | Route | Purpose | API family |
|---|---|---|---|
| Team Statistics | `/team-list` | Team aggregate statistics and ranking views | `POST /api/teamstatistics`; `POST /api/teamstatistics/matches`; `GET /api/teamstatistics/match-totals/{teamId}`; `GET /api/teamstatistics/performance/continuous/{teamId}`; `GET /api/teamstatistics/performance/daily/{teamId}`; `GET /api/teamstatistics/performance/monthly/{teamId}`; `GET /api/teamstatistics/performance/weekly/{teamId}` |
| Team Head to Head | `/team-head-to-head` | Compare two teams | team/match statistics APIs |
| Team List | `/teams` | Search/list public teams | `/api/team`, `/api/team/region/{regionId}`, `/api/team/region/{regionId}/active/summaries` |
| Team profile | `/team-profile/{teamId}` | Team record, history and squad | `GET /api/team/{id}`, squad and player-history endpoints |

### Players

| UI label | Route | Purpose | API family |
|---|---|---|---|
| Player Statistics | `/player-list` | Player aggregate and match statistics | `POST /api/player-statistics`; `POST /api/player-statistics/match-totals`; `POST /api/player-statistics/matches`; `POST /api/player-statistics/matches-by-position`; `GET /api/player-statistics/performance/continuous/{playerId}`; `GET /api/player-statistics/performance/daily/{playerId}`; `GET /api/player-statistics/performance/monthly/{playerId}`; `GET /api/player-statistics/performance/weekly/{playerId}`; `GET /api/player-statistics/appearance-totals/{playerId}` |
| Player Transfers | `/player-transfers` | Transfer view | `POST /api/player-team/transfers` |
| Player profile | `/player-profile/{playerId}` | Public player record and history | player/profile/statistics endpoints |

### Tournaments

| UI label | Route | Purpose | API family |
|---|---|---|---|
| Current | `/tournaments` or current-tournament component | Active public tournaments | `GET /api/tournaments/current` |
| Past | `/tournaments` or past-tournament component | Completed tournaments | `GET /api/tournaments/past` |
| Tournament overview | `/tournament/{tournamentId}` | Tournament detail | `/api/tournaments/{id}/overview` and related endpoints |
| Tournament matches | `/tournament-matches/{tournamentId}` | Tournament match/group views | tournament groups, matches and standings |

### Games

| UI label | Route | Purpose | API family |
|---|---|---|---|
| Fantasy | `/fantasy` and `/fantasy/{tournamentId}` | Fantasy tournament views | `GET /api/fantasy/tournament/available`; `GET /api/fantasy/tournament/{tournamentId}`; `GET /api/fantasy/tournament/{tournamentId}/rankings`; `GET /api/fantasy/tournament/{tournamentId}/player-rankings`; `GET /api/fantasy/tournament/{tournamentId}/team-summaries`; `GET /api/fantasy/tournament/{tournamentId}/current-phase-spotlight-team`; `GET /api/fantasy/tournament/{tournamentId}/current-phase-spotlight-player`; `POST /api/fantasy/tournament/{tournamentId}/players`; `GET /api/fantasy/teams/@me`; `GET /api/fantasy/{fantasyTeamId}`; `GET /api/fantasy/{fantasyTeamId}/summary`; `GET /api/fantasy/{fantasyTeamId}/performances`; `POST /api/fantasy`; `PUT /api/fantasy`; `POST /api/fantasy/{fantasyTeamId}/selections`; `DELETE /api/fantasy/{fantasyTeamId}/selections/{selectionId}` |
| Score Predictor | `/score-predictor` | Score prediction views | `GET /api/score-predictions/leaderboard`; `GET /api/score-predictions/leaderboard/month-leader`; `GET /api/score-predictions/player/{playerId}`; `GET /api/score-predictions/tournament/{tournamentId}`; `GET /api/score-predictions/tournament/{tournamentId}/leaderboard`; `GET /api/score-predictions/tournament/{tournamentId}/player/{playerId}`; `POST /api/score-predictions`; `PUT /api/score-predictions` |

### Deliberately excluded

The scan did not attempt user-specific My Hub work such as profile editing, account state, team invitations, or other authenticated mutations. The bundle contains those routes, but they are listed as out of scope rather than tested:

- `/profile`, `/edit-profile`, `/login`, `/logout`, `/reset`
- `/api/player/@me`
- player update endpoints
- team invitation and membership mutations
- account-scoped fantasy team writes
- moderation, bot, server-management, organisation-management, and tournament-management writes

## Verified public data endpoints

These were requested against `https://iosoccer.com:44380` on the research date. Response sizes vary as the live database changes.

| Method | Endpoint | Result observed | Response shape |
|---|---|---|---|
| GET | `/api/country` | `200` | Array of 146 country objects |
| GET | `/api/region` | `200` | Array of 6 region summary objects |
| GET | `/api/map` | `200` | Array of 160 `{ id, name }` map objects |
| GET | `/api/tournament-series` | `200` | Array of tournament-series objects |
| GET | `/api/tournaments` | `200` | Array of tournament objects |
| GET | `/api/tournaments/current` | `200` | Array; empty at scan time |
| GET | `/api/tournaments/past` | `200` | Array of past tournament objects |
| GET | `/api/tournament-series/1` | `200` | One tournament-series object |
| GET | `/api/tournaments/1` | `200` | One tournament object |
| GET | `/api/tournaments/1/overview` | `200` | Tournament overview object |
| GET | `/api/tournaments/110/groups` | `200` | Array of tournament groups |
| GET | `/api/tournament-groups/1296/standings` | `200` | Standings result |
| GET | `/api/match/95300` | `200` | Full match object |
| GET | `/api/match/95300/player-of-the-match` | `200` | Player-of-the-match statistics |
| GET | `/api/match/95300/live-score` | `200` | Live-score wrapper containing match data |
| GET | `/api/match/live-scores/1` | `200` | Region live-score result |
| GET | `/api/player/1` | `200` | Player object |
| GET | `/api/player/search?playerName=nuno` | `200` | Array of matching player objects |
| GET | `/api/team/1` | `200` | Team object |
| GET | `/api/team/region/1` | `200` | Array of teams |
| GET | `/api/team/region/1/active/summaries` | `200` | Array of lightweight team summaries |
| GET | `/api/team/1/squad?orderBy=Name&orderByDesc=false` | `200` | Array; empty for the tested team |
| GET | `/api/team/1/player-history?orderBy=Name&orderByDesc=false` | `200` | Player/team-history result |
| GET | `/api/tournaments/team/1` | `200` | Array of tournaments associated with a team |
| GET | `/api/tournaments/player/1` | `200` | Array of tournaments associated with a player |
| GET | `/api/teamstatistics/match-totals/1` | `200` | Team statistic totals |
| GET | `/api/player-statistics/performance/monthly/1` | `200` | Array; empty for the tested player |
| GET | `/api/rating/rateable` | `200` | Array of rateable player records |
| GET | `/api/rating/current` | `200` | Array of current rating records |

### Read endpoints that need a body

The match and statistics list APIs are implemented as POST requests even though they are read-only queries. The client creates a paging/filter object and posts it as JSON.

#### Match list

```http
POST /api/match
Content-Type: application/json
Accept: application/json
```

Minimal body accepted by the public endpoint during the scan:

```json
{
  "page": 1,
  "pageSize": 5,
  "filters": {},
  "sortBy": null,
  "sortOrder": null
}
```

Example:

```bash
curl -sS 'https://iosoccer.com:44380/api/match' \
  -H 'Content-Type: application/json' \
  --data '{"page":1,"pageSize":5,"filters":{},"sortBy":null,"sortOrder":null}'
```

The same request with `"filters": null` produced a server error during the scan; use an object, even when no filters are selected.

The result is a paged object:

```json
{
  "items": [],
  "totalItems": 0,
  "totalPages": 0,
  "page": 1,
  "pageSize": 5,
  "sortBy": null,
  "sortOrder": null,
  "sortOrderFull": null,
  "offset": 1
}
```

The UI supplies different filter values for completed, upcoming and live views. The exact filter class is compiled into the client and should be captured from the current browser request if a future change introduces a new filter property.

#### Player statistics

```bash
curl -sS 'https://iosoccer.com:44380/api/player-statistics' \
  -H 'Content-Type: application/json' \
  --data '{"page":1,"pageSize":5,"sortBy":"PlayerId","sortOrder":"DESC","filters":{}}'
```

The returned page uses the same general paging fields and player statistic records include fields such as:

```text
playerId, name, steamID, rating, countryId, secondsPlayed,
goals, goalsAverage, assists, assistsAverage, shots,
redCards, yellowCards, fouls, foulsSuffered,
goalsConceded, interceptions, passCompletion
```

Related POST read queries:

- `/api/player-statistics/match-totals`
- `/api/player-statistics/matches-by-position`
- `/api/player-statistics/matches`
- `/api/teamstatistics`
- `/api/teamstatistics/matches`
- `/api/fantasy/tournament/{tournamentId}/players` (login/tournament context may apply)

## Response field reference

### Region

```json
{
  "regionId": 1,
  "regionName": "Europe",
  "regionCode": "EUR",
  "serverCount": 521,
  "matchCount": 106599,
  "teamCount": 762,
  "matchFormat": 8
}
```

### Country

```json
{
  "id": 117,
  "code": "AF",
  "name": "Afghanistan",
  "discordFlagEmote": ":flag_af:",
  "createdDate": "2020-07-27T20:20:58.3333333Z"
}
```

### Match

The full match object returned by `/api/match/{id}` includes:

```text
id
teamHomeId, teamHome
teamAwayId, teamAway
serverId, server
matchStatisticsId, matchStatistics
kickOff
format
matchType
mapId, map
playerOfTheMatchId, playerOfTheMatch
tournamentId, tournament
matchup
playerMatchStatistics
playerPositionMatchStatistics
teamMatchStatistics
tournamentGroupMatches
createdDate, createdById, createdBy
updatedDate, updatedById, updatedBy
```

Nested teams expose public identity and presentation data including `id`, `name`, `teamCode`, badge image references, `teamType`, `regionId`, color/system color, `form`, `inactive`, `unlisted`, rating, and timestamps.

### Player

The public player record includes:

```text
id, name, displayName, steamID
discordUserId, discordUserMention
rating, countryId, country
hubRole, donatorLevel
positions, playerLineupPositions, playerSubstitutes
teams
playingSince, disableDMNotifications
createdDate, createdById, createdBy
updatedDate, updatedById, updatedBy
```

The API may return public Steam and Discord identifiers in player data. Treat those fields as personal data: do not republish or bulk-resell them without a valid reason and applicable permission.

### Team

The public team record includes:

```text
id, name, displayName, teamCode
teamType, regionId, region
guildId, guild
badgeImageId, badgeImage
fantasyKitImageId, fantasyKitImage
color, systemColor
foundedDate, form
inactive, unlisted, rating
channels, players, teamMatchStatistics
createdDate, createdById, createdBy
updatedDate, updatedById, updatedBy
```

### Tournament

Tournament list and detail objects include:

```text
id, name, isPublic, tournamentSeriesId, tournamentSeries
startDate, hasStarted, endDate, hasEnded
tournamentType, teamType, format, fantasyPointsLimit
winningTeamId, winningTeam
tournamentStages, tournamentMatchDays, tournamentStaff
createdDate, createdById, createdBy
updatedDate, updatedById, updatedBy
```

### Tournament group and standings

Groups expose `id`, `name`, `tournamentStageId`, `tournamentStage`, `tournamentGroupMatches`, `tournamentGroupTeams`, and audit timestamps. Standings are returned by:

```text
GET /api/tournament-groups/{tournamentGroupId}/standings
```

### Rating

`/api/rating/current` and `/api/rating/rateable` return arrays of player-like records with fields observed including:

```text
id, name, rating, steamID, teamRole, teamName
```

## Complete client-discovered API inventory

This is the complete route inventory extracted from the current public client bundle, grouped by domain. It includes read, write, admin, and authenticated routes so that an implementer can see the whole client contract. Only the public read subset above was exercised.

### Announcements, assets, audit and reference data

```text
POST   /api/announcement
GET    /api/asset-images/{id}
POST   /api/asset-images
GET    /api/audit/{id}
GET    /api/country
GET    /api/map
```

### Matches and match statistics

```text
POST   /api/match
GET    /api/match/{id}
PUT    /api/match/{id}
GET    /api/match/{id}/live-score
GET    /api/match/{id}/player-of-the-match
GET    /api/match/live-scores/{regionId}

GET    /api/match-statistics/unlinked
POST   /api/match-statistics/{id}
POST   /api/match-statistics/{id}/create-match
POST   /api/match-statistics/{id}/override
POST   /api/match-statistics/{id}/regenerate
POST   /api/match-statistics/{id}/swap-teams
POST   /api/match-statistics/{id}/unlink
```

### Players and player statistics

```text
GET    /api/player/{id}
POST   /api/player
GET    /api/player/by-steam-id/{steamId}
GET    /api/player/search?playerName={name}
GET    /api/player/{id}/team-history
GET    /api/player-profiles/{id}
GET    /api/player/hub-staff
GET    /api/player/@me                 # My Hub/account scope; not tested
POST   /api/player/@me                # My Hub/account scope; not tested
POST   /api/player/update-discord-user-id
POST   /api/player/update-donator-level
POST   /api/player/update-hub-role
POST   /api/player/update-name
POST   /api/player/update-rating
POST   /api/player/update-steam-id

POST   /api/player-statistics
POST   /api/player-statistics/match-totals
POST   /api/player-statistics/matches
POST   /api/player-statistics/matches-by-position
GET    /api/player-statistics/performance/continuous/{playerId}
GET    /api/player-statistics/performance/daily/{playerId}
GET    /api/player-statistics/performance/monthly/{playerId}
GET    /api/player-statistics/performance/weekly/{playerId}
GET    /api/player-statistics/appearance-totals/{playerId}
```

### Teams and team statistics

```text
GET    /api/team/{id}
POST   /api/team
PUT    /api/team
DELETE  /api/team/{id}
GET    /api/team/code/{teamCode}/region/{regionId}
GET    /api/team/region/{regionId}
GET    /api/team/region/{regionId}/active/summaries
GET    /api/team/{id}/player-history?orderBy={field}&orderByDesc={bool}
GET    /api/team/{id}/squad?orderBy={field}&orderByDesc={bool}
POST   /api/team/update-guild-id

POST   /api/teamstatistics
POST   /api/teamstatistics/matches
GET    /api/teamstatistics/match-totals/{teamId}
GET    /api/teamstatistics/performance/continuous/{teamId}
GET    /api/teamstatistics/performance/daily/{teamId}
GET    /api/teamstatistics/performance/monthly/{teamId}
GET    /api/teamstatistics/performance/weekly/{teamId}
```

### Tournaments, series, groups and tournament operations

```text
GET    /api/tournament-series
GET    /api/tournament-series/{id}
POST   /api/tournament-series
PUT    /api/tournament-series

GET    /api/tournaments
GET    /api/tournaments/current
GET    /api/tournaments/past
GET    /api/tournaments/{id}
GET    /api/tournaments/{id}/overview
GET    /api/tournaments/{id}/current-phase
GET    /api/tournaments/{id}/groups
GET    /api/tournaments/{id}/staff
GET    /api/tournaments/{id}/teams
GET    /api/tournaments/{id}/phases
GET    /api/tournaments/{id}/stages/{stageId}
GET    /api/tournaments/{id}/match-day-slots
GET    /api/tournaments/team/{teamId}
GET    /api/tournaments/player/{playerId}
POST   /api/tournaments
PUT    /api/tournaments
POST   /api/tournaments/{id}/generate-schedule
POST   /api/tournaments/{id}/generate-fantasy-snapshots
POST   /api/tournaments/{id}/fixtures/import?dryRun={bool}

GET    /api/tournament-groups/{id}/standings
GET    /api/tournament-groups/{id}/teams
POST   /api/tournament-groups
POST   /api/tournament-groups/{id}/teams
DELETE /api/tournament-groups/{id}
DELETE /api/tournament-groups/{id}/teams/{teamId}
POST   /api/tournament-groups/{id}/teams/{teamId}/override/{value}

GET    /api/tournament-group-matches/{id}
POST   /api/tournament-group-matches/{id}
PUT    /api/tournament-group-matches
DELETE  /api/tournament-group-matches/{id}
POST    /api/tournament-group-matches/{id}/setup-server

GET    /api/tournament-staff/{id}
POST   /api/tournament-staff
PUT    /api/tournament-staff
DELETE /api/tournament-staff/{id}

GET    /api/tournaments/{id}/phases
POST   /api/tournaments/{id}/phases
DELETE /api/tournaments/{id}/phases/{phaseId}
POST   /api/tournaments/{id}/stages
DELETE /api/tournaments/{id}/stages/{stageId}
GET    /api/tournaments/{id}/match-day-slots
POST   /api/tournaments/{id}/match-day-slots
DELETE /api/tournaments/{id}/match-day-slots/{slotId}
```

### Score predictor and fantasy

```text
GET    /api/score-predictions/leaderboard
GET    /api/score-predictions/leaderboard/month-leader
GET    /api/score-predictions/player/{playerId}
GET    /api/score-predictions/tournament/{tournamentId}
GET    /api/score-predictions/tournament/{tournamentId}/leaderboard
GET    /api/score-predictions/tournament/{tournamentId}/player/{playerId}
POST   /api/score-predictions
PUT    /api/score-predictions

GET    /api/fantasy/tournament/available
GET    /api/fantasy/tournament/{tournamentId}
GET    /api/fantasy/tournament/{tournamentId}/rankings
GET    /api/fantasy/tournament/{tournamentId}/player-rankings
GET    /api/fantasy/tournament/{tournamentId}/team-summaries
GET    /api/fantasy/tournament/{tournamentId}/current-phase-spotlight-team
GET    /api/fantasy/tournament/{tournamentId}/current-phase-spotlight-player
POST   /api/fantasy/tournament/{tournamentId}/players
GET    /api/fantasy/teams/@me
GET    /api/fantasy/{fantasyTeamId}
GET    /api/fantasy/{fantasyTeamId}/summary
GET    /api/fantasy/{fantasyTeamId}/performances
POST   /api/fantasy
PUT    /api/fantasy
POST   /api/fantasy/{fantasyTeamId}/selections
DELETE /api/fantasy/{fantasyTeamId}/selections/{selectionId}
```

### Servers, regions, moderation, Discord and administration

These routes were inventoried but not exercised with mutating requests:

```text
GET    /api/server
GET    /api/server/deactivated
GET    /api/server/{id}
POST   /api/server
PUT    /api/server
PATCH  /api/server/{id}
PATCH  /api/server/{id}/reactivate
DELETE /api/server/{id}

GET    /api/region
GET    /api/region/{id}
POST   /api/region
DELETE /api/region/{id}
POST   /api/region/{id}/regenerate-token

GET    /api/ban
GET    /api/ban/{id}
POST   /api/ban
PUT    /api/ban/{id}
DELETE /api/ban/{id}
GET    /api/ban/get-ban-message
POST   /api/ban/update-ban-message

GET    /api/case/all
GET    /api/case/{id}
POST   /api/case
PUT    /api/case/{id}
GET    /api/case/{id}/notes
POST   /api/case/{id}/notes
GET    /api/disciplinary/tournament/{id}
GET    /api/disciplinary/tournament/{id}/bans
POST   /api/disciplinary/bans
DELETE /api/disciplinary/bans/{id}
GET    /api/moratorium
POST   /api/moratorium
GET    /api/role-changes

GET    /api/report/case-manager-rankings
GET    /api/report/overall-region-daily-match-counts
GET    /api/report/region-daily-match-counts/{regionId}
GET    /api/report/team-daily-match-counts/{teamId}

GET    /api/bot/state
GET    /api/bot/logs
POST   /api/bot/connect
POST   /api/bot/disconnect
POST   /api/bot/reconnect
GET    /api/discordguild
GET    /api/discordguild/{id}/channels
GET    /api/discorduser/{id}
GET    /api/guild/{id}
GET    /api/guild/{id}/channels
GET    /api/guild/{guildId}/{channelId}/channels
GET    /api/channel/{id}
POST   /api/channel
PUT    /api/channel
GET    /api/organisations
GET    /api/organisations/{id}
POST   /api/organisations
PUT    /api/organisations
DELETE /api/organisations/{id}
```

## Authentication and status behavior

Observed behavior for representative routes:

| Request | Status | Meaning |
|---|---:|---|
| `GET /api/server` | `302` | Protected; redirects to `/unauthorized` |
| `GET /api/player/hub-staff` | `302` | Protected/admin |
| `GET /api/ban` | `302` | Protected/moderation |
| `GET /api/case/all` | `302` | Protected/moderation |
| `GET /api/moratorium` | `302` | Protected/admin |
| `GET /api/fantasy/tournament/available` | `302` | Account/authentication boundary |
| `GET /api/bot/state` | `302` | Protected/admin |
| `GET /api/report/overall-region-daily-match-counts` | `302` | Protected/reporting |
| `GET /api/match-statistics/unlinked` | `500` | Server-side error without the expected operational context; not retried |
| `GET /api/match` | `405`, `Allow: POST` | Correct method is POST |
| `GET /api/team` | `405`, `Allow: POST, PUT` | Correct list/write contract is not GET |
| `GET /api/player` | `405`, `Allow: POST` | Correct list/create contract is not GET |
| `GET /api/tournament` | `404` | No route at this singular path |

`302` is not evidence that an endpoint does not exist. It is evidence that the endpoint exists behind an authentication policy.

## Reproducible test ledger

### Website shell

| Check | Result |
|---|---|
| `GET https://iosoccer.com/` | `200`, `text/html`, 2,582 bytes |
| `GET https://iosoccer.com/robots.txt` | Angular shell fallback, not a robots document |
| `GET https://iosoccer.com/sitemap.xml` | Angular shell fallback, not an XML sitemap |
| Browser routes such as `/recent-matches`, `/upcoming-matches`, `/live-matches`, `/teams` | `200`, identical Angular shell; data is client-loaded |

### API discovery

| Check | Result |
|---|---|
| `GET https://iosoccer.com:44380/` | `404`, Kestrel |
| `GET https://iosoccer.com:44380/api` | `404`, Kestrel |
| `/swagger/index.html` | `404` |
| `/swagger/v1/swagger.json` | `404` |
| `/swagger/v1/swagger.yaml` | `404` |
| `/openapi.json` | `404` |
| `/openapi.yaml` | `404` |
| `/api-docs` | `404` |

### Read-only data checks

The successful endpoint matrix is recorded in the “Verified public data endpoints” section. Payloads were checked for JSON validity and top-level shape. The matrix intentionally uses stable example IDs from publicly indexed match/tournament pages rather than scanning arbitrary ID ranges.

## Client implementation notes

- The website is an Angular application using the Angular HTTP client.
- API requests are sent to the dedicated `:44380` origin, not to `/api` on the website origin.
- Cookies are enabled by the client for authenticated flows.
- List endpoints use page objects with `page`, `pageSize`, sorting, and filters.
- The client contains read-only data queries implemented as POST.
- Detail pages are ID-driven; the browser route itself does not contain the data.
- API field names are camelCase.
- Dates are ISO-8601 strings.
- Some public entity responses contain nested objects and null relationship fields. Clients should allow nulls rather than assuming every relationship is expanded.
- Some image URLs in API responses reference `www.iosoccer.co.uk`, even though the current site/API host is `iosoccer.com`. Preserve returned URLs or normalize only after confirming the asset is mirrored.

## Suggested client architecture

For a data consumer, implement:

1. An origin constant set to `https://iosoccer.com:44380`.
2. A JSON client that does not silently follow `302` redirects into HTML.
3. Separate models for list/page responses and detail responses.
4. Nullable nested relationship types.
5. A cache for countries, regions, maps and tournament metadata.
6. A short-lived cache for live scores.
7. Backoff and retry handling for `5xx`, without repeatedly retrying a known `4xx`.
8. A clear distinction between public endpoints and authenticated/admin endpoints.
9. Respectful polling and no mutation calls unless the account owner has explicitly authorized the operation.

## Limitations and what would require a second authorized pass

This document is a high-coverage public contract reference, not a privileged server audit. The following remain intentionally unresolved:

- Exact filter enum/property values for every match and statistics screen.
- Request and response schemas for protected admin and account routes.
- Authenticated fantasy, score-prediction submission, team membership and profile behavior.
- POST/PUT/PATCH/DELETE validation rules and side effects.
- Server rate limits and production retention policies.
- Whether undocumented routes exist that are not referenced by the current web client.

Those items require an authorized browser session or official documentation from the service owner. They should be tested with explicit permission and a disposable account/data set, not by guessing or brute force.