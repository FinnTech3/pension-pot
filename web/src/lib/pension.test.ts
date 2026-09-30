import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type PensionFile, history, incomeTax, place, points, potFor, rate, reached, spendingFrom } from "./pension";

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
