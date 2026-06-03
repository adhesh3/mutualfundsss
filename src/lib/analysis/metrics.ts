import { RISK_FREE_RATE, TRADING_DAYS_PER_YEAR } from "@/lib/config";
import type { NavPoint } from "@/lib/data/types";

const MS_PER_DAY = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY);
}

function shiftMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Drop corrupt NAV ticks: an isolated >maxJump move over a short gap is almost
 * always a data error (or an IDCW payout in a non-growth plan), which otherwise
 * blows up volatility, Sharpe, and drawdown. Large moves across long date gaps
 * (missing data) are kept.
 */
export function sanitizeNavSeries(history: NavPoint[], maxJump = 0.4): NavPoint[] {
  if (history.length < 2) return history;
  const out: NavPoint[] = [history[0]];
  for (let i = 1; i < history.length; i++) {
    const last = out[out.length - 1];
    const r = history[i].nav / last.nav - 1;
    const gapDays = daysBetween(last.date, history[i].date);
    if (Math.abs(r) > maxJump && gapDays <= 7) continue; // skip spike
    out.push(history[i]);
  }
  return out;
}

/**
 * Back-adjust persistent NAV restatements (e.g. a face-value/scale change where
 * NAV jumps ~10x and stays there). We scale older points onto the new level so
 * the return series stays continuous - like split-adjusting a stock. Isolated
 * spikes (which revert) are left for sanitizeNavSeries to drop.
 */
export function adjustForRestatements(history: NavPoint[], minFactor = 3, maxGapDays = 7): NavPoint[] {
  const n = history.length;
  if (n < 3) return history;
  const factors = new Array(n).fill(1);
  let factor = 1;
  for (let i = n - 2; i >= 0; i--) {
    const rawRatio = history[i + 1].nav / history[i].nav;
    const gap = daysBetween(history[i].date, history[i + 1].date);
    const isBig = rawRatio >= minFactor || rawRatio <= 1 / minFactor;
    // Confirm the new level holds (next point within 40%), i.e. not a spike.
    let persistent = true;
    if (i + 2 < n) {
      const after = history[i + 2].nav / history[i + 1].nav;
      persistent = after >= 1 / 1.4 && after <= 1.4;
    }
    if (isBig && gap <= maxGapDays && persistent) factor *= rawRatio;
    factors[i] = factor;
  }
  return history.map((p, i) => ({ date: p.date, nav: p.nav * factors[i] }));
}

/** Restatement-adjusted then spike-cleaned series used for all metrics. */
export function cleanNavSeries(history: NavPoint[]): NavPoint[] {
  return sanitizeNavSeries(adjustForRestatements(history));
}

/** Last NAV point on or before the target date (history must be ascending). */
export function navAsOf(history: NavPoint[], targetIso: string): NavPoint | undefined {
  let result: NavPoint | undefined;
  for (const p of history) {
    if (p.date <= targetIso) result = p;
    else break;
  }
  return result;
}

export function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || years <= 0) return NaN;
  return Math.pow(end / start, 1 / years) - 1;
}

/** Simple day-over-day returns. */
export function dailyReturns(history: NavPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].nav;
    if (prev > 0) out.push(history[i].nav / prev - 1);
  }
  return out;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export function stdDev(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

export function annualizedVolatility(history: NavPoint[]): number {
  return stdDev(dailyReturns(history)) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/** Largest peak-to-trough decline as a positive fraction (0.3 => -30%). */
export function maxDrawdown(history: NavPoint[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of history) {
    if (p.nav > peak) peak = p.nav;
    if (peak > 0) maxDd = Math.max(maxDd, (peak - p.nav) / peak);
  }
  return maxDd;
}

/** Annualized downside deviation of daily returns below the daily risk-free rate. */
export function downsideDeviation(history: NavPoint[], rf = RISK_FREE_RATE): number {
  const dailyRf = rf / TRADING_DAYS_PER_YEAR;
  const downs = dailyReturns(history)
    .map((r) => Math.min(0, r - dailyRf))
    .map((d) => d * d);
  if (!downs.length) return NaN;
  return Math.sqrt(mean(downs)) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

export function annualizedReturn(history: NavPoint[]): number {
  return mean(dailyReturns(history)) * TRADING_DAYS_PER_YEAR;
}

export function sharpe(history: NavPoint[], rf = RISK_FREE_RATE): number {
  const vol = annualizedVolatility(history);
  if (!Number.isFinite(vol) || vol === 0) return NaN;
  return (annualizedReturn(history) - rf) / vol;
}

export function sortino(history: NavPoint[], rf = RISK_FREE_RATE): number {
  const dd = downsideDeviation(history, rf);
  if (!Number.isFinite(dd) || dd === 0) return NaN;
  return (annualizedReturn(history) - rf) / dd;
}

export interface RollingStats {
  windowYears: number;
  count: number;
  avg: number;
  min: number;
  max: number;
  pctPositive: number;
  pctAboveRf: number;
}

/** Rolling CAGR over fixed windows, sampled ~monthly, to gauge consistency. */
export function rollingReturns(history: NavPoint[], windowYears: number, rf = RISK_FREE_RATE): RollingStats | null {
  if (history.length < 2) return null;
  const results: number[] = [];
  const last = history.at(-1)!;
  // Step start dates monthly from inception until window no longer fits.
  let startIso = history[0].date;
  const cutoff = shiftMonths(last.date, -Math.round(windowYears * 12));
  while (startIso <= cutoff) {
    const startPt = navAsOf(history, startIso);
    const endPt = navAsOf(history, shiftMonths(startIso, Math.round(windowYears * 12)));
    if (startPt && endPt && endPt.date > startPt.date) {
      const yrs = daysBetween(startPt.date, endPt.date) / 365.25;
      const r = cagr(startPt.nav, endPt.nav, yrs);
      if (Number.isFinite(r)) results.push(r);
    }
    startIso = shiftMonths(startIso, 1);
  }
  if (!results.length) return null;
  return {
    windowYears,
    count: results.length,
    avg: mean(results),
    min: Math.min(...results),
    max: Math.max(...results),
    pctPositive: results.filter((r) => r > 0).length / results.length,
    pctAboveRf: results.filter((r) => r > rf).length / results.length,
  };
}

export interface BetaAlpha {
  beta: number;
  alpha: number;
  rSquared: number;
}

/** CAPM beta/alpha/R^2 of the fund vs a benchmark NAV series (date-aligned). */
export function betaAlpha(
  fund: NavPoint[],
  benchmark: NavPoint[],
  rf = RISK_FREE_RATE,
): BetaAlpha | null {
  const benchMap = new Map(benchmark.map((p) => [p.date, p.nav]));
  const pairedDates = fund.filter((p) => benchMap.has(p.date)).map((p) => p.date);
  if (pairedDates.length < 30) return null;

  const fr: number[] = [];
  const br: number[] = [];
  for (let i = 1; i < pairedDates.length; i++) {
    const d0 = pairedDates[i - 1];
    const d1 = pairedDates[i];
    const f0 = fund.find((p) => p.date === d0)!.nav;
    const f1 = fund.find((p) => p.date === d1)!.nav;
    const b0 = benchMap.get(d0)!;
    const b1 = benchMap.get(d1)!;
    if (f0 > 0 && b0 > 0) {
      fr.push(f1 / f0 - 1);
      br.push(b1 / b0 - 1);
    }
  }
  if (fr.length < 30) return null;

  const mf = mean(fr);
  const mb = mean(br);
  let cov = 0;
  let varB = 0;
  let varF = 0;
  for (let i = 0; i < fr.length; i++) {
    cov += (fr[i] - mf) * (br[i] - mb);
    varB += (br[i] - mb) ** 2;
    varF += (fr[i] - mf) ** 2;
  }
  if (varB === 0 || varF === 0) return null;
  const beta = cov / varB;
  const annF = mf * TRADING_DAYS_PER_YEAR;
  const annB = mb * TRADING_DAYS_PER_YEAR;
  const alpha = annF - (rf + beta * (annB - rf));
  const rSquared = (cov * cov) / (varB * varF);
  return { beta, alpha, rSquared };
}

/** Extended Internal Rate of Return for dated cashflows. Returns annualized fraction. */
export function xirr(cashflows: { date: string; amount: number }[]): number {
  if (cashflows.length < 2) return NaN;
  const flows = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));
  const t0 = new Date(flows[0].date).getTime();
  const years = (cf: { date: string }) => (new Date(cf.date).getTime() - t0) / (365.25 * MS_PER_DAY);

  const npv = (rate: number) => flows.reduce((acc, cf) => acc + cf.amount / Math.pow(1 + rate, years(cf)), 0);
  const dNpv = (rate: number) =>
    flows.reduce((acc, cf) => {
      const t = years(cf);
      return acc - (t * cf.amount) / Math.pow(1 + rate, t + 1);
    }, 0);

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate);
    const df = dNpv(rate);
    if (Math.abs(df) < 1e-10) break;
    const next = rate - f / df;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-7) return next;
    rate = Math.max(next, -0.9999);
  }
  return rate;
}

export interface SipVsLumpsum {
  windowYears: number;
  monthlyAmount: number;
  sipInvested: number;
  sipFinalValue: number;
  sipXirr: number;
  lumpsumInvested: number;
  lumpsumFinalValue: number;
  lumpsumXirr: number;
}

/**
 * Compare a monthly SIP vs an equal-total lumpsum over the trailing window.
 * Lumpsum invests the full SIP total at the window start.
 */
export function sipVsLumpsum(
  rawHistory: NavPoint[],
  windowYears: number,
  monthlyAmount = 10_000,
): SipVsLumpsum | null {
  const history = cleanNavSeries(rawHistory);
  if (history.length < 2) return null;
  const last = history.at(-1)!;
  const startIso = shiftMonths(last.date, -Math.round(windowYears * 12));
  if (startIso < history[0].date) return null;

  const months = Math.round(windowYears * 12);
  const cashflows: { date: string; amount: number }[] = [];
  let units = 0;
  for (let i = 0; i < months; i++) {
    const onIso = shiftMonths(startIso, i);
    const pt = navAsOf(history, onIso);
    if (!pt || pt.nav <= 0) continue;
    units += monthlyAmount / pt.nav;
    cashflows.push({ date: pt.date, amount: -monthlyAmount });
  }
  if (!cashflows.length) return null;
  const sipFinalValue = units * last.nav;
  const sipInvested = cashflows.length * monthlyAmount;
  const sipXirr = xirr([...cashflows, { date: last.date, amount: sipFinalValue }]);

  const startPt = navAsOf(history, startIso)!;
  const lumpsumInvested = sipInvested;
  const lumpsumFinalValue = (lumpsumInvested / startPt.nav) * last.nav;
  const lumpsumXirr = xirr([
    { date: startPt.date, amount: -lumpsumInvested },
    { date: last.date, amount: lumpsumFinalValue },
  ]);

  return {
    windowYears,
    monthlyAmount,
    sipInvested,
    sipFinalValue,
    sipXirr,
    lumpsumInvested,
    lumpsumFinalValue,
    lumpsumXirr,
  };
}

export interface FundMetrics {
  asOf?: string;
  latestNav?: number;
  inceptionDate?: string;
  yearsOfData: number;
  trailing: {
    m1?: number;
    m3?: number;
    m6?: number;
    y1?: number;
    y3Cagr?: number;
    y5Cagr?: number;
    sinceInceptionCagr?: number;
  };
  annualizedReturn?: number;
  annualizedVolatility?: number;
  maxDrawdown?: number;
  downsideDeviation?: number;
  sharpe?: number;
  sortino?: number;
  rolling3y?: RollingStats | null;
  rolling5y?: RollingStats | null;
  beta?: number;
  alpha?: number;
  rSquared?: number;
}

function trailingReturn(history: NavPoint[], months: number): number | undefined {
  const last = history.at(-1)!;
  const startPt = navAsOf(history, shiftMonths(last.date, -months));
  if (!startPt || startPt.date === last.date) return undefined;
  const yrs = daysBetween(startPt.date, last.date) / 365.25;
  if (months >= 12) return cagr(startPt.nav, last.nav, yrs);
  return last.nav / startPt.nav - 1;
}

export function computeMetrics(rawHistory: NavPoint[], rawBenchmark?: NavPoint[]): FundMetrics {
  const history = cleanNavSeries(rawHistory);
  const benchmark = rawBenchmark ? cleanNavSeries(rawBenchmark) : undefined;
  if (history.length < 2) {
    return { yearsOfData: 0, trailing: {} };
  }
  const first = history[0];
  const last = history.at(-1)!;
  const yearsOfData = daysBetween(first.date, last.date) / 365.25;
  const ba = benchmark ? betaAlpha(history, benchmark) : null;

  return {
    asOf: last.date,
    latestNav: last.nav,
    inceptionDate: first.date,
    yearsOfData,
    trailing: {
      m1: trailingReturn(history, 1),
      m3: trailingReturn(history, 3),
      m6: trailingReturn(history, 6),
      y1: trailingReturn(history, 12),
      y3Cagr: yearsOfData >= 3 ? trailingReturn(history, 36) : undefined,
      y5Cagr: yearsOfData >= 5 ? trailingReturn(history, 60) : undefined,
      sinceInceptionCagr: cagr(first.nav, last.nav, yearsOfData),
    },
    annualizedReturn: annualizedReturn(history),
    annualizedVolatility: annualizedVolatility(history),
    maxDrawdown: maxDrawdown(history),
    downsideDeviation: downsideDeviation(history),
    sharpe: sharpe(history),
    sortino: sortino(history),
    rolling3y: yearsOfData >= 3.5 ? rollingReturns(history, 3) : null,
    rolling5y: yearsOfData >= 5.5 ? rollingReturns(history, 5) : null,
    beta: ba?.beta,
    alpha: ba?.alpha,
    rSquared: ba?.rSquared,
  };
}
