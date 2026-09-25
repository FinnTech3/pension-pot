import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type PensionFile, history, incomeTax, potFor, rate, reached, spendingFrom } from "./pension";

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
