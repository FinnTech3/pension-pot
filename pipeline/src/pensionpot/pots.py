"""What pot each Retirement Living Standard needs, and what it used to need.

The Retirement Living Standards (Pensions UK, formerly the PLSA, with
Loughborough University; updated 3 June 2026) are yearly spending, after tax
and excluding housing, for a minimum, moderate or comfortable retirement, for
one person or two. This turns each into a pot:

  1. the state pension pays £12,548 a year each (the full new state pension,
     2026-27);
  2. income tax falls on the state pension and the annuity together, at
     2026-27 rates in England, Wales and Northern Ireland, each person with
     their own allowance;
  3. the gross annuity income needed is whatever brings net income up to the
     standard, found by bisection because tax makes it non-linear;
  4. the pot is that income divided by the annuity rate, priced as in
     annuity.py with the spread and mortality set against real quotes.

A couple is two people of the same age, each with a full state pension and
their own RPI-linked annuity buying half the couple's standard. When one dies
the other keeps their own annuity and state pension, which is less than the
one-person standard at the same level; the tool says so.

The central case buys an RPI-linked annuity, because the standards are real
spending and a level annuity loses a third of its value in twenty years of 2%
inflation. The level-annuity pot is reported beside it, smaller and less safe.

For the history, everything except the gilt curve is held at today's values:
the same retiree, the same standard, today's tax and state pension, today's
insurer margins. Only the price of turning a pot into an income moves, which
is the point. Insurers' margins in earlier years were surely not the same as
today's, and I could not find a citable record of what they quoted in 2021 to
check against, so the history is what gilt yields alone did to the price.
"""

from __future__ import annotations

import datetime as dt
import functools
from dataclasses import dataclass

from . import annuity
from .curves import Curve, load_curves

STATE_PENSION = 12_548.0          # full new state pension, 2026-27, a year
PERSONAL_ALLOWANCE = 12_570.0     # frozen to April 2031
BASIC_RATE_LIMIT = 50_270.0
ADDITIONAL_RATE_THRESHOLD = 125_140.0

# Retirement Living Standards, June 2026: yearly spending after tax, excluding housing
STANDARDS = {
    1: {"minimum": 13_900.0, "moderate": 32_700.0, "comfortable": 45_400.0},
    2: {"minimum": 22_500.0, "moderate": 45_400.0, "comfortable": 62_700.0},
}
STANDARDS_ONE_PERSON = STANDARDS[1]
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


def gross_for(net_target: float, people: int = 1) -> float:
    """Annuity income before tax a household needs: each person buys their share."""
    return people * gross_needed(net_target / people)


def pots_today(nominal: Curve, real: Curve, mortality_scale: float, spread: float,
               age: int = RETIREMENT_AGE, people: int = 1) -> list[Pot]:
    year = nominal.date.year
    rpi = annuity.income(1.0, real, age, year, spread, mortality_scale=mortality_scale)
    level = annuity.income(1.0, nominal, age, year, spread, mortality_scale=mortality_scale)
    return [Pot(name, net, gross_for(net, people), rpi, level) for name, net in STANDARDS[people].items()]


@functools.lru_cache(maxsize=None)
def history_curves() -> dict[dt.date, Curve]:
    """The Bank's real spot curve at every month end it publishes."""
    curves: dict[dt.date, Curve] = {}
    for f in HISTORY_FILES:
        curves.update(load_curves(f))
    return curves


def history(gross_annuity: float, mortality_scale: float, spread: float, since: int = 2005,
            age: int = RETIREMENT_AGE) -> list[tuple[dt.date, float, float]]:
    """(month end, RPI-linked annuity rate, pot needed) for every month since `since`.

    Months where the Bank's real curve does not span 5 to 20 years are skipped
    rather than extrapolated.
    """
    curves = history_curves()
    out = []
    for day in sorted(curves):
        c = curves[day]
        if day.year < since or c.maturities[0] > 5 or c.maturities[-1] < 20:
            continue
        rate = annuity.income(1.0, c, age, day.year, spread, mortality_scale=mortality_scale)
        out.append((day, rate, gross_annuity / rate))
    return out
