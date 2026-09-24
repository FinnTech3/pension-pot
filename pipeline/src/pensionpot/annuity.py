"""Price an annuity from first principles: the gilt curve and a life table.

An annuity promises £1 a year, paid monthly in advance, for as long as the
buyer lives. Its cost is the sum over every future month of

    (the chance the buyer is alive then) x (what £1 then costs today)

and the income a pot buys is the pot divided by that cost. That is all an
insurer's price is, before margins. Here the margins are one number, a spread
added to the gilt curve, which stands for everything that separates a
policyholder from a gilt holder: the extra yield the insurer earns on corporate
bonds, less its expenses, its capital and its profit, and the fact that people
who buy annuities live longer than the population the ONS table describes.

The spread is set once, against one published quote, and every other quote is
then predicted without touching it. The predictions are the check.
"""

from __future__ import annotations

from .curves import Curve
from .mortality import at, unisex

MONTHS = 12


def annuity_factor(curve: Curve, alive: list[float], spread: float,
                   guarantee_years: int = 0, second_life: list[float] | None = None,
                   survivor_share: float = 0.0) -> float:
    """Cost today of £1 a year, paid monthly in advance, for life.

    With a guarantee, payments in the first `guarantee_years` are made whether
    or not the buyer is alive. With a second life, `survivor_share` of the
    income continues to the survivor after the first death.
    """
    total = 0.0
    horizon = len(alive) if second_life is None else max(len(alive), len(second_life))
    for m in range(horizon * MONTHS):
        t = m / MONTHS
        p1 = at(alive, t)
        if t < guarantee_years:
            p1 = 1.0
        paid = p1
        if second_life is not None:
            p2 = at(second_life, t)
            paid = p1 + survivor_share * p2 * (1 - p1)
        if paid <= 0:
            continue
        total += paid * curve.discount(t, spread) / MONTHS
    return total


def income(pot: float, curve: Curve, age: int, year: int, spread: float, guarantee_years: int = 0,
           spouse_age: int | None = None, survivor_share: float = 0.5, mortality_scale: float = 1.0) -> float:
    alive = unisex(age, year, mortality_scale)
    spouse = unisex(spouse_age, year, mortality_scale) if spouse_age is not None else None
    factor = annuity_factor(curve, alive, spread, guarantee_years, spouse,
                            survivor_share if spouse is not None else 0.0)
    return pot / factor


def calibrate_spread(target_income: float, pot: float, curve: Curve, age: int, year: int,
                     lo: float = -3.0, hi: float = 5.0, steps: int = 60, **kw) -> float:
    """The spread at which the priced income equals a published quote.
    Income rises with the spread, so bisection finds it."""
    for _ in range(steps):
        mid = (lo + hi) / 2
        if income(pot, curve, age, year, mid, **kw) < target_income:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2
