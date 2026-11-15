# Buying Signal Radar

**Tell us what you sell. Discover who might need it, why now, and who could introduce you.**

Buying Signal Radar is an open-source GTM engineering project. It turns a plain-language product description into an editable ideal customer profile (ICP), scans permitted public sources for evidence-backed buying signals, ranks companies by fit and timing, and finds the shortest introduction path through the contact graph you already own.

It is deliberately boring where it matters: every claim keeps a source URL, every score exposes its components, and synthetic demo data is always labelled **DEMO**.

- **Live-ish in a minute:** run the app locally with Postgres and load the labelled demo dataset.
- **No black box:** deterministic, rules-based ICP extraction and scoring. No LLM key required.
- **No shady sourcing:** RSS, public job feeds, company websites, URLs you add, and an optional Tavily/Brave search key. No LinkedIn scraping, login bypass, robots evasion or IP rotation.

---

## What it does

1. **Interpret an ICP.** Paste a sentence about your product. The interpreter extracts industries, size range, geographies, buyer roles, pain points, exclusions and buying triggers. You can edit everything before searching.
2. **Discover companies.** Connectors scan the sources you enable, extract company mentions, deduplicate by name/domain key, and attach provenance.
3. **Score prospects.** Three separate scores — **ICP fit**, **buying signal** and **priority** — with configurable weights and a visible breakdown. These are fit/urgency indices, never "probability of purchase".
4. **Show the evidence.** Each prospect card lists signals with category, confidence, published date, source name and a link to the original page.
5. **Find the warm path.** Import contacts and relationships by CSV, render the graph in React Flow, and run BFS to find the shortest introduction route. The UI labels direct contacts versus introduction targets.
6. **Act on it.** Save, mark contacted, disqualify, add notes, export CSV, copy source links, and draft an introduction request from a real path.
7. **Share safely.** Generate a read-only report containing scores, companies and signal evidence — never contacts, notes or graph data.

## Screens at a glance

| Route | Purpose |
| --- | --- |
| `/` | Landing page and product tour |
| `/dashboard` | Radar, priority board, volume charts, demo controls |
| `/discover` | Four-step wizard: describe → review ICP → sources → run |
| `/companies` | Filterable prospect list with scores and evidence counts |
| `/companies/[id]` | Full intelligence card, score breakdown, signals, intro paths |
| `/referral` | Contact graph, CSV import, manual relationships, path finder |
| `/saved` | Action centre: statuses, notes, exports |
| `/sources` | Connector manager, per-source test, availability |
| `/reports` | Create and revoke sanitised shareable reports |
| `/r/[token]` | Public, read-only sanitised report |
| `/settings` | Workspace, scoring weights, privacy and demo controls |

## Tech stack

- **Next.js 15** (App Router, React 19, server components) + TypeScript
- **Tailwind CSS** + shadcn-style components vendored in `src/components/ui`
- **PostgreSQL** + **Prisma 6**
- **Recharts** for volume charts, **React Flow (`@xyflow/react`)** for the referral graph
- **Vitest** for scoring, classification, CSV and graph-path tests

## Quick start

### 1. Requirements

- Node.js 20+ (22+ recommended)
- A PostgreSQL database — local, Docker, Prisma Postgres, Neon or Supabase

### 2. Install

```bash
git clone https://github.com/Savarnya1403/buying-signal-radar.git
cd buying-signal-radar
npm install
cp .env.example .env
```

### 3. Start a local database

The fastest path is Prisma's local Postgres:

```bash
npx prisma dev
# Prints a DATABASE_URL such as:
# postgres://postgres:postgres@localhost:51214/template1?sslmode=disable&pgbouncer=true
```

Put that URL in `.env`. The `pgbouncer=true` flag disables prepared statements and prevents `42P05` errors with pooled/proxied connections. For hosted Postgres, append `sslmode=require` (and `pgbouncer=true` for Supabase/Neon poolers).

### 4. Create the schema and run

```bash
npx prisma db push
npm run dev
```

Open <http://localhost:3000>.

### 5. Load the demo dataset

On `/dashboard` or `/settings`, click **Load demo data**. A private workspace is created from a cookie (`bsr_workspace`); no account required. Demo companies use fictional `.example` domains and are always badged **DEMO**.

To seed a standalone demo workspace from the CLI (useful for Prisma Studio):

```bash
npm run db:seed
npm run db:studio
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | No | Public base URL for report links (Vercel sets `VERCEL_URL`) |
| `TAVILY_API_KEY` | No | Enables the authorised web-search connector |
| `BRAVE_SEARCH_API_KEY` | No | Alternative web-search provider |
| `SEED_WORKSPACE_ID` | No | Workspace id used by `npm run db:seed` |

With no search key, the app still works end to end using RSS, public job feeds, company websites and user-supplied URLs. Unavailable connectors are shown as unavailable — never simulated.

## How scoring works

Scores are computed per `(workspace, ICP, company)` and stored with a full JSON breakdown.

### ICP fit (0–100)

Five weighted components, normalised so the configured weights always sum to 100:

| Component | Default weight | Notes |
| --- | --- | --- |
| Industry | 26 | Taxonomy aliases plus token overlap |
| Company size | 20 | Verified headcount or parsed range |
| Geography | 18 | Region aliases; "Remote / global" matches all |
| Buyer-role relevance | 16 | Evidence mentions a target role, or hiring/leadership activity |
| Trigger & pain relevance | 20 | Matches selected buying triggers and pain-point language |

Unknown values (no verified headcount, no location) receive neutral partial credit and are labelled **unverified**. Exclusion criteria cap ICP fit at 35.

### Buying signal (0–100)

For each signal that matches the ICP's selected categories:

```
points = categoryWeight × (0.55 + 0.45 × confidence) × 0.5^(ageDays / halfLife) × 1/√(repeatIndex)
raw    = Σ points
score  = 100 × (1 − e^(−raw / 22)) + diversityBonus   (capped at 100)
```

- Recency half-life defaults to 21 days.
- Repeated signals of the same category earn diminishing returns.
- Up to 8 bonus points reward distinct signal categories.
- No signals means a signal score of 0, not a guess.

### Priority (0–100)

```
priority = (icpScore × priorityIcpWeight + signalScore × prioritySignalWeight)
           / (priorityIcpWeight + prioritySignalWeight)
```

Defaults are 55% ICP and 45% signal. All weights are editable at `/settings`, and **Rescore workspace** recomputes every prospect with a fresh breakdown.

> Scores are decision-support indices. They are not purchase probabilities, and the UI never presents them as such.

## Connectors

| Type | Source | Permission model |
| --- | --- | --- |
| `RSS` | TechCrunch startups and any feed you add | Public syndication feeds; links preserved |
| `HN` | Hacker News Algolia API (`show_hn`) | Public API; discussion link preserved |
| `JOB_FEED` | Remotive, Jobicy, Greenhouse, Lever | Public job APIs and ATS boards; no LinkedIn |
| `WEBSITE` | Company-owned public pages | User-initiated; robots.txt respected |
| `URL` | Any page you explicitly submit | User-initiated; robots.txt respected |
| `WEB_SEARCH` | Tavily or Brave Search API | Requires your key; no SERP scraping |

Network access goes through `src/lib/http/safe-fetch.ts`, which:

- allows only `http`/`https`,
- blocks loopback, private, link-local and metadata address ranges (SSRF protection),
- re-validates redirect targets,
- checks `robots.txt` before fetching,
- enforces timeouts, response-size limits and a descriptive user agent.

See [`docs/connectors.md`](docs/connectors.md) for configuration and extension guidance.

## Referral graph

- Import contacts and relationships from CSV (`data/samples/contacts-sample.csv`), or add them manually.
- Contact strength is 1–5; relationships are directed in storage but traversed both ways.
- `Contact.firstDegree` decides whether a person is someone **you** know, or an **introduction target** reached through a connector. This keeps paths honest.
- BFS returns up to three routes, prefers stronger/verified edges at the same depth, and never invents a relationship.
- `verifiedOnly` excludes unverified relationships **and** unverified contact cards.
- Intro-request drafts use only names, roles and the company from the chosen path.

## Privacy and reporting

- Workspaces are isolated by a signed-in-cookie pattern; there is no login in the MVP.
- Public report tokens are random, rotatable and revocable.
- Sanitised reports exclude contacts, notes, relationship data and workspace settings.
- Demo data is clearly separated from live data via a `dataMode` field on companies and signals.

> **MVP caveat:** the cookie workspace is a convenience boundary, not authentication. Do not put sensitive contact data in a public deployment until you add real auth and per-user workspaces.

## Project structure

```
src/
  app/
    (app)/               dashboard, discover, companies, referral, saved, sources, reports, settings
    api/                 route handlers for ICP, discovery, prospects, contacts, graph, reports, export
    r/[token]/           public sanitised report
    page.tsx             landing page
  components/
    dashboard/           radar and charts
    discovery/           wizard and quick run
    referral/            React Flow graph, import/add dialogs
    shared/              display primitives, copy button
    shell/               sidebar, mobile bar, page header
    ui/                  vendored shadcn-style primitives
  lib/
    connectors/          RSS, HN, job feeds, page parsing, web search, classification, extraction
    demo/                demo seeding and reset
    discovery/           pipeline: run sources → extract → dedupe → score
    graph/               BFS shortest paths and intro-request drafts
    icp/                 taxonomy and rules-based interpreter
    scoring/             config, formula, persistence
    http/                SSRF- and robots-aware fetching
prisma/
  schema.prisma          data model
  seed.ts                standalone demo seed for local inspection
data/
  demo/dataset.json      synthetic, fictional demo dataset
  samples/               contacts CSV example
tests/                   scoring, ingestion/classification, graph paths
docs/                    architecture and connector guides
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Next.js in development |
| `npm run build` | Generate Prisma client and build for production |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript without emitting |
| `npm test` | Run Vitest suites |
| `npm run db:push` | Push the Prisma schema |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed a standalone demo workspace |
| `npm run lint` | Next.js lint (requires ESLint config) |

## Deployment

### Vercel + hosted Postgres

1. Create a Postgres database (Prisma Postgres, Neon or Supabase).
2. From your machine, point `DATABASE_URL` at it and run `npx prisma db push`.
3. Import the repo in Vercel and set `DATABASE_URL` (plus optional search keys) in Project Settings → Environment Variables.
4. Deploy. `npm run build` runs `prisma generate` automatically.
5. Load demo data from `/settings`, or configure live sources at `/sources`.

For production, prefer migrations (`prisma migrate dev` → commit `prisma/migrations`) over `db push`, and add authentication before storing real contact data.

## Testing

```bash
npm test
```

Covered today:

- scoring: ICP components, exclusions, recency, diversity bonus, priority blend
- classification: funding/hiring detection, signal caps, negative cases
- extraction: company-name dedupe keys and domains
- CSV: parsing, invalid-row reporting, formula-injection escaping
- graph: shortest path, alternate first hops, `firstDegree` semantics, verified-only filtering, intro requests

## Limitations

- No authentication; workspaces are cookie-scoped.
- ICP extraction and signal classification are deterministic rules, not an LLM. They are explainable, but less flexible on unusual phrasing.
- Discovery only covers sources you configure. There is no crawl-the-web button.
- Job-feed coverage depends on public APIs and their rate limits.
- Company size/location are only as good as the evidence found; unknown values are marked, not guessed.

## Contributing

Issues and pull requests are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) and keep the data-ethics rules intact: no scraping behind logins, no bypassing robots.txt, no inventing relationships or evidence.

## License

MIT — see [`LICENSE`](LICENSE).
