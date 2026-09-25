"""The app's data must say what the report says."""

from __future__ import annotations

from pensionpot import build, pots, study


def test_the_grid_at_66_with_no_shift_is_todays_price():
    p = build.payload()
    r = study.run()
    i, j = p["ages"].index(66), p["shifts"].index(0.0)
    assert p["rates"]["rpi"][i][j] == r["rate_rpi_66"]
    assert p["rates"]["level"][i][j] == r["rate_level_66"]


def test_higher_yields_always_buy_more_income():
    p = build.payload()
    for kind in ("rpi", "level"):
        for row in p["rates"][kind]:
            assert all(a < b for a, b in zip(row, row[1:]))


def test_the_standards_are_the_june_2026_figures_with_their_gross_incomes():
    p = build.payload()
    assert p["standards"]["1"]["comfortable"]["net"] == 45_400
    assert p["standards"]["2"]["minimum"]["gross"] < 1
    assert p["standards"]["1"]["moderate"]["gross"] == pots.gross_for(32_700)
