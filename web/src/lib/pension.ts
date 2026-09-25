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

/** The pot a household needs for a standard. Zero where the state pension already covers it. */
export function potFor(d: PensionFile, n: number, standard: Standard, age: number, kind: Kind, shift = 0): number {
  const gross = d.standards[people(n)][standard].gross;
  return gross < 1 ? 0 : gross / rate(d, kind, age, shift);
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

/** The pot the standard would have needed at each month end, inflation-linked, at 66. */
export function history(d: PensionFile, n: number, standard: Standard): { date: string; pot: number }[] {
  const gross = d.standards[people(n)][standard].gross;
  return d.history.map(([date, r]) => ({ date, pot: gross / r }));
}
