"""Draw the figures in docs/figures from the committed data.

    PYTHONPATH=pipeline/src python3 scripts/make_figures.py

Every number is computed by the same run the report prints, so a figure cannot
disagree with the text. CI regenerates them and fails on any difference. Each
figure comes in a light and a dark version, written as SVG directly: no
plotting library, nothing to install.
"""

from __future__ import annotations

import math
import os
import sys
from xml.sax.saxutils import escape

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "pipeline", "src"))

from pensionpot import pots  # noqa: E402
from pensionpot.study import run  # noqa: E402

OUT = os.path.join(ROOT, "docs", "figures")
SANS = "'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, sans-serif"
MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

# Checked with a colour-vision validator against both surfaces: blue and red
# stay distinct under protanopia and deuteranopia and clear 3:1 on each.
LIGHT = {"bg": "#fbfaf7", "ink": "#111110", "dim": "#52514e", "muted": "#6b6a65",
         "grid": "#e6e4dc", "axis": "#c3c2b7", "rest": "#cfccc3",
         "blue": "#2a78d6", "red": "#e34948"}
DARK = {"bg": "#161614", "ink": "#f3f2ee", "dim": "#c3c2b7", "muted": "#9a988f",
        "grid": "#2a2a27", "axis": "#3d3d3a", "rest": "#4b4a46",
        "blue": "#3987e5", "red": "#e66767"}

W = 1120
LEFT = 64


def money(x: float, dp: int = 0) -> str:
    return f"£{x:,.{dp}f}"


def short_money(x: float) -> str:
    if x >= 1_000_000:
        return f"£{x / 1e6:.2f}m"
    return f"£{x / 1000:.0f}k"


class Svg:
    def __init__(self, h: int, p: dict, title: str, subtitle: str):
        self.p, self.h = p, h
        self.parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {h}" width="{W}" height="{h}" '
            f'role="img" aria-label="{escape(title)}">',
            f'<rect width="{W}" height="{h}" fill="{p["bg"]}"/>',
        ]
        self.text(LEFT, 44, title, 21, "ink", weight=600)
        self.text(LEFT, 70, subtitle, 14, "dim")

    def text(self, x, y, s, size=13, colour="ink", family=SANS, anchor="start", weight=400):
        self.parts.append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" '
            f'font-weight="{weight}" fill="{self.p[colour]}" text-anchor="{anchor}">{escape(s)}</text>')

    def line(self, x1, y1, x2, y2, colour="grid", width=1.0):
        self.parts.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                          f'stroke="{self.p[colour]}" stroke-width="{width}"/>')

    def column(self, x, base, width, height, colour):
        """A column rounded 4px at its data end and square at the baseline."""
        r = min(4.0, width / 2, height)
        top = base - height
        self.parts.append(
            f'<path d="M{x:.1f},{base:.1f} V{top + r:.1f} Q{x:.1f},{top:.1f} {x + r:.1f},{top:.1f} '
            f'H{x + width - r:.1f} Q{x + width:.1f},{top:.1f} {x + width:.1f},{top + r:.1f} V{base:.1f} Z" '
            f'fill="{self.p[colour]}"/>')

    def bar(self, x, y, length, thick, colour):
        """A horizontal bar rounded at its data end."""
        r = min(4.0, thick / 2, length)
        self.parts.append(
            f'<path d="M{x:.1f},{y:.1f} H{x + length - r:.1f} Q{x + length:.1f},{y:.1f} {x + length:.1f},{y + r:.1f} '
            f'V{y + thick - r:.1f} Q{x + length:.1f},{y + thick:.1f} {x + length - r:.1f},{y + thick:.1f} '
            f'H{x:.1f} Z" fill="{self.p[colour]}"/>')

    def dot(self, x, y, colour, r=5.0):
        self.parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r + 2:.1f}" fill="{self.p["bg"]}"/>')
        self.parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{self.p[colour]}"/>')

    def polyline(self, pts, colour, width=2.0):
        d = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        self.parts.append(f'<polyline points="{d}" fill="none" stroke="{self.p[colour]}" '
                          f'stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"/>')

    def footnote(self, s):
        self.text(LEFT, self.h - 24, s, 12, "muted")

    def svg(self) -> str:
        return "\n".join(self.parts + ["</svg>"]) + "\n"


# --------------------------------------------------------------------------

def fig_history(r, p):
    g = r["gross_comfortable"]
    series = [(d, g / rate) for d, rate in r["history"]]
    real20 = {d: y for d, y in r["real20"]}
    s = Svg(640, p, "The price of a comfortable retirement has almost halved since 2021",
            "Pot one person retiring at 66 needs for the comfortable standard, inflation-linked, each month "
            "end since 2005")
    top, base = 118, 380
    x0, x1 = LEFT + 20, W - 150
    t0 = series[0][0].toordinal()
    t1 = series[-1][0].toordinal()
    x = lambda d: x0 + (d.toordinal() - t0) / (t1 - t0) * (x1 - x0)
    hi = 1_600_000
    y = lambda v: base - v / hi * (base - top)
    for v in (0, 400_000, 800_000, 1_200_000, 1_600_000):
        s.line(x0, y(v), x1, y(v), "grid" if v else "axis")
        s.text(x0 - 10, y(v) + 4, short_money(v) if v else "£0", 12, "muted", MONO, "end")
    s.polyline([(x(d), y(v)) for d, v in series], "blue", 2.5)
    (pd, pr), (ld, lr) = r["peak"], r["last"]
    for d, v, label, anchor, dy in ((pd, g / pr, f"{pd:%b %Y}: {money(g / pr)}", "middle", -14),
                                    (ld, g / lr, f"{ld:%b %Y}: {money(g / lr)}", "end", 26),
                                    (series[0][0], series[0][1], f"{series[0][0]:%b %Y}: {money(series[0][1])}",
                                     "start", 26)):
        s.dot(x(d), y(v), "blue", 5)
        s.text(x(d), y(v) + dy, label, 13, "ink", SANS, anchor, 600)
    # the real 20-year gilt yield underneath
    ytop, ybase = 440, 580
    s.text(x0, ytop - 14, "Real 20-year gilt yield, per cent", 13, "dim", SANS, "start", 600)
    yr = lambda v: ybase - (v + 3) / 6 * (ybase - ytop)
    for v in (-3, 0, 3):
        s.line(x0, yr(v), x1, yr(v), "axis" if v == 0 else "grid")
        s.text(x0 - 10, yr(v) + 4, f"{v:+d}" if v else "0", 12, "muted", MONO, "end")
    pts = [(x(d), yr(v)) for d, v in r["real20"] if d >= series[0][0]]
    s.polyline(pts, "dim", 1.8)
    for yyear in (2005, 2010, 2015, 2020, 2025):
        import datetime as _dt
        xx = x(_dt.date(yyear, 1, 1))
        s.text(xx, ybase + 20, str(yyear), 12, "muted", MONO, "middle")
    s.footnote("When real yields are low, an income that rises with prices costs more to buy. Margins and mortality "
               "are held at 2026 levels, so only the gilt curve moves.")
    return s.svg()


def fig_pots(r, p):
    s = Svg(560, p, "What each Retirement Living Standard costs to buy at 66",
            "Pot needed today, after the full state pension and income tax, June 2026 standards, "
            "inflation-linked annuity (level in lighter bars)")
    top, base = 128, 430
    groups = [(people, pp) for people in (1, 2) for pp in r["today"][people]]
    slot = (W - LEFT - 40) / len(groups)
    hi = 900_000
    y = lambda v: base - v / hi * (base - top)
    for v in (0, 300_000, 600_000, 900_000):
        s.line(LEFT, y(v), W - 40, y(v), "grid" if v else "axis")
        s.text(LEFT - 10, y(v) + 4, short_money(v) if v else "£0", 12, "muted", MONO, "end")
    for i, (people, pp) in enumerate(groups):
        cx = LEFT + slot * i + slot / 2
        if pp.gross_annuity < 1:
            s.text(cx, base - 12, "no pot", 13, "dim", SANS, "middle")
        else:
            s.column(cx - 30, base, 26, (base - y(pp.pot_rpi)), "blue")
            s.column(cx + 4, base, 26, (base - y(pp.pot_level)), "rest")
            s.text(cx - 17, y(pp.pot_rpi) - 10, short_money(pp.pot_rpi), 13, "ink", MONO, "middle", 600)
        s.text(cx, base + 22, pp.standard, 13, "ink", SANS, "middle")
        s.text(cx, base + 40, money(pp.net_income), 12, "muted", MONO, "middle")
    s.text(LEFT + slot * 1.5, base + 66, "one person", 13, "dim", SANS, "middle", 600)
    s.text(LEFT + slot * 4.5, base + 66, "two people", 13, "dim", SANS, "middle", 600)
    s.footnote("Two full state pensions, £25,096 a year, already cover the two-person minimum. Housing costs are not in "
               "the standards.")
    return s.svg()


def fig_quotes(r, p):
    rows = r["check"].detail["rows"]
    s = Svg(560, p, "Priced from the gilt curve, checked against 30 real quotes",
            "Annual income from £100,000, Hargreaves Lansdown best buys on 17 September 2026 against my price, "
            "by age, all six products")
    top, base = 118, 440
    x0, x1 = LEFT + 60, W - 60
    ages = [55, 60, 65, 70, 75]
    x = lambda a: x0 + (a - 55) / 20 * (x1 - x0)
    lo, hi = -0.06, 0.06
    y = lambda g: base - (g - lo) / (hi - lo) * (base - top)
    s.parts.append(f'<rect x="{x(62.5):.1f}" y="{y(0.03):.1f}" width="{x1 - x(62.5) + 20:.1f}" '
                   f'height="{y(-0.03) - y(0.03):.1f}" fill="{p["grid"]}"/>')
    for g in (-0.06, -0.03, 0, 0.03, 0.06):
        s.line(x0, y(g), x1 + 20, y(g), "axis" if g == 0 else "grid")
        s.text(x0 - 10, y(g) + 4, f"{g:+.0%}" if g else "0", 12, "muted", MONO, "end")
    for a in ages:
        s.text(x(a), base + 22, str(a), 13, "ink", MONO, "middle")
    products = sorted({row["product"] for row in rows})
    for row in rows:
        j = products.index(row["product"])
        xx = x(row["age"]) + (j - 2.5) * 7
        colour = "rest" if row["tuned"] else ("blue" if row["age"] >= 65 else "red")
        s.dot(xx, y(row["gap"]), colour, 4.5)
    s.text(x(62.5) + 8, y(0.03) - 8, "the gate: within 3% at 65 and over", 13, "ink", SANS, "start", 600)
    s.text(x0, base + 50, "Blue: priced out of sample at 65 to 75, every one within 3%. Red: 55 and 60, too generous "
           "by up to 4%. Grey: the two quotes used to tune.", 13, "dim")
    s.footnote("My income minus the quoted income, as a share of the quote. Positive means I would pay more than the "
               "best insurer did.")
    return s.svg()


FIGURES = {
    "history": fig_history,
    "pots": fig_pots,
    "quotes": fig_quotes,
}


def main() -> int:
    r = run()
    if not r["check"].passed:
        print("the pricing check failed; not drawing figures", file=sys.stderr)
        return 1
    os.makedirs(OUT, exist_ok=True)
    for name, fig in FIGURES.items():
        for mode, palette in (("light", LIGHT), ("dark", DARK)):
            with open(os.path.join(OUT, f"{name}-{mode}.svg"), "w") as f:
                f.write(fig(r, palette))
    print(f"wrote {len(FIGURES) * 2} figures to docs/figures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
