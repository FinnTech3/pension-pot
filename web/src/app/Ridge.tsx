import { useMemo, useState } from "react";
import { type Kind, type PensionFile, type Standard, history, potFor } from "../lib/pension";
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
  const points = useMemo(() => history(d, n, standard), [d, n, standard]);
  const now = potFor(d, n, standard, age, kind, shift);

  const H = W < 600 ? 320 : 460;
  const L = 6;
  const R = 6;
  const T = 44;
  const B = H - 34;
  const top = Math.max(...points.map((p) => p.pot), now) * 1.06;
  const x = (i: number) => L + (i / (points.length - 1)) * (W - L - R);
  const y = (v: number) => B - (v / top) * (B - T);

  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.pot).toFixed(1)}`).join("L");
  const peakAt = points.reduce((best, p, i) => (p.pot > points[best]!.pot ? i : best), 0);
  const peak = points[peakAt]!;
  const last = points[points.length - 1]!;

  // The last month the price was at or above what it is now. Every month after
  // that one was below it, so this is the month today's price last matched.
  const matchAt = useMemo(() => {
    for (let i = points.length - 1; i >= 0; i--) if (points[i]!.pot >= now) return i;
    return -1;
  }, [points, now]);

  const moved = `Move gilt yields ${shift > 0 ? "up" : "down"} ${Math.abs(shift)} points and the price is ${short(now)}`;
  const shown = at === null ? null : points[at]!;
  const readout =
    shift === 0
      ? `Today, ${short(now)}. The peak was ${short(peak.pot)} in ${month(peak.date)}: ${Math.round((peak.pot / now - 1) * 100)}% more than now, for exactly the same retirement.`
      : matchAt < 0
        ? `${moved}, dearer than any month since 2005.`
        : matchAt === points.length - 1
          ? `${moved}, cheaper than any month since 2005.`
          : `${moved}, last seen in ${month(points[matchAt]!.date)}.`;

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
          setAt(Math.min(points.length - 1, Math.max(0, Math.round(((px - L) / (W - L - R)) * (points.length - 1)))));
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
          d={`M${line}L${x(points.length - 1).toFixed(1)},${B}L${L},${B}Z`}
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
        {matchAt >= 0 && shift !== 0 && <circle className="match" cx={x(matchAt)} cy={y(points[matchAt]!.pot)} r={5} />}

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
          const i = points.findIndex((p) => p.date.startsWith(String(yr)));
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
          aria-valuetext={shift === 0 ? "today's yields" : `${shift > 0 ? "up" : "down"} ${Math.abs(shift)} points`}
        />
        <div className="ends" aria-hidden="true">
          <span>{`${d.shifts[0]} points`}</span>
          <span>today</span>
          <span>{`+${d.shifts[d.shifts.length - 1]} points`}</span>
        </div>
        <p className="readout" aria-live="polite">
          {readout}
        </p>
      </div>
    </div>
  );
}
