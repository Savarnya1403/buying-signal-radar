# Contributing

Thanks for considering a contribution. Buying Signal Radar is a small, opinionated codebase; the fastest way to get a change merged is to keep it narrow and keep the data-ethics rules intact.

## Ground rules

1. **No invented data.** Relationships, evidence snippets, headcounts and locations must come from a source you can link to, or be explicitly marked unverified.
2. **No authenticated scraping or bypass.** Do not add connectors that log in, evade robots.txt, rotate IPs or defeat anti-bot measures. PRs that do will be closed.
3. **Demo data stays labelled.** Anything synthetic must use `.example` domains/emails and be tagged `dataMode: DEMO`.
4. **Scores are not probabilities.** Do not relabel priority scores as likelihood to buy.
5. **Privacy by default.** Public reports must never include contacts, notes or relationship data.

## Development setup

```bash
npm install
cp .env.example .env          # set DATABASE_URL
npx prisma dev                # or use your own Postgres
npx prisma db push
npm run dev
```

Useful checks before opening a PR:

```bash
npm run typecheck
npm test
npm run build
```

## Coding conventions

- TypeScript strict mode is expected; avoid `any`.
- Server-only modules import `server-only`.
- Route handlers return the shared envelope from `src/lib/api.ts` and validate bodies with Zod.
- Prisma JSON writes use `Prisma.InputJsonValue` casts.
- Next.js 15 route params and `cookies()` / `headers()` are asynchronous — await them.
- UI: dark-first, `panel` surfaces, `label-mono` micro-labels, lime (`signal.lime`) as the primary accent, signal colours from `SIGNAL_META`.
- Prefer small server components with client widgets only where interaction requires it.
- Never call `Math.random()` for anything that affects stored demo data; the demo dataset is deterministic.

## Adding tests

Tests live in `tests/` and run against pure modules with Vitest.

- Scoring changes need a case in `tests/scoring.test.ts` asserting the component and the total.
- Classifier/extraction changes need positive and negative cases in `tests/ingestion.test.ts`.
- Graph changes need path-shape, `firstDegree`, verified-only and no-path cases in `tests/graph.test.ts`.

Run `npm test` before pushing.

## Manual QA checklist

For UI or pipeline changes, run the full journey once:

- [ ] Load demo data from `/settings`; banner and DEMO badges appear
- [ ] `/discover`: describe a product, review/edit ICP, choose sources, run
- [ ] `/dashboard`: scores, radar blips and charts render; empty state works with no ICP
- [ ] `/companies`: filters narrow results; sorting by priority is stable
- [ ] `/companies/[id]`: evidence links, score breakdown, save/contact/disqualify, intro path
- [ ] `/referral`: import `data/samples/contacts-sample.csv`, add a contact, find a path, copy an intro request
- [ ] `/saved`: notes persist, CSV export downloads, formula-injection strings are escaped
- [ ] `/sources`: test a source, disable/enable, failure is shown honestly
- [ ] `/reports`: create a report, open the public link in a private window, rotate and revoke the token
- [ ] `/settings`: change weights, rescore, verify the breakdown changes
- [ ] Mobile width: sidebar collapses to the mobile bar; no horizontal scroll

## Commit style

Imperative, scoped subjects, for example:

```
scoring: cap ICP fit when an exclusion matches
connectors: honour robots.txt on redirect
graph: distinguish introduction targets from direct contacts
```

## Reporting bugs

Open an issue with:

- what you expected and what happened,
- exact reproduction steps,
- the route or module involved,
- whether demo mode was active,
- relevant server logs with secrets removed.

## License

By contributing you agree that your work is licensed under the project's MIT license.
