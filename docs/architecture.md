# Architecture

Buying Signal Radar is a single Next.js application backed by PostgreSQL. There is no background worker, queue or external ML service: discovery runs synchronously from a route handler, and scoring is pure TypeScript.

```
Browser
  │
  ├─ / (landing)                     static marketing page
  ├─ /(app)/*                        server components + client widgets
  └─ /r/[token]                      public sanitised report
        │
        ▼
Next.js route handlers (/api/*)
  │
  ├─ src/lib/icp            rules-based ICP interpreter
  ├─ src/lib/discovery      pipeline: fetch → extract → classify → dedupe → score
  ├─ src/lib/connectors     RSS, HN, JOB_FEED, URL, WEBSITE, WEB_SEARCH
  ├─ src/lib/http           SSRF guard + robots.txt + size/time limits
  ├─ src/lib/scoring        pure functions + persistence/rescore
  ├─ src/lib/graph          BFS paths + intro-request drafts
  └─ src/lib/contacts       CSV import/export with validation
        │
        ▼
Prisma → PostgreSQL
```

## Request and data flow

### 1. Workspace resolution

`src/middleware.ts` mints an opaque `bsr_workspace` cookie (and an `x-bsr-workspace` request header) when one is missing. `ensureWorkspace()` lazily upserts the `Workspace` row. Every route handler enters through `withWorkspace()` in `src/lib/api.ts`, which:

- enforces same-origin for mutations,
- parses and validates JSON with Zod,
- applies in-memory rate limits,
- returns consistent `{ ok, data }` / `{ ok, error }` envelopes.

### 2. ICP interpretation

`POST /api/icp/interpret` sends the product description through `src/lib/icp/interpreter.ts`:

1. Tokenise and normalise the text.
2. Match industries and geographies against `src/lib/icp/taxonomy.ts` (labels + aliases).
3. Parse size ranges ("50–300 people", "under 500 employees").
4. Infer buyer roles from title vocabulary and pain-point phrases.
5. Map trigger language to the nine signal categories.
6. Derive exclusions and a confidence per field.

The response is an editable draft. Nothing is persisted until the user reviews and confirms it (`POST /api/icp`).

### 3. Discovery

`POST /api/discovery` resolves the confirmed ICP, builds or loads `Source` rows, then for each enabled source:

1. `runConnector()` validates the source config against its Zod schema and fetches raw documents.
2. `src/lib/connectors/classify.ts` turns each document into zero or more signal candidates. Rules are keyword- and context-based; each candidate carries confidence, evidence snippet and category.
3. `src/lib/connectors/extraction.ts` normalises company names, canonicalises URLs and computes dedupe keys.
4. Companies are upserted by `(workspaceId, domain)` or `(workspaceId, normalizedName)`. Signals are upserted by a hash of source, URL, category and title.
5. `src/lib/scoring/service.ts` scores every affected prospect and writes `ScoreBreakdown` JSON alongside the three scores.

`IngestionRun` records status, counts, duration and warnings per source so `/sources` can show partial failures without hiding them. Source failures never fabricate documents.

Dedupe and provenance rules:

- A signal must keep `sourceName`, `sourceUrl`, `publishedAt` and an evidence snippet.
- A company discovered from a low-confidence mention is still stored, but the confidence is visible on the card.
- Every stored row is live output from a connector; there is no synthetic seed path in the product.

### 4. Scoring

`src/lib/scoring/score.ts` is pure: ICP + company + signals + config + `now` in, score result out. `service.ts` loads the workspace `ScoringProfile`, calls the pure function, and persists:

- `icpScore`, `signalScore`, `priorityScore`
- the full component breakdown (points, max, status, reason)
- signal contributions (category, confidence, recency, diminishing-return note)

Changing weights in `/settings` triggers a rescore of all prospects for the active ICP. The formula is documented in the [README](../README.md#how-scoring-works).

### 5. Graph and paths

`src/lib/graph/paths.ts` builds an adjacency list:

- `you → contact` for contacts with `firstDegree = true`
- `contact → company` from employment
- `contact ↔ contact` from relationships (both directions)

BFS from `you` to the company node returns the shortest edge sequence. Subsequent passes exclude already-used first hops to surface alternate routes through different connectors. `verifiedOnly` excludes unverified relationship edges and unverified contact cards. Path reconstruction produces typed nodes/edges for React Flow and a plain-language explanation.

`GET /api/graph/path?companyId=…` returns the same data used by the company detail page.

### 6. Reports

`POST /api/reports` snapshots a sanitised payload: company attributes, scores, signal evidence and a generated-at timestamp. It deliberately omits contacts, relationships, notes and workspace settings. `PATCH /api/reports/[id]` rotates the token; `DELETE` revokes it. The public page `/r/[token]` renders only the snapshot.

## Data model

| Model | Purpose |
| --- | --- |
| `Workspace` | Tenant boundary and name |
| `IcpProfile` | Product description, taxonomy selections, size range, triggers, exclusions, confirmation state |
| `Company` | Name, domain, website, industry, location, verified size, description, data mode |
| `Signal` | Category, title, summary, evidence, source URL/name, confidence, published/discovered dates, data mode |
| `Prospect` | Company × ICP scores, status (new/saved/contacted/disqualified), notes, breakdown JSON |
| `Contact` | Name, title, company, email, strength, verified, `firstDegree` |
| `Relationship` | Directed edge, type, strength, source (CSV/manual), verified |
| `Source` | Connector type, config JSON, enabled flag, last run status |
| `IngestionRun` | Per-run counts, warnings, duration, status |
| `Report` | Token, snapshot JSON, revocation timestamp |
| `ScoringProfile` | Per-workspace weights and recency half-life |

Indexes cover the access paths that matter: workspace + ICP lookups, company domains, canonical signal URLs, prospect priority ordering and contact company joins.

## Security and data ethics

- **SSRF protection** in `src/lib/http/safe-fetch.ts`: protocol allow-list, DNS/IP checks against loopback/private/link-local/metadata ranges, redirect re-validation, response-size cap and timeout.
- **robots.txt** is fetched and honoured per host before parsing pages.
- **No authenticated scraping, no anti-bot bypass, no IP rotation.** These are product constraints, not configuration options.
- **CSV export** escapes formula-injection prefixes (`=`, `+`, `-`, `@`).
- **Rate limits** are applied per workspace to expensive endpoints.
- **Reports** exclude personal data by explicit allow-list, not by redaction heuristics.

The MVP has no user authentication. The cookie workspace is a privacy convenience, not a security boundary — add real auth before multi-tenant or public production use.

## Testing strategy

`tests/` runs with Vitest against pure modules, so no database is needed:

- `scoring.test.ts` — component weights, exclusions, recency decay, diminishing returns, priority blend
- `ingestion.test.ts` — classification, company extraction/dedupe, contact CSV parsing and escaping
- `graph.test.ts` — BFS shortest path, alternate first hops, `firstDegree`, verified-only, intro requests

Route handlers and UI are exercised manually; the checklist lives in `CONTRIBUTING.md`.

## Extension points

- **New connector:** implement `SourceConnector` in `src/lib/connectors`, register it in `CONNECTORS`, add a config schema and a catalogue entry.
- **New signal category:** extend the `SignalType` enum, `SIGNAL_META`, classifier keywords and default weights.
- **New score component:** add it to `IcpWeights`, compute it in `scoreProspect`, and it automatically appears in the breakdown UI.
- **Auth:** replace cookie resolution in `src/lib/workspace.ts` with your session lookup; the rest of the app depends only on `workspace.id`.
