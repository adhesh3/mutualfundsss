# Roadmap

This document turns the structure described in the [README](README.md) into a numbered, forward-looking plan: what already ships, and what's left to build.

The nice part: the data layer and analysis engine are the hard parts, and they're done. Most remaining work is **surfacing engine capabilities that already exist** (e.g. the NFO scorer) and **building UI on top of the existing Prisma models** (e.g. the `Holding` table) rather than reshaping the data model.

| Phase | Theme | Status |
|-------|-------|--------|
| 1 | Foundation — data layer, cache, provenance | ✅ Done |
| 2 | Metrics engine | ✅ Done |
| 3 | Verdict, mode & horizon engine | ✅ Done |
| 4 | Analyze deep-dive UI | ✅ Done |
| 5 | Screener & watchlist | ✅ Done |
| 6 | Allocation + fixed income | ✅ Done |
| 7 | Portfolio holdings (units + cost basis) | ✅ Done |
| 8 | NFO workflow | ✅ Done |
| 9 | Mark-to-market & gain tracking | ✅ Done |
| 10 | Alerts & buy/rebalance signals | ✅ Done |
| — | Scheduled NAV refresh / CSV import / export | ✅ Done |
| — | Deployment (Vercel + Turso ready) | ✅ Done |
| 11 | Test coverage + CI | ✅ Done |

---

## Phase 1 — Foundation (done)

The data backbone. Three free, unofficial sources are merged into a single `FundProfile`, with every fact tagged by source and cached to stay within rate limits.

**What shipped:**
- Clients for **mfapi.in** (NAV history, search, ISIN), **Kuvera** (expense ratio, AUM, rating, manager, SIP/lumpsum/STP rules), and **mfdata.in** (Sharpe/beta/alpha, holdings, sectors) — `src/lib/data/{mfapi,kuvera,mfdata}.ts`.
- `merge.ts` builds the unified profile and a `provenance` list; `categorize.ts` maps scheme names to category/asset class.
- Time-boxed `ApiCache` (SQLite) with per-source TTLs (`CACHE_TTL_MS`) so the app degrades gracefully and falls back to cached data when a source is down.
- Prisma + SQLite schema (`Fund`, `ApiCache`, `InvestorProfile`, `Holding`, `FixedIncomeInstrument`), UI primitives (shadcn-style), and central tunables in `src/lib/config.ts`.

---

## Phase 2 — Metrics engine (done)

The quantitative core, unit-tested with Vitest (`src/lib/analysis/metrics.test.ts`).

**What shipped:**
- Trailing returns + CAGR (1m–since inception), annualized volatility, max drawdown, Sharpe, Sortino.
- Rolling 3y/5y return consistency (% of windows beating the risk-free rate).
- Beta / alpha vs an index proxy (`BENCHMARK_SCHEME_BY_ASSET`, default UTI Nifty 50).
- Backtested **SIP-vs-lumpsum** (XIRR, invested vs final corpus) over a data-driven window.

---

## Phase 3 — Verdict, mode & horizon engine (done)

The transparent rule engine in `src/lib/analysis/recommend.ts`.

**What shipped:**
- Six-pillar weighted score (risk-adjusted, consistency, downside, cost, size/rating, momentum) → Strong Buy / Buy / Hold / Avoid, with a plain-English reason per pillar.
- Debt funds reweight pillars at runtime (cost + downside matter more).
- `adviseMode` (SIP / Lumpsum / STP-then-hold), `adviseHorizon` (min/ideal years incl. lock-ins), and `adviseSuitability` against the investor profile.
- Weights and thresholds live in `config.ts` (`SCORING_WEIGHTS`, `VERDICT_THRESHOLDS`).

---

## Phase 4 — Analyze deep-dive UI (done)

The `app/analyze/` page: search a fund, see everything.

**What shipped:**
- Typeahead search, headline stats (NAV/1Y/3Y/5Y/expense/AUM), NAV + drawdown charts (Recharts).
- The `VerdictCard`, full risk/return panel, SIP-vs-lumpsum panel, top holdings & sector allocation.
- A per-page **source provenance** line, and a one-click **Watch** button (`addToWatchlist`).

---

## Phase 5 — Screener & watchlist (done)

The `app/screener/` page ranks every watched fund by its score for the current profile, links back into Analyze, and reports funds that couldn't be analyzed (source unavailable).

---

## Phase 6 — Allocation + fixed income (done)

Portfolio-level guidance and the manual fixed-income register.

**What shipped:**
- `suggestTargetAllocation` (risk + horizon + optional "110 − age" blend) and `computeAllocation` (current vs target equity/debt/gold with drift **nudges** at ≥7 pts).
- `suggestedDebtCategories` by horizon.
- `app/fixed-income/` CRUD for FDs / G-Secs / corp bonds / debt funds / PPF / EPF, and the dashboard's allocation bars + upcoming maturities.
- `app/profile/` editor for risk tolerance, horizon, age, and target split.

---

## Phase 7 — Portfolio holdings (done)

Lets the user record actual fund positions, not just a watchlist, so the dashboard reflects a real portfolio at cost.

**What shipped:**
- Holdings server actions (`src/app/portfolio/actions.ts`): `addHolding`, `updateHolding`, `deleteHolding`. `addHolding` upserts the `Fund` row a position hangs off, and merges repeat buys of the same fund into one holding using a **units-weighted average cost**.
- An **"Add to portfolio"** inline form on the Analyze page (`add-holding-form.tsx`) next to the Watch button, capturing units + average buy NAV.
- A new **Portfolio page** (`/portfolio`, in the nav) listing every holding with units, average cost, invested amount, and portfolio weight, plus inline edit (`holding-row.tsx`) and delete.
- The dashboard gains a **Mutual fund holdings** card (top positions by invested cost, with weight bars and total invested) linking to the Portfolio page.
- The screener tags funds you actually hold with a **"Held"** badge (own vs watch-only).

**Deferred to Phase 9:** values are **cost basis** only (units × average buy NAV); live current-value/gain tracking comes with mark-to-market.

---

## Phase 8 — NFO workflow (done)

Surfaces the qualitative NFO path the README promises — NFOs have no NAV history, so they get a cautious, mandate/cost/AMC-based read instead of a quantitative score.

**What shipped:**
- Two new `Fund` columns (`nfoTerPct`, `fundManager`) so the offer document's stated TER and manager can be captured.
- A dedicated **analysis path** (`src/lib/analysis/nfo.ts`): `buildNfoProfile` assembles the minimal `FundProfile` that `recommendNfo` needs from a stored NFO row, and `analyzeNfo` runs it. `nfoWindowStatus` derives Upcoming / Open / Closed from the subscription dates.
- NFO server actions (`src/app/nfo/actions.ts`): `createNfo`, `deleteNfo`.
- A **/nfo page** (in the nav) with an entry form (name, AMC, category, manager, stated TER, open/close dates, mandate), a list of tracked NFOs tagged with their window status, and the qualitative analysis view (`/nfo?id=…`) rendering the fund header + the existing `VerdictCard`.
- A link from the Analyze empty state to the NFO page.

NFOs keep a null `amfiCode`, so they're naturally excluded from the (quantitative) screener.

---

## Phase 9 — Mark-to-market & gain tracking (done)

Shows current value and unrealised gains, not just cost basis.

**What shipped:**
- A valuation helper (`src/lib/analysis/valuation.ts`): `valueHolding` / `valueHoldings` fetch each fund's **latest NAV** via mfapi (cached) and compute current value, gain, and gain %. Funds whose NAV can't be fetched fall back to cost and are flagged (`valued: false`).
- The **Portfolio page** now shows per-holding current value + unrealised gain (coloured), the latest NAV and as-of date, and portfolio-wide **Invested / Current value / Unrealised gain** totals. Weights are computed on market value.
- The **dashboard** uses current market value in both the holdings card (value + total gain) and the **allocation drift** calc, so drift reflects what the portfolio is worth today rather than cost.

**Notes:** gains are unrealised and exclude exit load and tax. Valuation reuses the existing 6-hour mfapi cache, so it's cheap on repeat loads (no new price feed needed).

---

## Phase 10 — Alerts & buy/rebalance signals (done)

Turns the existing analysis into actionable nudges, consolidated on a new **/alerts** page (in the nav, with a shortcut button on the dashboard).

**What shipped:**
- Pure signal helpers (`src/lib/analysis/signals.ts`): `currentDrawdown`, `buySignalFor`, and `maturityReminders`, with thresholds in `config.ts` (`BUY_SIGNAL_DRAWDOWN`, `REBALANCE_DRIFT_PTS`, `MATURITY_HORIZON_DAYS`).
- **Buy signals:** watched funds trading ≥10% below their peak are flagged (≥20% = "Strong"), excluding funds the engine rates "Avoid" — so it's quality funds on sale, with a mode-aware suggestion (e.g. step up the SIP).
- **Rebalance alerts:** reuses `computeAllocation` drift nudges, computed on **current market value** (Phase 9), linking to the profile targets.
- **Maturity reminders:** fixed-income instruments maturing within 90 days, soonest first.
- The page shows a friendly empty state when nothing needs attention.

---

## Stretch — Scheduled NAV refresh / CSV import / export (done)

**What shipped:**
- **NAV refresh:** `refreshNavCache()` force-refetches (cache-bypassing, with fallback) the NAV for every watched + held fund. Exposed three ways: `GET /api/refresh` (for cron, optionally `CRON_SECRET`-protected), a "Refresh NAVs" button on the Portfolio page (server action), and `npm run refresh:nav`.
- **CSV import:** bulk-add holdings on the Portfolio page by pasting `amfiCode,units,avgCostNav` rows — fund names/categories are auto-looked-up from mfapi, with per-row error reporting.
- **CSV export:** `GET /api/export/holdings` (and an Export button) streams holdings with cost, latest NAV, current value, and gains.

---

## Deployment (done — Vercel + Turso ready)

The app is local-first (SQLite) but now deploys cleanly:

- **Persistent DB:** the Prisma client (`src/lib/prisma.ts`) switches to the **libSQL driver adapter** when `TURSO_DATABASE_URL` is set, so data survives on serverless hosts where the SQLite file is ephemeral. Local dev is unchanged (defaults to the `DATABASE_URL` file).
- **Build hygiene:** `next.config.mjs` pins `outputFileTracingRoot` (this folder shares a workspace with sibling projects) and marks the libSQL packages as server-external; `postinstall` runs `prisma generate`.
- **Scheduled refresh:** `vercel.json` schedules `GET /api/refresh` daily; lock it with `CRON_SECRET`.
- See the README's **Deploy** section for the step-by-step (provision Turso → `prisma db push` → set env → deploy).

The only steps that must happen outside this repo are provisioning the Turso DB and running the actual Vercel deploy.

---

## Phase 11 — Test coverage + CI (done)

Locks in the analysis engine and data helpers with fast, deterministic unit tests.

**What shipped:**
- **9 spec files / 81 tests** (Vitest) covering `format`, `categorize`, `allocation`, `recommend` (verdict thresholds, debt reweighting, mode/horizon/suitability, NFO scorer), `signals`, `valuation` (mfapi mocked), `nfo`, the CSV parser, plus the pre-existing `metrics` suite.
- **Coverage reporting** via `@vitest/coverage-v8` (`npm run test:coverage`), scoped to the unit-tested pure surface (network/DB clients excluded) — ~94% statements / 97% functions.
- A small refactor extracted a pure **`holdings-csv.ts`** (parse + RFC-4180 cell escaping) out of the server action and export route so it's unit-testable.
- **GitHub Actions CI** (`.github/workflows/ci.yml`): typecheck + test + build on every push to `main` and PR.

**Integration tests:** opt-in live tests (`npm run test:integration`, gated by `RUN_INTEGRATION`) hit the real mfapi / Kuvera / mfdata APIs and the `buildFundProfile` merge. They're tolerant of the flaky mfdata.in feed (which the merge layer degrades around) and are skipped by the default suite / CI so offline runs stay green.

**Still not auto-tested:** orchestration (`analyze.ts`) and the low-level `cache`/`http` plumbing — exercised indirectly via the merge integration test and the live app.
