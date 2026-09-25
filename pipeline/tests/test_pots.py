"""Tax, the gross-up and the pots, on hand cases and on the real run."""

from __future__ import annotations

import functools

import pytest

from pensionpot import pots, verify


def test_income_tax_at_2026_27_rates():
    assert pots.income_tax(12_570) == 0
    assert pots.income_tax(20_000) == pytest.approx((20_000 - 12_570) * 0.2)
    assert pots.income_tax(60_000) == pytest.approx(37_700 * 0.2 + (60_000 - 50_270) * 0.4)


def test_gross_up_nets_exactly_the_target():
    for target in (13_900, 32_700, 45_400):
        g = pots.gross_needed(target)
        total = g + pots.STATE_PENSION
        assert total - pots.income_tax(total) == pytest.approx(target, abs=0.01)


def test_the_minimum_needs_only_a_small_annuity_taxed_above_the_allowance():
    # £12,548 state pension plus g, taxed at 20% above £12,570, nets £13,900:
    # 0.8 (12,548 + g) + 0.2 x 12,570 = 13,900, so g = 1,684.50
    assert pots.gross_needed(13_900) == pytest.approx(1_684.50, abs=0.01)


def test_a_couple_buys_two_halves_each_with_their_own_allowance():
    # £62,700 for two is £31,350 each: 0.8 (12,548 + g) + 0.2 x 12,570 = 31,350
    each = (31_350 - 0.2 * 12_570) / 0.8 - 12_548
    assert pots.gross_for(62_700, people=2) == pytest.approx(2 * each, abs=0.02)


@functools.lru_cache(maxsize=None)
def fitted():
    r = verify.check_quotes()
    return r.detail["mortality_scale"], r.detail["spread"]


def test_an_inflation_linked_pot_costs_more_than_a_level_one():
    nominal, real = verify.market_curves()
    k, s = fitted()
    for p in pots.pots_today(nominal, real, k, s):
        assert p.pot_rpi > p.pot_level


def test_history_holds_everything_but_the_curve():
    k, s = fitted()
    h = pots.history(10_000.0, k, s, since=2020)
    # a lower annuity rate must always mean a bigger pot for the same income
    ordered = sorted(h, key=lambda x: x[1])
    assert all(a[2] >= b[2] for a, b in zip(ordered, ordered[1:]))
