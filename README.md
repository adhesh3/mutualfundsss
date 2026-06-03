# Fund Analyzer

A personal, single-user web app that analyzes Indian mutual funds (and NFOs), tells you whether a fund looks like a **Buy / Hold / Avoid**, whether to go **SIP or lumpsum**, over what **time horizon**, and helps you balance risk with **fixed-income allocation** guidance.

> **Not investment advice.** This is a personal research tool. Data comes from free, unofficial community APIs and may be delayed or inaccurate. Mutual fund investments are subject to market risks.

See [ROADMAP.md](ROADMAP.md) for what's built and what's planned next.

## What it does

- **Analyze** any fund: trailing returns, CAGR, volatility, max drawdown, Sharpe, Sortino, rolling-return consistency, beta/alpha vs an index, plus a backtested **SIP-vs-lumpsum** comparison.
- **Rule-based verdict**: a transparent, weighted score across six pillars (risk-adjusted return, consistency, downside protection, cost, size/rating, momentum) -> Strong Buy / Buy / Hold / Avoid, with a plain-English reason for every pillar.
- **SIP vs lumpsum & horizon**: derived from volatility, current drawdown, asset class, and the fund's own SIP/STP rules (from Kuvera).
- **NFOs**: handled qualitatively (no track record), with an explicit caution.
- **Screener**: ranks your watchlist by score for your profile.
- **Fixed income & allocation**: a target equity/debt/gold split for your risk + horizon, debt-category suggestions, a manual register of FDs/bonds/G-Secs, and drift/rebalancing nudges.

## Data sources (all free, no API keys)

| Source | Used for | Notes |
|--------|----------|-------|
| [mfapi.in](https://www.mfapi.in/) | NAV history, name search, ISIN resolution | Most reliable; backbone for computed metrics |
| [Kuvera](https://mf.captnemo.in/) (unofficial) | Expense ratio, AUM, ratings, fund manager, returns, SIP/lumpsum/STP rules | Looked up by ISIN |
| [mfdata.in](https://mfdata.in/) | Risk ratios (Sharpe/beta/alpha), holdings, sector allocation | Enrichment; app degrades gracefully if it's down |

Each fact is tagged with its source on the analysis page. If a source is unavailable, the app falls back to cached data and still produces a partial profile.

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS + shadcn-style UI primitives + Recharts
- Prisma + SQLite (local file, zero external infra)
- Vitest for the metrics engine

## Setup

```bash
npm install
cp .env.example .env        # DATABASE_URL defaults to a local SQLite file
npm run db:push             # create the SQLite schema + Prisma client
npm run dev                 # http://localhost:3000
```

First run: open **Profile**, set your risk tolerance and horizon. Then go to **Analyze**, search a fund, and add ones you like to your watchlist (they show up in the **Screener**). Track FDs/bonds under **Fixed Income**.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Run the metrics unit tests |
| `npm run db:push` | Apply the Prisma schema to SQLite |
| `npm run db:studio` | Browse the local database |
| `npm run refresh:nav` | Pre-warm the NAV cache (curls `/api/refresh`; dev server must be running) |

## Importing & exporting

- **Import** holdings in bulk on the **Portfolio** page: paste CSV rows of `amfiCode,units,avgCostNav` (fund names are looked up automatically).
- **Export** your holdings (with current value and gains) via the Export CSV button, or directly from `/api/export/holdings`.
- **Refresh NAVs** on demand with the Portfolio page button, or on a schedule by hitting `GET /api/refresh` (warms the cache for watched + held funds).

## Deploy

The app is local-first (SQLite). To run it from any device:

1. Provision a [Turso](https://turso.tech) (libSQL) database and `prisma db push` your schema to it. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` — the Prisma client switches to the libSQL driver adapter automatically (the local SQLite file is ephemeral on serverless hosts, so this is required for data to persist).
2. Deploy to **Vercel**. `vercel.json` already schedules `GET /api/refresh` daily to keep NAVs fresh; set a `CRON_SECRET` env var to lock that endpoint down.
3. `postinstall` runs `prisma generate` so the client is built during the deploy.

## Project layout

```
src/
  app/
    page.tsx                # dashboard (allocation vs target, maturities)
    analyze/                # search + deep-dive analysis + verdict
    screener/               # watchlist ranked by score
    fixed-income/           # allocation guidance + instruments CRUD
    profile/                # investor profile editor
    api/search/             # fund name search endpoint
  components/
    charts/                 # NAV + drawdown charts (Recharts)
    ui/                     # shadcn-style primitives
    verdict-card.tsx        # the recommendation card
  lib/
    data/                   # mfapi / kuvera / mfdata clients + merge + cache
    analysis/               # metrics, recommend, allocation, analyze orchestrator
    config.ts               # tunables: risk-free rate, weights, horizons, benchmarks
prisma/schema.prisma        # Fund, ApiCache, InvestorProfile, Holding, FixedIncomeInstrument
```

## How the score works

Pillar weights live in [`src/lib/config.ts`](src/lib/config.ts) (`SCORING_WEIGHTS`) and are reweighted for debt funds (cost and downside matter more). Verdict thresholds are in `VERDICT_THRESHOLDS`. The risk-free rate (used for Sharpe/Sortino) defaults to 6.6% and can be overridden via `RISK_FREE_RATE` in `.env`.

## Caveats

- The data APIs are community-run and best-effort; cross-check anything important.
- NFOs and bonds have no good free data feed - NFOs are qualitative; fixed-income instruments are entered manually.
- Analyze the **Growth** plan of a fund, not IDCW/dividend plans (their NAV drops on payouts and understates returns - the app warns you).
```
