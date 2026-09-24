"""What pot each PLSA Retirement Living Standard needs, and what it used to need.

The PLSA's standards are net incomes, after tax and excluding housing: what a
one-person household outside London needs a year for a minimum, moderate or
comfortable retirement. This turns each into a pot:

  1. the state pension pays £12,548 a year (the full new state pension,
     2026-27);
  2. income tax falls on the state pension and the annuity together, at
     2026-27 rates in England, Wales and Northern Ireland;
  3. the gross annuity income needed is whatever brings net income up to the
     standard, found by bisection because tax makes it non-linear;
  4. the pot is that income divided by the annuity rate, priced as in
     annuity.py with the spread and mortality set against real quotes.

The central case buys an RPI-linked annuity, because the standards are real
incomes and a level annuity loses a third of its value in twenty years of 2%
inflation. The level-annuity pot is reported beside it, smaller and less safe.

For the history, everything except the gilt curve is held at today's values:
the same retiree, the same standard, today's tax and state pension, today's
insurer margins. Only the price of turning a pot into an income moves, which
is the point. Holding margins at today's level flatters the past: at 2026
margins the model prices late-2021 level annuities more generously than
insurers were quoting, so the 2021 pots here are if anything too small.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from . import annuity
from .curves import Curve, load_curves

STATE_PENSION = 12_548.0          # full new state pension, 2026-27, a year
PERSONAL_ALLOWANCE = 12_570.0     # frozen to April 2031
BASIC_RATE_LIMIT = 50_270.0
ADDITIONAL_RATE_THRESHOLD = 125_140.0

STANDARDS_ONE_PERSON = {"minimum": 13_400.0, "moderate": 31_700.0, "comfortable": 43_900.0}
RETIREMENT_AGE = 66

HISTORY_FILES = [
    "boe_glc_real_month_end_1979_to_2015.xlsx",
    "boe_glc_real_month_end_2016_to_2024.xlsx",
    "boe_glc_real_month_end_2025_to_present.xlsx",
]


def income_tax(income: float) -> float:
    """2026-27 income tax on a pensioner's income, rest of UK.

    The personal allowance tapers away above £100,000; no standard comes near
    that, so the taper is left out and the tests keep incomes below it.
    """
    basic = max(0.0, min(income, BASIC_RATE_LIMIT) - PERSONAL_ALLOWANCE) * 0.20
    higher = max(0.0, min(income, ADDITIONAL_RATE_THRESHOLD) - BASIC_RATE_LIMIT) * 0.40
    return basic + higher


def gross_needed(net_target: float, state_pension: float = STATE_PENSION) -> float:
    """Annuity income before tax that, with the state pension, nets the target."""
    lo, hi = 0.0, 250_000.0
    for _ in range(100):
        g = (lo + hi) / 2
        total = g + state_pension
        if total - income_tax(total) < net_target:
            lo = g
        else:
            hi = g
    return (lo + hi) / 2


@dataclass(frozen=True)
class Pot:
    standard: str
    net_income: float
    gross_annuity: float
    rate_rpi: float
    rate_level: float

    @property
    def pot_rpi(self) -> float:
        return self.gross_annuity / self.rate_rpi

    @property
    def pot_level(self) -> float:
        return self.gross_annuity / self.rate_level


def pots_today(nominal: Curve, real: Curve, mortality_scale: float, spread: float,
               age: int = RETIREMENT_AGE) -> list[Pot]:
    year = nominal.date.year
    rpi = annuity.income(1.0, real, age, year, spread, mortality_scale=mortality_scale)
    level = annuity.income(1.0, nominal, age, year, spread, mortality_scale=mortality_scale)
    return [Pot(name, net, gross_needed(net), rpi, level) for name, net in STANDARDS_ONE_PERSON.items()]


def history(gross_annuity: float, mortality_scale: float, spread: float, since: int = 2005,
            age: int = RETIREMENT_AGE) -> list[tuple[dt.date, float, float]]:
    """(month end, RPI-linked annuity rate, pot needed) for every month since `since`.

    Months where the Bank's real curve does not span 5 to 20 years are skipped
    rather than extrapolated.
    """
    curves: dict[dt.date, Curve] = {}
    for f in HISTORY_FILES:
        curves.update(load_curves(f))
    out = []
    for day in sorted(curves):
        c = curves[day]
        if day.year < since or c.maturities[0] > 5 or c.maturities[-1] < 20:
            continue
        rate = annuity.income(1.0, c, age, day.year, spread, mortality_scale=mortality_scale)
        out.append((day, rate, gross_annuity / rate))
    return out
