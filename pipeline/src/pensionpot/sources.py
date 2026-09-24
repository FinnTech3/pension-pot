"""Where the committed sources live, and loaders for the small ones."""

from __future__ import annotations

import csv
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SOURCES = os.path.join(ROOT, "data", "sources")


def load_quotes(filename: str = "hl_best_buy_2026-09-17.csv") -> list[dict]:
    """Published best-buy annuity quotes: what insurers actually offered that day."""
    with open(os.path.join(SOURCES, filename), newline="", encoding="utf-8") as f:
        out = []
        for r in csv.DictReader(f):
            out.append({
                "product": r["product"],
                "age": int(r["age"]),
                "spouse_age": int(r["spouse_age"]) if r["spouse_age"] else None,
                "guarantee": int(r["guarantee_years"]),
                "escalation": r["escalation"],
                "income": float(r["income_per_100k"]),
            })
        return out
