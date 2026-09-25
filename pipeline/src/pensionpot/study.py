"""Run everything once and return every number the write-up, figures and app use.

report.py prints from this, scripts/make_figures.py draws from it and build.py
writes the app's data from it, so a number cannot mean one thing in the README
and another in a chart.
"""

from __future__ import annotations

import functools

from . import annuity, pots, verify
from .curves import Curve

AGES = list(range(65, 76))                      # the ages the quote check covers
SHIFTS = [x / 4 for x in range(-12, 9)]         # real and nominal yields moved by -3 to +2 points


def shifted(c: Curve, points: float) -> Curve:
    return Curve(c.date, c.maturities, tuple(y + points for y in c.yields))


@functools.lru_cache(maxsize=None)
def run() -> dict:
    check = verify.check_quotes()
    k, s = check.detail["mortality_scale"], check.detail["spread"]
    nominal, real = verify.market_curves()
    year = nominal.date.year

    today = {people: pots.pots_today(nominal, real, k, s, people=people) for people in (1, 2)}

    # the price of an income at every age and yield shift, for the app
    grid = {}
    for kind, curve in (("rpi", real), ("level", nominal)):
        for age in AGES:
            grid[(kind, age)] = [annuity.income(1.0, shifted(curve, d), age, year, s, mortality_scale=k)
                                 for d in SHIFTS]

    # history: the RPI-linked rate at 66 at every month end since 2005
    hist = pots.history(1.0, k, s)
    comfortable = pots.gross_for(pots.STANDARDS[1]["comfortable"])
    moderate = pots.gross_for(pots.STANDARDS[1]["moderate"])
    series = [(day, rate) for day, rate, _ in hist]
    peak_day, peak_rate = min(series, key=lambda x: x[1])
    last_day, last_rate = series[-1]

    curves = pots.history_curves()
    real20 = [(day, c.rate(20.0)) for day, c in sorted(curves.items()) if day.year >= 2005 and c.maturities[-1] >= 20]

    return {
        "check": check,
        "mortality_scale": k,
        "spread": s,
        "quote_date": verify.QUOTE_DATE,
        "rate_rpi_66": annuity.income(1.0, real, 66, year, s, mortality_scale=k),
        "rate_level_66": annuity.income(1.0, nominal, 66, year, s, mortality_scale=k),
        "today": today,
        "grid": grid,
        "history": series,
        "gross_comfortable": comfortable,
        "gross_moderate": moderate,
        "peak": (peak_day, peak_rate),
        "last": (last_day, last_rate),
        "real20": real20,
    }
