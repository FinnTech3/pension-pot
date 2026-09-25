"""Price the annuities insurers were actually quoting, before pricing anything else.

On 17 September 2026 Hargreaves Lansdown's best-buy table showed 30 quotes for
a £100,000 pot, paid monthly in advance: six products (single life level, with
and without a five-year guarantee; RPI-linked and 3% escalating, each with a
five-year guarantee; joint life with half to a spouse three years younger,
level and 3% escalating) at ages 55, 60, 65, 70 and 75.

Two numbers are set from two of them. The level quotes at 65 and 75 fix the
spread over the gilt curve and how much lighter annuity buyers' mortality is
than the ONS population's. The other 28 are then priced without touching
either number.

The gate is the ages this project prices, 65 and over: every one of those
quotes has to land within three per cent. The quotes at 55 and 60 are priced
and reported too, and they fail that test in one direction, the model offering
three to four per cent more income than insurers do. That is a known deviation,
stated in the README and pinned by a test, not a hidden one. Nothing in the
analysis prices an annuity below 65.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

from . import annuity
from .curves import Curve, load_curves
from .sources import load_quotes

QUOTE_DATE = dt.date(2026, 9, 17)
POT = 100_000.0
TOLERANCE = 0.03
GATE_AGE = 65          # the youngest age the analysis prices


@dataclass
class Result:
    name: str
    passed: bool
    summary: str
    detail: dict = field(default_factory=dict)


def market_curves() -> tuple[Curve, Curve]:
    return (load_curves("boe_glc_nominal_daily_2026_09.xlsx")[QUOTE_DATE],
            load_curves("boe_glc_real_daily_2026_09.xlsx")[QUOTE_DATE])


def _find(quotes, product, age):
    return next(q for q in quotes if q["product"] == product and q["age"] == age)


def fit(nominal: Curve, quotes: list[dict], fix_mortality: float | None = None) -> tuple[float, float]:
    """(mortality scale, spread) reproducing the level quotes at 65 and 75.

    With `fix_mortality`, only the spread is fitted, to the 65 quote alone.
    """
    q65 = _find(quotes, "single life level", 65)["income"]
    if fix_mortality is not None:
        return fix_mortality, annuity.calibrate_spread(q65, POT, nominal, 65, QUOTE_DATE.year,
                                                       mortality_scale=fix_mortality)
    q75 = _find(quotes, "single life level", 75)["income"]
    lo, hi = 0.2, 1.5
    for _ in range(40):
        k = (lo + hi) / 2
        s = annuity.calibrate_spread(q65, POT, nominal, 65, QUOTE_DATE.year, mortality_scale=k)
        if annuity.income(POT, nominal, 75, QUOTE_DATE.year, s, mortality_scale=k) > q75:
            hi = k
        else:
            lo = k
    k = (lo + hi) / 2
    return k, annuity.calibrate_spread(q65, POT, nominal, 65, QUOTE_DATE.year, mortality_scale=k)


def price_quote(q: dict, nominal: Curve, real: Curve, k: float, s: float,
                real_for_rpi: bool = True) -> float:
    curve = real if (q["escalation"] == "rpi" and real_for_rpi) else nominal
    kw = {"guarantee_years": q["guarantee"], "mortality_scale": k}
    if q["escalation"].endswith("%"):
        kw["escalation"] = float(q["escalation"][:-1]) / 100
    if q["spouse_age"] is not None:
        kw.update(spouse_age=q["spouse_age"], survivor_share=0.5)
    return annuity.income(POT, curve, q["age"], QUOTE_DATE.year, s, **kw)


def check_quotes(fix_mortality: float | None = None, real_for_rpi: bool = True) -> Result:
    nominal, real = market_curves()
    quotes = load_quotes()
    k, s = fit(nominal, quotes, fix_mortality)
    tuned = {("single life level", 65)} | ({("single life level", 75)} if fix_mortality is None else set())
    rows = []
    for q in quotes:
        key = (q["product"], q["age"])
        priced = price_quote(q, nominal, real, k, s, real_for_rpi)
        rows.append({"product": q["product"], "age": q["age"], "quoted": q["income"],
                     "priced": priced, "gap": priced / q["income"] - 1, "tuned": key in tuned})
    gated = [r for r in rows if not r["tuned"] and r["age"] >= GATE_AGE]
    young = [r for r in rows if not r["tuned"] and r["age"] < GATE_AGE]
    worst = max(abs(r["gap"]) for r in gated)
    within = sum(1 for r in gated if abs(r["gap"]) <= TOLERANCE)
    return Result(
        "annuity quotes",
        worst <= TOLERANCE,
        f"mortality at {k:.0%} of the ONS population's, spread {s:+.2f}% over gilts; "
        f"{within} of {len(gated)} quotes at {GATE_AGE} and over priced out of sample within "
        f"{TOLERANCE:.0%}, worst gap {worst:.1%}; at 55 and 60 the model's income is "
        f"{min(r['gap'] for r in young):+.1%} to {max(r['gap'] for r in young):+.1%} against the quotes",
        {"mortality_scale": k, "spread": s, "rows": rows, "worst": worst,
         "gated": len(gated), "within": within,
         "young_gaps": [r["gap"] for r in young]},
    )
