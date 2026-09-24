"""Bank of England gilt curves: what the market charges to move money through time.

The Bank publishes a zero-coupon ("spot") curve fitted to gilt prices each day:
the nominal curve from conventional gilts, and the real curve from index-linked
gilts, whose payments rise with RPI. The yields are continuously compounded and
quoted as annual percentages, so the price today of £1 in t years is
exp(-y(t) t / 100).

A level annuity is a stream of fixed pounds, priced off the nominal curve. An
RPI-linked annuity is a stream of pounds that rise with RPI, priced off the real
curve. Nothing else about the market enters this project: every annuity price
here is these curves plus mortality plus one spread.

The spreadsheets put the maturities in a row that starts "years:" and the data
in rows keyed by Excel date serials, with blank cells where the Bank does not
publish a maturity (the real curve starts at 2.5 years). The reader keys on
those markers rather than on row numbers, because the daily and month-end files
lay their headers out differently.
"""

from __future__ import annotations

import datetime as dt
import math
import os
from dataclasses import dataclass

from .sheets import read_xlsx
from .sources import SOURCES

EXCEL_EPOCH = dt.date(1899, 12, 30)


def excel_date(serial: str) -> dt.date:
    return EXCEL_EPOCH + dt.timedelta(days=int(float(serial)))


@dataclass(frozen=True)
class Curve:
    date: dt.date
    maturities: tuple[float, ...]   # years
    yields: tuple[float, ...]       # continuously compounded, per cent a year

    def rate(self, t: float) -> float:
        """Spot yield at maturity t, linear between published points, flat outside."""
        m, y = self.maturities, self.yields
        if t <= m[0]:
            return y[0]
        if t >= m[-1]:
            return y[-1]
        lo, hi = 0, len(m) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if m[mid] <= t:
                lo = mid
            else:
                hi = mid
        w = (t - m[lo]) / (m[hi] - m[lo])
        return y[lo] + w * (y[hi] - y[lo])

    def discount(self, t: float, spread: float = 0.0) -> float:
        """Price today of £1 in t years, with `spread` (per cent) added to the yield."""
        return math.exp(-(self.rate(t) + spread) * t / 100)


def load_curves(filename: str, sheet: str = "4. spot curve") -> dict[dt.date, Curve]:
    rows = read_xlsx(os.path.join(SOURCES, filename))[sheet]
    header = next(r for r in rows if r and r[0].strip().lower() == "years:")
    curves = {}
    for r in rows:
        if not r or not r[0].replace(".", "").isdigit():
            continue
        pairs = [(float(header[i]), float(v)) for i, v in enumerate(r[1:], 1)
                 if i < len(header) and header[i] and v not in ("", "#VALUE!")]
        if pairs:
            m, y = zip(*pairs)
            day = excel_date(r[0])
            curves[day] = Curve(day, tuple(m), tuple(y))
    return curves
