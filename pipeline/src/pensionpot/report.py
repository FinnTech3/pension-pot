"""Print every number the README quotes, in the order it quotes them.

    PYTHONPATH=pipeline/src python3 -m pensionpot.report

Refuses to print findings if the pricing check has failed.
"""

from __future__ import annotations

import sys

from . import pots
from .study import run


def money(x: float) -> str:
    return f"£{x:,.0f}"


def main() -> int:
    r = run()
    c = r["check"]
    print("Verification")
    print(f"  [{'pass' if c.passed else 'FAIL'}] {c.name}: {c.summary}")
    if not c.passed:
        print("\nThe check failed; nothing below would mean anything.", file=sys.stderr)
        return 1
    print(f"  {'product':<45} age   quoted   priced     gap")
    for row in c.detail["rows"]:
        print(f"  {row['product']:<45} {row['age']:>3}  {money(row['quoted']):>7}  {money(row['priced']):>7}  "
              f"{row['gap']:+6.1%}{'  tuned' if row['tuned'] else ''}")

    print(f"\nAnnuity rates at 66 on {r['quote_date']:%d %B %Y}, at the fitted margins: "
          f"RPI-linked {r['rate_rpi_66']:.2%}, level {r['rate_level_66']:.2%}")
    print(f"State pension {money(pots.STATE_PENSION)} a year each; tax at 2026-27 rates, rest of UK")

    for people, label in ((1, "One person"), (2, "Two people")):
        print(f"\n{label} retiring at 66: the pot each standard needs today")
        for p in r["today"][people]:
            if p.gross_annuity < 1:
                print(f"  {p.standard:<12} {money(p.net_income):>8} a year: the state pension covers it, no pot needed")
            else:
                print(f"  {p.standard:<12} {money(p.net_income):>8} a year: annuity income {money(p.gross_annuity)} "
                      f"before tax; pot {money(p.pot_rpi)} inflation-linked, {money(p.pot_level)} level")

    (pd, pr), (ld, lr) = r["peak"], r["last"]
    print("\nThe price of a comfortable retirement, one person at 66, RPI-linked, at today's margins")
    print(f"  most expensive month: {pd:%B %Y}, rate {pr:.2%}, pot {money(r['gross_comfortable'] / pr)}")
    print(f"  latest month end: {ld:%B %Y}, rate {lr:.2%}, pot {money(r['gross_comfortable'] / lr)}")
    print(f"  ratio {pr / lr:.3f}; moderate: {money(r['gross_moderate'] / pr)} then, {money(r['gross_moderate'] / lr)} now")
    first = r["history"][0]
    print(f"  {first[0]:%B %Y}: pot {money(r['gross_comfortable'] / first[1])}")
    low = min(r["real20"], key=lambda x: x[1])
    print(f"  real 20-year gilt yield: {low[1]:+.2f}% in {low[0]:%B %Y}, {r['real20'][-1][1]:+.2f}% in "
          f"{r['real20'][-1][0]:%B %Y}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
