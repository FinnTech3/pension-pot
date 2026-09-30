import { useMemo, useState } from "react";
import {
  type Kind,
  type PensionFile,
  type Standard,
  covered,
  history,
  people,
  place,
  points,
  potFor,
  spendingFrom,
} from "../lib/pension";
import { gbp } from "../lib/format";
import { useWidth } from "./hooks";

interface Props {
  d: PensionFile;
  n: number;
  standard: Standard;
  age: number;
  kind: Kind;
  /** The move in gilt yields, in points, from the dial. */
  shift: number;
  onShift: (shift: number) => void;
}

function month(iso: string): string {
  const [y, m] = iso.split("-");
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(m) - 1]} ${y}`;
}

function short(x: number): string {
  return x >= 1_000_000 ? `£${(x / 1e6).toFixed(2)}m` : `£${Math.round(x / 1000)}k`;
}

/**
 * The price of a retirement, month by month since 2005, drawn as a ridge.
 * It rises as gilt yields fall, because the same income costs more to buy, and
 * it has one clear peak. A dial moves today's price up and down the same
 * scale, and the ridge says when the price was last there.
 */
export function Ridge({ d, n, standard, age, kind, shift, onShift }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>(360);
  const [at, setAt] = useState<number | null>(null);
  const months = useMemo(() => history(d, n, standard), [d, n, standard]);
  const now = potFor(d, n, standard, age, kind, shift);

  const H = W < 600 ? 320 : 460;
  const L = 6;
  const R = 6;
  const T = 44;
  const B = H - 34;
  const top = Math.max(...months.map((m) => m.pot), now) * 1.06;
  const x = (i: number) => L + (i / (months.length - 1)) * (W - L - R);
  const y = (v: number) => B - (v / top) * (B - T);

  const line = months.map((m, i) => `${x(i).toFixed(1)},${y(m.pot).toFixed(1)}`).join("L");
  const peakAt = months.reduce((best, m, i) => (m.pot > months[best]!.pot ? i : best), 0);
  const peak = months[peakAt]!;
  const last = months[months.length - 1]!;

  // Two state pensions already cover a two-person minimum retirement, so its
  // price is nothing and has been nothing every month since 2005. A ridge of
  // zeroes is not a ridge, and dividing by it is how the page came to offer
  // "Infinity% more than now", so this state is drawn and worded on its own.
  const none = covered(d, n, standard);
  const fromState = spendingFrom(d, n, 0, age, kind);
  const need = d.standards[people(n)][standard].net;
  // What the same household's other two standards have cost, so the floor is
  // read against them: that is what being covered by the state pension means.
  const ghosts = useMemo(
    () => (["moderate", "comfortable"] as Standard[]).map((s) => ({ s, months: history(d, n, s) })),
    [d, n],
  );

  const where = useMemo(() => place(months, now), [months, now]);
  const moved = `Move gilt yields ${shift > 0 ? "up" : "down"} ${points(Math.abs(shift))} and the price is ${short(now)}`;
  const shown = at === null ? null : months[at]!;
  const readout =
    shift === 0
      ? `Today, ${short(now)}. The peak was ${short(peak.pot)} in ${month(peak.date)}: ${Math.round((peak.pot / now - 1) * 100)}% more than now, for exactly the same retirement.`
      : where.at === "dearest"
        ? `${moved}, dearer than any month since 2005.`
        : where.at === "cheapest"
          ? `${moved}, cheaper than any month since 2005.`
          : `${moved}. It was last that ${where.dearer ? "dear" : "cheap"} in ${month(months[where.i]!.date)}.`;

  if (none) {
    const ceiling = Math.max(...ghosts.flatMap((g) => g.months.map((m) => m.pot))) * 1.08;
    const gy = (v: number) => B - (v / ceiling) * (B - T);
    return (
      <div ref={ref} className="ridge-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="ridge none" role="img" aria-labelledby="ridge-desc">
          <desc id="ridge-desc">
            {`A ${standard} retirement for ${n === 2 ? "two people" : "one person"} costs nothing to buy: ` +
              `${gbp(fromState)} of state pension a year after tax against the ${gbp(need)} the standard asks for. ` +
              `Its line runs along nothing at every month end since 2005, under the two standards that do cost something: ` +
              ghosts
                .map((g) => `${g.s} peaked at ${short(Math.max(...g.months.map((m) => m.pot)))}`)
                .join(" and ") +
              "."}
          </desc>
          <text className="c-note" x={L} y={16}>
            what each retirement has cost to buy, month by month
          </text>
          {ghosts.map((g) => {
            const path = g.months.map((m, i) => `${x(i).toFixed(1)},${gy(m.pot).toFixed(1)}`).join("L");
            // named at the left, where both lines are flat and far apart; at
            // the right they end close together and the label crosses them
            const start = gy(g.months[0]!.pot);
            return (
              <g key={g.s} className="ghost">
                <path d={`M${path}`} fill="none" />
                <text className="c-tick c-halo" x={L + 2} y={start - 9}>
                  {g.s}
                </text>
              </g>
            );
          })}
          <line className="floor" x1={L} x2={W - R} y1={B} y2={B} />
          <text className="nothing" x={L} y={B - 14}>
            nothing, every month since 2005
          </text>
          <text className="c-tick" x={L} y={B + 20}>
            2005
          </text>
          <text className="c-tick" x={W - R} y={B + 20} textAnchor="end">
            {last.date.slice(0, 4)}
          </text>
        </svg>

        <div className="dial">
          <p className="readout">
            {`Two state pensions come to ${gbp(fromState)} a year after tax, and a ${standard} retirement for two asks for ${gbp(need)}. There is no pot to buy, so there is nothing for gilt yields to move. The two lines above it are what the same couple's moderate and comfortable retirements have cost.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="ridge-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="ridge"
        role="img"
        aria-labelledby="ridge-desc"
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          setAt(Math.min(months.length - 1, Math.max(0, Math.round(((px - L) / (W - L - R)) * (months.length - 1)))));
        }}
        onPointerLeave={() => setAt(null)}
      >
        <desc id="ridge-desc">
          {`What a ${standard} retirement for ${n === 2 ? "two people" : "one person"} has cost to buy at each month end since 2005. ` +
            `It peaked at ${short(peak.pot)} in ${month(peak.date)} and had fallen to ${short(last.pot)} by ${month(last.date)}. At the dial's current setting the price is ${short(now)}.`}
        </desc>
        <defs>
          <linearGradient id="ridge-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className="ridge-a" />
            <stop offset="1" className="ridge-b" />
          </linearGradient>
        </defs>

        <path
          className="ridge-body"
          d={`M${line}L${x(months.length - 1).toFixed(1)},${B}L${L},${B}Z`}
          fill="url(#ridge-fill)"
        />
        <path className="ridge-line" d={`M${line}`} fill="none" />

        {/* today's price at the dial's setting */}
        <line className="now-line" x1={L} x2={W - R} y1={y(now)} y2={y(now)} />
        <text
          className="c-strong c-halo now-label"
          x={W - R - 4}
          y={y(now) + (y(now) < T + 24 ? 18 : -9)}
          textAnchor="end"
        >
          {shift === 0 ? `${short(now)} today` : `${short(now)} at this yield`}
        </text>
        {where.at === "since" && shift !== 0 && <circle className="match" cx={x(where.i)} cy={y(months[where.i]!.pot)} r={5} />}

        {/* the peak */}
        <circle className="peak" cx={x(peakAt)} cy={y(peak.pot)} r={4} />
        <text
          className="c-value c-halo"
          x={x(peakAt) + (x(peakAt) > W * 0.6 ? -10 : 10)}
          y={y(peak.pot) - 10}
          textAnchor={x(peakAt) > W * 0.6 ? "end" : "start"}
        >
          {`${short(peak.pot)}, ${month(peak.date).split(" ")[0]!.slice(0, 3)} ${peak.date.slice(0, 4)}`}
        </text>

        {[2005, 2010, 2015, 2020, 2025].map((yr) => {
          const i = months.findIndex((m) => m.date.startsWith(String(yr)));
          if (i < 0) return null;
          return (
            <g key={yr}>
              <line className="warp" x1={x(i)} x2={x(i)} y1={T - 8} y2={B} />
              <text className="c-tick" x={x(i)} y={B + 20} textAnchor="middle">
                {yr}
              </text>
            </g>
          );
        })}
        <text className="c-note" x={L} y={16}>
          what this retirement has cost to buy, month by month
        </text>

        {shown && (
          <g className="hover">
            <line x1={x(at!)} x2={x(at!)} y1={y(shown.pot)} y2={B} />
            <circle cx={x(at!)} cy={y(shown.pot)} r={3.5} />
            <text
              className="c-value c-halo"
              x={Math.min(W - R - 4, Math.max(L + 4, x(at!)))}
              y={Math.max(T - 6, y(shown.pot) - 14)}
              textAnchor={x(at!) > W * 0.7 ? "end" : x(at!) < W * 0.3 ? "start" : "middle"}
            >
              {`${month(shown.date)}: ${short(shown.pot)}`}
            </text>
          </g>
        )}
      </svg>

      <div className="dial">
        <label htmlFor="shift">Move gilt yields</label>
        <input
          id="shift"
          type="range"
          min={0}
          max={d.shifts.length - 1}
          value={d.shifts.indexOf(shift)}
          onChange={(e) => onShift(d.shifts[Number(e.target.value)]!)}
          aria-valuetext={shift === 0 ? "today's yields" : `${shift > 0 ? "up" : "down"} ${points(Math.abs(shift))}`}
        />
        <div className="ends" aria-hidden="true">
          <span>{points(d.shifts[0]!)}</span>
          <span>today</span>
          <span>{`+${points(d.shifts[d.shifts.length - 1]!)}`}</span>
        </div>
        <p className="readout" aria-live="polite">
          {readout}
        </p>
      </div>
    </div>
  );
}
