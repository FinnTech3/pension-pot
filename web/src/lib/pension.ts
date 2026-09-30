// The app's reading of data/built/pension.json. Annuity prices were worked out by
// pipeline/src/pensionpot; this looks them up and redoes the tax arithmetic,
// which src/lib/pension.test.ts checks against the pipeline's own examples.

export type Kind = "rpi" | "level";
export type Standard = "minimum" | "moderate" | "comfortable";
export const STANDARDS: Standard[] = ["minimum", "moderate", "comfortable"];

export interface PensionFile {
  quote_date: string;
  ages: number[];
  shifts: number[];
  rates: Record<Kind, number[][]>;
  standards: Record<"1" | "2", Record<Standard, { net: number; gross: number }>>;
  history: [date: string, rate: number][];
  real20: [date: string, yieldPct: number][];
  tax: {
    state_pension: number;
    allowance: number;
    basic_limit: number;
    additional: number;
    examples: [number, number][];
  };
  check: {
    passed: boolean;
    mortality_scale: number;
    spread: number;
    rows: { product: string; age: number; quoted: number; priced: number; gap: number; tuned: boolean }[];
  };
}

/** 2026-27 income tax, rest of UK, below the £100,000 taper: as pots.income_tax. */
export function incomeTax(d: PensionFile, income: number): number {
  const { allowance, basic_limit, additional } = d.tax;
  const basic = Math.max(0, Math.min(income, basic_limit) - allowance) * 0.2;
  const higher = Math.max(0, Math.min(income, additional) - basic_limit) * 0.4;
  return basic + higher;
}

/** Yearly income for £1 of pot, at an age and a move in gilt yields (points). */
export function rate(d: PensionFile, kind: Kind, age: number, shift = 0): number {
  const i = d.ages.indexOf(age);
  const j = d.shifts.indexOf(shift);
  if (i < 0 || j < 0) throw new Error(`no price for age ${age} and shift ${shift}`);
  return d.rates[kind][i]![j]!;
}

export function people(n: number): "1" | "2" {
  return n === 2 ? "2" : "1";
}

/**
 * The pot an income needs at a price, and nothing where the income is nothing.
 *
 * The rule is a pound rather than zero because the pipeline solves for the
 * income wanted on top of the state pension, and where the state pension
 * covers a standard outright that solve lands on a residue near 1e-25 rather
 * than on 0. Anything under a pound a year is no pot; it is written here once
 * so the price today and the price in 2005 cannot disagree about it.
 */
function potOf(gross: number, price: number): number {
  return gross < 1 ? 0 : gross / price;
}

/** The pot a household needs for a standard. Zero where the state pension already covers it. */
export function potFor(d: PensionFile, n: number, standard: Standard, age: number, kind: Kind, shift = 0): number {
  return potOf(d.standards[people(n)][standard].gross, rate(d, kind, age, shift));
}

/** Spending money a year, after tax, from a pot split evenly between the household, plus state pensions. */
export function spendingFrom(d: PensionFile, n: number, pot: number, age: number, kind: Kind, shift = 0): number {
  const each = (pot * rate(d, kind, age, shift)) / n + d.tax.state_pension;
  return n * (each - incomeTax(d, each));
}

/** The highest standard a level of spending reaches, or null if below the minimum. */
export function reached(d: PensionFile, n: number, spending: number): Standard | null {
  let best: Standard | null = null;
  for (const s of STANDARDS) if (spending + 0.5 >= d.standards[people(n)][s].net) best = s;
  return best;
}

/**
 * True where the state pension already covers the standard, so the pot needed
 * is nothing: two state pensions come to more than a two-person minimum
 * retirement asks for. The pipeline writes the gross income wanted on top of
 * the state pension, and writes zero when there is none.
 */
export function covered(d: PensionFile, n: number, standard: Standard): boolean {
  return d.standards[people(n)][standard].gross < 1;
}

export interface Month {
  date: string;
  pot: number;
}

/** The pot the standard would have needed at each month end, inflation-linked, at 66. */
export function history(d: PensionFile, n: number, standard: Standard): Month[] {
  const gross = d.standards[people(n)][standard].gross;
  return d.history.map(([date, r]) => ({ date, pot: potOf(gross, r) }));
}

/**
 * Where a price sits against every month since 2005, given a `history` and a
 * `price` in the same money.
 *
 * `since` names the last month on the far side of `price` from where the
 * series ends: every month after it was on this side, so it is the month the
 * price was last that dear, or last that cheap. Being below the final month
 * is not the same as being below all of them, which is the whole reason this
 * is a function with a test: the price fell to a low in November 2008 that
 * some dial settings sit above.
 */
export type Place = { at: "dearest" } | { at: "cheapest" } | { at: "since"; i: number; dearer: boolean };

export function place(months: Month[], price: number): Place {
  const pots = months.map((m) => m.pot);
  if (price > Math.max(...pots)) return { at: "dearest" };
  if (price < Math.min(...pots)) return { at: "cheapest" };
  const dearer = price > pots[pots.length - 1]!;
  for (let i = pots.length - 1; i >= 0; i--) {
    if (dearer ? pots[i]! >= price : pots[i]! <= price) return { at: "since", i, dearer };
  }
  throw new Error("a price inside the range has a month on the other side of it");
}

/** "1 point", "2.5 points": the dial reads in points of gilt yield. */
export function points(n: number): string {
  return `${n} ${n === 1 ? "point" : "points"}`;
}
