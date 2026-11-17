# Connectors

Every source in Buying Signal Radar is an explicit connector with a Zod config schema, a permission note and a provenance contract. There is no generic "scrape anything" path.

## Catalogue

| `SourceType` | Connector | Default source | Requires key |
| --- | --- | --- | --- |
| `RSS` | RSS / Atom feeds | TechCrunch startups, venture and industry tags; Tech.eu; Crunchbase News | No |
| `HN` | Hacker News Algolia API | Show HN launches matched to your category | No |
| `JOB_FEED` | Remotive, Jobicy, Greenhouse, Lever, Ashby + ATS auto-detect | Remotive + Jobicy hiring search | No |
| `WEBSITE` | Company-owned public pages | Added per company | No |
| `URL` | Any page you submit | Empty by default | No |
| `WEB_SEARCH` | Tavily or Brave Search API | Suggested when a key exists | Yes |

The catalogue is exported from `src/lib/connectors/index.ts` (`CONNECTOR_CATALOG`) and rendered at `/sources`.

## Permission model

| Type | Allowed | Not allowed |
| --- | --- | --- |
| `RSS` | Public feeds intended for syndication | Paywalled or private feeds |
| `HN` | Public Algolia search API | Scraping the HTML site at scale |
| `JOB_FEED` | Public job APIs and ATS boards (Greenhouse, Lever, Ashby), company careers pages | LinkedIn, Indeed scraping, login-only boards |
| `WEBSITE` | Company-owned public pages | Auth, paywalls, anti-bot circumvention |
| `URL` | A page the user explicitly submits | Crawling beyond that page |
| `WEB_SEARCH` | Official Tavily/Brave API with your key | SERP scraping, rotating proxies |

All network access passes through `src/lib/http/safe-fetch.ts`:

```ts
fetchPublicPage(url, { timeoutMs, maxBytes, checkRobots })
```

It enforces:

- `http:` / `https:` only
- DNS resolution followed by a block on loopback, RFC1918, CGNAT, link-local and cloud-metadata ranges
- the same check on every redirect hop (max 5)
- `robots.txt` fetched once per host per process and honoured for the request path
- 12s timeout, 2 MB response cap, descriptive user agent

If a fetch fails, the connector returns a warning. The discovery pipeline records it in `IngestionRun` and `Source.lastStatus`; it never substitutes synthetic content.

## Config schemas

### RSS

```json
{
  "feedUrl": "https://example.com/feed.xml",
  "maxItems": 20
}
```

Accepts RSS 2.0 and Atom. Each item becomes a `RawDocument` with title, link, summary, publication date and the feed's name as `sourceName`.

### Hacker News

```json
{
  "query": "revenue operations",
  "tags": "show_hn",
  "minPoints": 2,
  "maxItems": 12
}
```

Uses the public Algolia API (`https://hn.algolia.com/api/v1/search`). The discussion URL is kept as provenance.

### Job feed

```json
{ "provider": "remotive", "query": "VP Sales", "maxItems": 12 }
```

```json
{ "provider": "jobicy", "tag": "sales", "maxItems": 12 }
```

```json
{ "provider": "greenhouse", "boardToken": "acme", "maxItems": 20 }
```

```json
{ "provider": "lever", "boardToken": "acme", "maxItems": 20 }
```

```json
{ "provider": "ashby", "boardToken": "acme", "companyName": "Acme", "maxItems": 20 }
```

**Watchlist / auto-detect.** Give a list of domains and the connector resolves the public careers board behind each one:

```json
{ "provider": "auto", "domains": ["linear.app", "vercel.com", "ramp.com"], "maxItems": 24 }
```

Detection order: probe the public Ashby → Lever → Greenhouse APIs with the domain's first label, then read the company homepage and `/careers` pages and look for `jobs.ashbyhq.com`, `jobs.lever.co` or `boards.greenhouse.io` links. Up to 8 domains per source, and every role keeps its own listing URL.

Hiring documents produce `HIRING` signals. The job listing URL is the evidence link.

### URL / website

```json
{ "url": "https://example.com/press/series-b", "checkRobots": true }
```

```json
{ "url": "https://example.com", "maxPages": 1, "checkRobots": true }
```

The page parser extracts title, description, JSON-LD organisation facts (name, location, headcount when present), canonical URL and role mentions. It does not follow links automatically.

### Web search

```json
{
  "provider": "tavily",
  "query": "UK fintech (funding OR hiring OR expansion)",
  "maxResults": 8
}
```

`provider` is `tavily` or `brave`. The connector reads `TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY`; with neither set it reports `CONNECTOR_UNAVAILABLE` and the UI disables it.

## Importing contacts

Contacts are not a connector. `/referral` imports a CSV you already own:

- The project's own template (`data/samples/contacts-sample.csv`).
- A **LinkedIn connections export** (`Connections.csv`). The parser strips the `Notes:` preamble, joins `First Name` + `Last Name`, reads `URL`, `Company`, `Position` and `Connected On`, marks rows as direct connections and keeps the profile URL as a manual reference.

LinkedIn profile pages are never fetched. `safeFetch` blocks `linkedin.com` at the host level, so no code path can turn a stored profile URL into a scrape.

## Adding a connector

1. Create `src/lib/connectors/my-source.ts` exporting a `SourceConnector`:

```ts
export const myConnector: SourceConnector<MyConfig> = {
  kind: "RSS",                          // extend the SourceType enum if new
  label: "My source",
  description: "What it reads and why it is permitted.",
  configSchema: myConfigSchema,
  docs: "docs/connectors.md#my-source",
  requiresEnv: ["MY_API_KEY"],          // optional
  async fetch(config, { icp, now }) {
    return {
      documents: [/* RawDocument[] */],
      warnings: [],
      attribution: "My source",
    };
  },
};
```

2. Register it in `CONNECTORS` and `CONNECTOR_SCHEMAS` in `src/lib/connectors/index.ts`.
3. Add defaults in `buildDefaultSources()` only if it should be enabled for new ICPs.
4. Add a `CONNECTOR_CATALOG` entry with a permission note.
5. Add tests for document extraction and classification.
6. Document the config schema above and confirm the source's terms allow programmatic access.

## Signal classification

`src/lib/connectors/classify.ts` maps documents to the nine categories:

| Category | Typical triggers |
| --- | --- |
| `HIRING` | job feed posts, "hiring", "open role", role titles |
| `FUNDING` | "raises", "Series A/B/C", "seed", "investment" |
| `EXPANSION` | "opens office", "expands to", new market/region |
| `PRODUCT_LAUNCH` | "launches", "releases", "general availability", Show HN |
| `TECHNOLOGY_CHANGE` | "migrates to", "adopts", "replaces", stack mentions |
| `PARTNERSHIP` | "partners with", "integration with", "joint venture" |
| `LEADERSHIP` | "appoints", "names … as", "joins as", CxO titles |
| `CUSTOMER_GROWTH` | "surpasses … customers", "customer milestone" |
| `CUSTOMER_COMPLAINT` | public complaints, outages, migration-away posts |

Rules produce at most two candidates per document, each with a confidence score and an evidence snippet. A candidate below the confidence floor is dropped rather than padded.

## Debugging a source

1. Open `/sources` and press **Test** on the source. This runs the connector once and reports document/warning counts without writing prospects.
2. Check `Source.lastStatus` / `lastError` and the latest `IngestionRun` warnings.
3. For fetch failures, confirm the URL is public and robots-permitted; private or loopback hosts are blocked by design.
4. For empty results, widen the ICP category or check that the feed/board token still exists.
