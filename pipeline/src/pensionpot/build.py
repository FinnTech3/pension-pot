"""Write the data the web tool loads, from the same run the README quotes.

    PYTHONPATH=pipeline/src python3 -m pensionpot.build

One file, data/built/pension.json, copied into the app at build time:

  - the price of £1 a year of income at every age from 65 to 75, inflation-linked
    and level, with gilt yields moved by -3 to +2 points in quarter steps;
  - the Retirement Living Standards and the annuity income before tax each
    needs, for one person and two;
  - the inflation-linked price at 66 at every month end since 2005;
  - the tax and state pension the app uses to turn a pot into spending money,
    with worked examples from this pipeline for the app's tests to match;
  - the check against 30 published quotes.

Refuses to write anything if the check fails.
"""

from __future__ import annotations

import json
import os
import sys

from . import pots
from .sources import ROOT
from .study import AGES, SHIFTS, run

BUILT = os.path.join(ROOT, "data", "built")


def payload() -> dict:
    r = run()
    c = r["check"]
    examples = [[g, round(g + pots.STATE_PENSION - pots.income_tax(g + pots.STATE_PENSION), 6)]
                for g in (0, 1_000, 5_000, 20_000, 37_000, 40_000, 60_000, 90_000)]
    return {
        "quote_date": r["quote_date"].isoformat(),
        "ages": AGES,
        "shifts": SHIFTS,
        "rates": {kind: [r["grid"][(kind, a)] for a in AGES] for kind in ("rpi", "level")},
        "standards": {str(n): {k: {"net": v, "gross": pots.gross_for(v, n)} for k, v in pots.STANDARDS[n].items()}
                      for n in (1, 2)},
        "history": [[d.isoformat(), rate] for d, rate in r["history"]],
        "real20": [[d.isoformat(), y] for d, y in r["real20"]],
        "tax": {"state_pension": pots.STATE_PENSION, "allowance": pots.PERSONAL_ALLOWANCE,
                "basic_limit": pots.BASIC_RATE_LIMIT, "additional": pots.ADDITIONAL_RATE_THRESHOLD,
                "examples": examples},
        "check": {"passed": c.passed, "mortality_scale": c.detail["mortality_scale"], "spread": c.detail["spread"],
                  "rows": [{k: row[k] for k in ("product", "age", "quoted", "priced", "gap", "tuned")}
                           for row in c.detail["rows"]]},
    }


def main() -> int:
    if not run()["check"].passed:
        print("The pricing check failed; not writing the app's data.", file=sys.stderr)
        return 1
    os.makedirs(BUILT, exist_ok=True)
    text = json.dumps(payload(), separators=(",", ":"), ensure_ascii=False) + "\n"
    with open(os.path.join(BUILT, "pension.json"), "w", encoding="utf-8") as f:
        f.write(text)
    print(f"data/built/pension.json: {len(text.encode()):,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
