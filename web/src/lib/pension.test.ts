import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MAX_POT,
  type PensionFile,
  covered,
  history,
  incomeTax,
  place,
  points,
  potFor,
  rate,
  readPot,
  reached,
  spendingFrom,
} from "./pension";

const d = JSON.parse(readFileSync("public/data/pension.json", "utf8")) as PensionFile;

describe("tax", () => {
  it("nets exactly what the pipeline nets", () => {
    for (const [gross, net] of d.tax.examples) {
      const total = gross + d.tax.state_pension;
      expect(total - incomeTax(d, total)).toBeCloseTo(net, 6);
    }
  });
});

describe("pots", () => {
  it("says what the README says, one person at 66, inflation-linked", () => {
    expect(Math.round(potFor(d, 1, "comfortable", 66, "rpi"))).toBe(730_107);
    expect(Math.round(potFor(d, 1, "moderate", 66, "rpi"))).toBe(436_009);
    expect(Math.round(potFor(d, 1, "minimum", 66, "rpi"))).toBe(29_163);
    expect(Math.round(potFor(d, 2, "comfortable", 66, "rpi"))).toBe(813_588);
    expect(potFor(d, 2, "minimum", 66, "rpi")).toBe(0);
  });

  it("buys back exactly the standard it was sized for", () => {
    for (const n of [1, 2])
      for (const s of ["moderate", "comfortable"] as const) {
        const pot = potFor(d, n, s, 66, "rpi");
        expect(spendingFrom(d, n, pot, 66, "rpi")).toBeCloseTo(d.standards[n === 2 ? "2" : "1"][s].net, 2);
        expect(reached(d, n, spendingFrom(d, n, pot, 66, "rpi"))).toBe(s);
      }
  });

  it("costs less when gilt yields are higher, and less at older ages", () => {
    expect(potFor(d, 1, "moderate", 66, "rpi", 1)).toBeLessThan(potFor(d, 1, "moderate", 66, "rpi", 0));
    expect(rate(d, "rpi", 75)).toBeGreaterThan(rate(d, "rpi", 65));
  });

  it("peaked in November 2021", () => {
    const h = history(d, 1, "comfortable");
    const peak = h.reduce((a, b) => (b.pot > a.pot ? b : a));
    expect(peak.date.slice(0, 7)).toBe("2021-11");
    expect(Math.round(peak.pot)).toBe(1_399_473);
  });

  it("passes the pricing check", () => {
    expect(d.check.passed).toBe(true);
    expect(d.check.rows).toHaveLength(30);
  });
});

describe("the dial's reading of the ridge", () => {
  const KINDS = ["rpi", "level"] as const;
  const PAIRS: [number, "minimum" | "moderate" | "comfortable"][] = [
    [1, "minimum"],
    [1, "moderate"],
    [1, "comfortable"],
    [2, "moderate"],
    [2, "comfortable"],
  ];

  it("only calls a price a record when it is one", () => {
    let seen = 0;
    for (const [n, standard] of PAIRS) {
      const months = history(d, n, standard);
      const pots = months.map((m) => m.pot);
      const lo = Math.min(...pots);
      const hi = Math.max(...pots);
      for (const kind of KINDS)
        for (const age of d.ages)
          for (const shift of d.shifts) {
            const price = potFor(d, n, standard, age, kind, shift);
            const where = place(months, price);
            if (where.at === "cheapest") expect(price).toBeLessThan(lo);
            if (where.at === "dearest") expect(price).toBeGreaterThan(hi);
            seen++;
          }
    }
    expect(seen).toBe(5 * 2 * d.ages.length * d.shifts.length);
  });

  it("names a month the price was last that dear or that cheap, with none since", () => {
    for (const [n, standard] of PAIRS) {
      const months = history(d, n, standard);
      for (const kind of KINDS)
        for (const age of d.ages)
          for (const shift of d.shifts) {
            const price = potFor(d, n, standard, age, kind, shift);
            const where = place(months, price);
            if (where.at !== "since") continue;
            // the named month is on the far side of the price
            if (where.dearer) expect(months[where.i]!.pot).toBeGreaterThanOrEqual(price);
            else expect(months[where.i]!.pot).toBeLessThanOrEqual(price);
            // and every month after it is on this side, so it really is the last
            for (const m of months.slice(where.i + 1)) {
              if (where.dearer) expect(m.pot).toBeLessThan(price);
              else expect(m.pot).toBeGreaterThan(price);
            }
          }
    }
  });

  it("puts the first notch up from today above November 2008, not below it", () => {
    // the price fell further in November 2008 than it has since, so a price
    // under the latest month is not a price under every month
    const months = history(d, 1, "moderate");
    const low = months.reduce((a, b) => (b.pot < a.pot ? b : a));
    expect(low.date.slice(0, 7)).toBe("2008-11");
    const price = potFor(d, 1, "moderate", 66, "rpi", 0.25);
    expect(price).toBeLessThan(months[months.length - 1]!.pot);
    expect(price).toBeGreaterThan(low.pot);
    expect(place(months, price)).toEqual({ at: "since", i: months.indexOf(low), dearer: false });
  });

  it("counts one point as a point", () => {
    expect(points(1)).toBe("1 point");
    expect(points(0.25)).toBe("0.25 points");
    expect(points(-3)).toBe("-3 points");
  });
});

describe("the retirement the state pension already buys", () => {
  // Two state pensions come to more than a two-person minimum retirement asks
  // for, so its price is nothing, and has been at every month since 2005. The
  // ridge used to draw that as a line along zero and read the peak against it,
  // which is how the page offered "Infinity% more than now".
  it("is the two-person minimum, and nothing else, at a pound rather than at zero", () => {
    // the pipeline's solve leaves a residue where the state pension covers the
    // standard outright, so the rule cannot be an equality with zero
    expect(d.standards["2"].minimum.gross).toBeGreaterThan(0);
    expect(d.standards["2"].minimum.gross).toBeLessThan(1);
    const all: [number, "minimum" | "moderate" | "comfortable"][] = [];
    for (const n of [1, 2]) for (const s of ["minimum", "moderate", "comfortable"] as const) all.push([n, s]);
    expect(all.filter(([n, s]) => covered(d, n, s))).toEqual([[2, "minimum"]]);
  });

  it("costs nothing at every month and every setting, and everything else costs something", () => {
    for (const n of [1, 2])
      for (const s of ["minimum", "moderate", "comfortable"] as const) {
        const zero = covered(d, n, s);
        for (const m of history(d, n, s)) expect(m.pot === 0).toBe(zero);
        for (const kind of ["rpi", "level"] as const)
          for (const age of d.ages)
            for (const shift of d.shifts) {
              const pot = potFor(d, n, s, age, kind, shift);
              expect(Number.isFinite(pot)).toBe(true);
              expect(pot === 0).toBe(zero);
            }
      }
  });

  it("leaves the couple covered by the state pension alone, with room to spare", () => {
    const fromState = spendingFrom(d, 2, 0, 66, "rpi");
    expect(fromState).toBeGreaterThan(d.standards["2"].minimum.net);
    expect(Math.round(fromState)).toBe(25_096);
    // and one state pension does not cover one person's minimum
    expect(spendingFrom(d, 1, 0, 66, "rpi")).toBeLessThan(d.standards["1"].minimum.net);
  });

  it("never asks how much dearer the peak was than nothing", () => {
    // the readout prints (peak / now - 1); it is only reached where now > 0
    for (const n of [1, 2])
      for (const s of ["minimum", "moderate", "comfortable"] as const) {
        if (covered(d, n, s)) continue;
        const now = potFor(d, n, s, 66, "rpi");
        const peak = history(d, n, s).reduce((a, b) => (b.pot > a.pot ? b : a));
        expect(Number.isFinite(peak.pot / now - 1)).toBe(true);
      }
  });
});

describe("what a reader types in the pot box", () => {
  it("reads money however it is written", () => {
    expect(readPot("250000")).toBe(250_000);
    expect(readPot("£250,000")).toBe(250_000);
    expect(readPot("  250000  ")).toBe(250_000);
    expect(readPot("1000.50")).toBe(1000.5);
  });

  it("gives nothing back for what is not a figure", () => {
    for (const t of ["", " ", "abc", ".", "-", "0", "-500", "1.2.3", "<script>alert(1)</script>"])
      expect(readPot(t)).toBeNull();
  });

  it("never returns a pot that buys an income of infinity", () => {
    // four hundred nines parse to Infinity, and £Infinity bought £∞ a year
    expect(Number("9".repeat(400))).toBe(Number.POSITIVE_INFINITY);
    expect(readPot("9".repeat(400))).toBe(MAX_POT);
    // and does not turn a number it cannot read into a small one
    expect(readPot(String(Number.MAX_VALUE))).toBeNull();
    expect(readPot("1e309")).toBeNull();
    for (const t of ["9".repeat(400), String(MAX_POT * 10)]) {
      const pot = readPot(t)!;
      expect(Number.isFinite(spendingFrom(d, 1, pot, 66, "rpi"))).toBe(true);
      expect(Number.isFinite(spendingFrom(d, 2, pot, 66, "rpi"))).toBe(true);
    }
  });
});
