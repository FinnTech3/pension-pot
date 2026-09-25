"""The annuity pricing against real quotes, and twins proving the check can fail."""

from __future__ import annotations

import datetime as dt
import math

from pensionpot import annuity, curves, mortality, verify


def test_published_quotes_are_priced_out_of_sample_within_three_per_cent():
    r = verify.check_quotes()
    assert r.passed, r.summary
    assert len(r.detail["rows"]) == 30
    assert r.detail["gated"] == 16 and r.detail["within"] == 16   # 18 at 65 and over, 2 of them tuned


def test_below_65_the_model_is_too_generous_as_the_readme_states():
    # a known deviation, not a match: at 55 and 60 every quote is priced high,
    # by up to about four per cent; this pins its direction and size
    gaps = verify.check_quotes().detail["young_gaps"]
    assert len(gaps) == 12
    assert all(0 < g < 0.05 for g in gaps)


def test_twin_population_mortality_cannot_price_every_age():
    # the ONS population, not annuity buyers: the age-75 quote is missed
    assert not verify.check_quotes(fix_mortality=1.0).passed


def test_twin_the_nominal_curve_cannot_price_an_rpi_annuity():
    assert not verify.check_quotes(real_for_rpi=False).passed


def test_a_certain_annuity_matches_its_closed_form():
    # £1 a year monthly in advance for exactly 10 years at a flat 5%: sum of discount factors
    flat = curves.Curve(dt.date(2026, 1, 1), (0.5, 40.0), (5.0, 5.0))
    certain = [1.0] * 11   # alive at the start of years 0 to 10; payments stop at 10
    got = annuity.annuity_factor(flat, certain, 0.0)
    want = sum(math.exp(-0.05 * m / 12) for m in range(120)) / 12
    assert abs(got - want) < 1e-9


def test_survival_starts_at_one_and_only_falls():
    s = mortality.unisex(65, 2026)
    assert s[0] == 1.0 and all(a >= b for a, b in zip(s, s[1:]))


def test_mortality_is_read_per_hundred_thousand():
    # UK male qx at 65 in 2026 is around one per cent, not a thousand per cent
    q = mortality.period_qx("males")[(65, 2026)]
    assert 0.005 < q < 0.02
