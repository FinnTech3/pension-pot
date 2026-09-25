import { gbp } from "../lib/format";
import { useWidth } from "./hooks";

interface Props {
  shifts: number[];
  pots: number[];
  shift: number;
}

/** The pot needed if gilt yields moved, with today and the reader's choice marked. */
export function YieldChart({ shifts, pots, shift }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 230;
  const L = 50;
  const R = 14;
  const T = 30;
  const B = H - 40;
  const top = Math.ceil(Math.max(...pots) / 250_000) * 250_000;
  const lo = shifts[0]!;
  const hi = shifts[shifts.length - 1]!;
  const x = (s: number) => L + ((s - lo) / (hi - lo)) * (W - L - R);
  const y = (v: number) => B - (v / top) * (B - T);
  const i = shifts.indexOf(shift);
  const today = shifts.indexOf(0);
  const ticks = Array.from({ length: top / 250_000 + 1 }, (_, k) => k * 250_000);

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby="yield-desc">
        <desc id="yield-desc">
          {`The pot needed if gilt yields moved from ${lo} to +${hi} points: ${gbp(pots[0]!)} to ${gbp(pots[pots.length - 1]!)}. Today: ${gbp(pots[today]!)}.`}
        </desc>
        {ticks.map((v) => (
          <g key={v}>
            <line className={v ? "c-grid" : "c-base"} x1={L} x2={W - R} y1={y(v) + 0.5} y2={y(v) + 0.5} />
            <text className="c-tick" x={L - 6} y={y(v) + 4} textAnchor="end">
              {v >= 1_000_000 ? `£${(v / 1e6).toFixed(2)}m` : v ? `£${v / 1000}k` : "£0"}
            </text>
          </g>
        ))}
        <polyline
          points={shifts.map((s, k) => `${x(s).toFixed(1)},${y(pots[k]!).toFixed(1)}`).join(" ")}
          fill="none"
          className="c-rest-line"
          strokeWidth={3}
        />
        <line className="c-guide" x1={x(0)} x2={x(0)} y1={T - 8} y2={B} strokeDasharray="3 3" />
        <text className="c-note" x={x(0) + 6} y={T - 12}>
          today's yields
        </text>
        <circle className="c-panel" cx={x(shift)} cy={y(pots[i]!)} r={9} />
        <circle className="c-you" cx={x(shift)} cy={y(pots[i]!)} r={7} />
        {[-3, -2, -1, 0, 1, 2].map((s) => (
          <text key={s} className="c-tick" x={x(s)} y={B + 18} textAnchor="middle">
            {s > 0 ? `+${s}` : s}
          </text>
        ))}
        <text className="c-note" x={L} y={B + 34}>
          gilt yields moved by, in percentage points
        </text>
      </svg>
    </div>
  );
}
