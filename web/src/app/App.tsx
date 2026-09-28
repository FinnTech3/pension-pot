import { useEffect, useMemo, useState } from "react";
import { gbp } from "../lib/format";
import {
  type Kind,
  type PensionFile,
  STANDARDS,
  type Standard,
  history as priceHistory,
  people,
  potFor,
  rate,
  reached,
  spendingFrom,
} from "../lib/pension";
import { HistoryChart } from "./HistoryChart";
import { ShareCard } from "./ShareCard";
import { YieldChart } from "./YieldChart";
import { useCountUp } from "./hooks";

const REPO = "https://github.com/FinnTech3/pension-pot";
const PORTFOLIO = "https://finn-lakin-portfolio.netlify.app/";

interface Choice {
  n: number;
  standard: Standard;
  age: number;
  kind: Kind;
}

function readChoice(search: string): Choice {
  const q = new URLSearchParams(search);
  const age = Number(q.get("age"));
  const s = q.get("s") as Standard | null;
  return {
    n: q.get("h") === "2" ? 2 : 1,
    standard: s && STANDARDS.includes(s) ? s : "comfortable",
    age: Number.isInteger(age) && age >= 65 && age <= 75 ? age : 66,
    kind: q.get("t") === "level" ? "level" : "rpi",
  };
}

function writeChoice(c: Choice): string {
  const q = new URLSearchParams();
  if (c.n === 2) q.set("h", "2");
  if (c.standard !== "comfortable") q.set("s", c.standard);
  if (c.age !== 66) q.set("age", String(c.age));
  if (c.kind === "level") q.set("t", "level");
  const s = q.toString();
  return s ? `?${s}` : "";
}

function short(x: number): string {
  return x >= 1_000_000 ? `£${(x / 1e6).toFixed(2)}m` : `£${Math.round(x / 1000)}k`;
}

function month(iso: string): string {
  const [y, m] = iso.split("-");
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(m) - 1]} ${y}`;
}

function day(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${month(iso)}`;
}

function useTheme() {
  const [theme, setTheme] = useState<string | undefined>(() => document.documentElement.dataset.theme);
  const systemDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme ? theme === "dark" : systemDark;
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private windows may refuse; the choice then lasts for this visit only.
    }
    setTheme(next);
  }
  return { dark, toggle };
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  const id = `seg-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="field">
      <span id={id}>{label}</span>
      <div className="segmented" role="group" aria-labelledby={id}>
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function App() {
  const [d, setD] = useState<PensionFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [c, setC] = useState<Choice>(() => readChoice(location.search));
  const theme = useTheme();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/pension.json`)
      .then((r) => r.json() as Promise<PensionFile>)
      .then(setD)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    history.replaceState(null, "", `${location.pathname}${writeChoice(c)}`);
  }, [c]);

  const set = (patch: Partial<Choice>) => setC((old) => ({ ...old, ...patch }));

  return (
    <div className="wrap">
      <header>
        <div className="mark">
          <span className="ladder" aria-hidden="true">
            {[8, 10, 12, 14, 16].map((h, i) => (
              <i key={i} className={i === 4 ? "d" : undefined} style={{ height: h }} />
            ))}
          </span>
          <b>Pension pot</b>
          <small>what a retirement costs to buy</small>
        </div>
        <button
          className="toggle"
          type="button"
          onClick={theme.toggle}
          aria-label={`Switch to ${theme.dark ? "light" : "dark"} theme`}
        >
          {theme.dark ? "Light" : "Dark"}
        </button>
      </header>

      <main>
        <div className="hero">
          <h1>How big a pension pot does your retirement need?</h1>
          <p className="lede">
            The pot that buys each Retirement Living Standard for life, after the state pension and tax, priced from
            today's gilt yields and checked against real annuity quotes.
          </p>
          <div className="controls">
            <Segmented
              label="Who is retiring"
              options={[
                [1, "Just me"],
                [2, "Two of us"],
              ]}
              value={c.n}
              onChange={(n) => set({ n })}
            />
            <Segmented
              label="The retirement"
              options={[
                ["minimum", "Minimum"],
                ["moderate", "Moderate"],
                ["comfortable", "Comfortable"],
              ]}
              value={c.standard}
              onChange={(standard) => set({ standard })}
            />
            <div className="field slider">
              <label htmlFor="age">
                Age you buy the income: <output htmlFor="age">{c.age}</output>
              </label>
              <input
                id="age"
                type="range"
                min={65}
                max={75}
                step={1}
                value={c.age}
                onChange={(e) => set({ age: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        <div className={d ? "answer" : "answer skeleton"} aria-live="polite">
          {failed ? (
            <p>The data did not load. Refresh the page to try again.</p>
          ) : d ? (
            <Answer d={d} c={c} setKind={(kind) => set({ kind })} />
          ) : (
            <p>Loading today's prices</p>
          )}
        </div>

        {d && <Sections d={d} c={c} />}

        {d && (
          <aside className="signoff">
            <p>
              That pot is real, priced from the actual gilt curve on the day, not a round number someone picked. More
              like it at <a href={PORTFOLIO}>finn-lakin-portfolio.netlify.app</a>.
            </p>
          </aside>
        )}
      </main>

      <footer>
        <p>
          Sources: Pensions UK, Retirement Living Standards, June 2026; Bank of England gilt yield curves; ONS
          2024-based mortality projections; Hargreaves Lansdown best-buy annuity rates, 17 September 2026; GOV.UK state
          pension and income tax rates, 2026-27.
        </p>
        <p>
          A price, not advice. The standards exclude housing. Tax is at rates for England, Wales and Northern Ireland.
          Annuities are priced for an average buyer; health and lifestyle can buy more income, and drawdown is a
          different trade-off this does not model.
        </p>
        <p>
          Built by Finn Lakin. The method, the code and every check are at{" "}
          <a href={REPO}>github.com/FinnTech3/pension-pot</a>. No cookies, no tracking.
        </p>
      </footer>
    </div>
  );
}

function Answer({ d, c, setKind }: { d: PensionFile; c: Choice; setKind: (k: Kind) => void }) {
  const pot = potFor(d, c.n, c.standard, c.age, c.kind);
  const shown = useCountUp(pot);
  const std = d.standards[people(c.n)][c.standard];
  const who = c.n === 2 ? "two people" : "one person";
  const r = rate(d, c.kind, c.age);
  const past = priceHistory(d, c.n, c.standard);
  const peak = past.reduce((a, b) => (b.pot > a.pot ? b : a));
  const [potText, setPotText] = useState("");
  const yours = Number(potText.replace(/[^0-9.]/g, ""));
  const spending = yours > 0 ? spendingFrom(d, c.n, yours, c.age, c.kind) : null;
  const level = spending !== null ? reached(d, c.n, spending) : null;

  return (
    <>
      <div className="answer-main">
        <div className="where">
          <b>{`${c.standard[0]!.toUpperCase()}${c.standard.slice(1)} retirement`}</b>
          <span>{`${who}, buying at ${c.age}`}</span>
        </div>
        <div className="big">
          <span className="num">{pot < 1 ? "No pot" : gbp(Math.round((shown ?? pot) / 1000) * 1000)}</span>
          <span className="unit">
            {pot < 1
              ? "needed: the state pension already covers it"
              : `for ${gbp(std.net)} a year to spend after tax, ${c.kind === "rpi" ? "rising with prices" : "fixed in pounds"}, for life`}
          </span>
        </div>
        {pot >= 1 && c.kind === "rpi" && (
          <p className="context">{`In ${month(peak.date)} the same retirement at 66 cost ${short(peak.pot)}.`}</p>
        )}
        {c.kind === "level" && (
          <p className="context">
            A level income is cheaper today but loses about a third of its buying power in twenty years of 2% inflation.
          </p>
        )}
        <div className="segmented" role="group" aria-label="Kind of income">
          <button type="button" aria-pressed={c.kind === "rpi"} onClick={() => setKind("rpi")}>
            Rises with prices
          </button>
          <button type="button" aria-pressed={c.kind === "level"} onClick={() => setKind("level")}>
            Fixed in pounds
          </button>
        </div>
      </div>
      <div className="answer-side">
        <dl className="facts">
          <div>
            <dt>{`Income £100,000 buys at ${c.age}`}</dt>
            <dd>{`${gbp(100_000 * r)} a year`}</dd>
          </div>
          <div>
            <dt>{c.n === 2 ? "Two state pensions" : "State pension"}</dt>
            <dd>{`${gbp(c.n * d.tax.state_pension)} a year`}</dd>
          </div>
          <div>
            <dt>Annuity income needed, before tax</dt>
            <dd>{gbp(std.gross < 1 ? 0 : std.gross)}</dd>
          </div>
        </dl>
        <div className="field">
          <label htmlFor="pot">Already have a pot? What it buys:</label>
          <div className="pot-input">
            <input
              id="pot"
              inputMode="numeric"
              placeholder="£250,000"
              value={potText}
              onChange={(e) => setPotText(e.target.value)}
            />
          </div>
          {spending !== null && (
            <p className="note">
              {`${gbp(yours)} buys ${gbp(yours * r)} a year. With ${c.n === 2 ? "two state pensions" : "the state pension"}, that is ${gbp(spending)} to spend after tax: ${level ? `enough for the ${level} standard` : "below the minimum standard"}.`}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function Sections({ d, c }: { d: PensionFile; c: Choice }) {
  const [shift, setShift] = useState(0);
  const past = useMemo(() => priceHistory(d, c.n, c.standard), [d, c.n, c.standard]);
  const pots = useMemo(() => d.shifts.map((s) => potFor(d, c.n, c.standard, c.age, c.kind, s)), [d, c]);
  const now = potFor(d, c.n, c.standard, c.age, c.kind);
  const atShift = potFor(d, c.n, c.standard, c.age, c.kind, shift);
  const gated = d.check.rows.filter((r) => !r.tuned && r.age >= 65);
  const worst = Math.max(...gated.map((r) => Math.abs(r.gap)));
  const young = d.check.rows.filter((r) => r.age < 65);
  const peak = past.reduce((a, b) => (b.pot > a.pot ? b : a));
  const who = c.n === 2 ? "two people" : "one person";
  const card = useMemo(
    () => ({
      lead: `To buy a ${c.standard} retirement for ${who} at ${c.age}, with an income ${c.kind === "rpi" ? "that rises with prices" : "fixed in pounds"}:`,
      big: now < 1 ? "No pot" : short(now),
      unit: `at ${month(d.quote_date)} prices`,
      lines:
        c.kind === "rpi" && now >= 1
          ? [
              `In ${month(peak.date)} the same retirement at 66 cost ${short(peak.pot)}.`,
              "Priced from gilt yields, checked against 30 real annuity quotes.",
            ]
          : ["Priced from gilt yields, checked against 30 real annuity quotes."],
      history: past.map((p) => p.pot),
    }),
    [c, d, now, past, peak, who],
  );

  return (
    <>
      {now >= 1 && (
        <section>
          <h2>The same retirement, every month since 2005</h2>
          <p className="sub">
            {`The pot a ${c.standard} retirement for ${who} at 66 needed at each month end, with an income that rises with prices. Everything but gilt yields is held at today's values, so this is what yields alone did to the price.`}
          </p>
          <div className="fig">
            <HistoryChart points={past} label={`A ${c.standard} retirement for ${who}`} />
          </div>
        </section>
      )}

      {now >= 1 && (
        <section>
          <h2>If gilt yields moved</h2>
          <p className="sub">
            Annuity prices follow gilt yields. Move them and see what the same retirement would cost. Higher yields mean
            a smaller pot.
          </p>
          <div className="fig">
            <YieldChart shifts={d.shifts} pots={pots} shift={shift} />
          </div>
          <div className="field slider" style={{ marginTop: 12 }}>
            <label htmlFor="shift">
              Gilt yields moved by:{" "}
              <output htmlFor="shift">{`${shift > 0 ? "+" : ""}${shift.toFixed(2)} points`}</output>
            </label>
            <input
              id="shift"
              type="range"
              min={d.shifts[0]}
              max={d.shifts[d.shifts.length - 1]}
              step={0.25}
              value={shift}
              onChange={(e) => setShift(Number(e.target.value))}
            />
            <p className="note" aria-live="polite">
              {`The same retirement would cost ${gbp(Math.round(atShift / 1000) * 1000)}.`}
            </p>
          </div>
        </section>
      )}

      <section>
        <h2>How I know these prices are right</h2>
        <p className="sub">
          Every annuity here is priced from first principles: the Bank of England's gilt curves, the ONS's projected
          mortality, and one margin. Then it is checked against what insurers were actually quoting.
        </p>
        <ul className="checks">
          <li>
            <span className="pill neutral">Tuned</span>
            <div>
              <b>Two numbers set from two quotes</b>
              <span>
                {`The level quotes at 65 and 75 set the margin over gilts, ${d.check.spread.toFixed(2)} points, and annuity buyers' mortality, ${Math.round(100 * d.check.mortality_scale)}% of the population's.`}
              </span>
            </div>
          </li>
          <li>
            <span className={d.check.passed ? "pill" : "pill fail"}>{d.check.passed ? "Pass" : "Fail"}</span>
            <div>
              <b>{`${gated.length} more quotes at 65 to 75, priced blind`}</b>
              <span>
                {`Six kinds of annuity, level, inflation-linked, escalating and joint life: every one within 3% of what the best insurer offered on ${day(d.quote_date)}, the worst ${(100 * worst).toFixed(1)}%.`}
              </span>
            </div>
          </li>
          <li>
            <span className="pill neutral">Stated</span>
            <div>
              <b>Where it misses</b>
              <span>
                {`At 55 and 60 the model offers ${(100 * Math.min(...young.map((r) => r.gap))).toFixed(1)}% to ${(100 * Math.max(...young.map((r) => r.gap))).toFixed(1)}% more income than insurers do. This page only prices from 65.`}
              </span>
            </div>
          </li>
        </ul>
      </section>

      <section>
        <h2>Save your result</h2>
        <ShareCard content={card} file={`pension-pot-${c.standard}-${c.n}.png`} />
      </section>
    </>
  );
}
