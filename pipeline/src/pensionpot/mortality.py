"""How long a retiree can expect to be paid for: ONS projected mortality.

The ONS publishes, for every age and calendar year from 1981 to its projection
horizon, the probability that someone of that age dies within the year (qx),
for the UK, men and women separately, in its 2024-based principal projection.
Following one person along the diagonal (age 65 in 2026, 66 in 2027, ...) gives
their cohort's mortality, projected improvements included. The cohort sheets in
the same workbook only begin with people born in 1981, so the diagonal is how a
65-year-old in 2026 is followed.

Annuities are priced the same for men and women by law, so a unisex buyer is
represented as an equal mix of the two survival curves. Within a year of age,
deaths are spread evenly, which is how payments are valued monthly.
"""

from __future__ import annotations

import os
from functools import lru_cache

from .sheets import read_xlsx
from .sources import SOURCES


@lru_cache(maxsize=None)
def period_qx(sex: str) -> dict[tuple[int, int], float]:
    """(age, calendar year) -> probability of death within the year."""
    rows = read_xlsx(os.path.join(SOURCES, "ons_ukppp24qx.xlsx"))[f"{sex} period qx"]
    header = next(r for r in rows if r and r[0].startswith("Exact age"))
    years = [int(h.replace("Year", "").strip()) for h in header[1:] if h.strip()]
    out = {}
    for r in rows:
        if r and r[0].strip().isdigit():
            age = int(r[0])
            for y, v in zip(years, r[1:]):
                if v:
                    out[(age, y)] = float(v) / 100_000   # published per 100,000
    return out


def survival(sex: str, age: int, year: int, scale: float = 1.0) -> list[float]:
    """Probability of being alive at the start of each future year of age.

    Index 0 is 1.0 (alive now at `age`). `scale` multiplies every qx; the tests
    use it to hand the pricing a wrong table, and the report to show how much
    lighter annuitant mortality moves the answer.
    """
    qx = period_qx(sex)
    last_year = max(y for _, y in qx)
    alive, out = 1.0, [1.0]
    for t in range(0, 101 - age):
        q = qx.get((age + t, min(year + t, last_year)))
        if q is None:
            break
        alive *= 1 - min(1.0, q * scale)
        out.append(alive)
    return out


def at(curve: list[float], t: float) -> float:
    """Survival at fractional time t, deaths spread evenly within each year."""
    k = int(t)
    if k + 1 >= len(curve):
        return 0.0
    return curve[k] + (t - k) * (curve[k + 1] - curve[k])


def unisex(age: int, year: int, scale: float = 1.0) -> list[float]:
    m, f = survival("males", age, year, scale), survival("females", age, year, scale)
    n = max(len(m), len(f))
    m += [0.0] * (n - len(m))
    f += [0.0] * (n - len(f))
    return [(a + b) / 2 for a, b in zip(m, f)]
