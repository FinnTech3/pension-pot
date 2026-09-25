import { gbp } from "../lib/format";
import { useWidth } from "./hooks";

interface Props {
  points: { date: string; pot: number }[];
  label: string;
}

function short(x: number): string {
  return x >= 1_000_000 ? `£${(x / 1e6).toFixed(2)}m` : `£${Math.round(x / 1000)}k`;
}

function month(iso: string): string {
  const [y, m] = iso.split("-");
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]} ${y}`;
}

/** The pot the chosen standard needed at each month end since 2005. */
export function HistoryChart({ points, label }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = W < 520 ? 250 : 290;
  const L = 50;
  const R = 12;
  const T = 34;
  const B = H - 36;
  const hi = Math.max(...points.map((p) => p.pot));
  const top = Math.ceil(hi / 400_000) * 400_000;
  const t0 = Date.parse(points[0]!.date);
  const t1 = Date.parse(points[points.length - 1]!.date);
  const x = (iso: string) => L + ((Date.parse(iso) - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => B - (v / top) * (B - T);
  const peak = points.reduce((a, b) => (b.pot > a.pot ? b : a));
  const last = points[points.length - 1]!;
  const ticks = Array.from({ length: top / 400_000 + 1 }, (_, i) => i * 400_000);
  const years = [2005, 2010, 2015, 2020, 2025];
  const peakEnd = x(peak.date) > W * 0.7;

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby="hist-desc">
        <desc id="hist-desc">
          {`${label}: the pot needed at each month end since ${month(points[0]!.date)}. Highest in ${month(peak.date)} at ${gbp(peak.pot)}; ${gbp(last.pot)} in ${month(last.date)}.`}
        </desc>
        {ticks.map((v) => (
          <g key={v}>
            <line className={v ? "c-grid" : "c-base"} x1={L} x2={W - R} y1={y(v) + 0.5} y2={y(v) + 0.5} />
            <text className="c-tick" x={L - 6} y={y(v) + 4} textAnchor="end">
              {v ? short(v) : "£0"}
            </text>
          </g>
        ))}
        <polyline
          points={points.map((p) => `${x(p.date).toFixed(1)},${y(p.pot).toFixed(1)}`).join(" ")}
          fill="none"
          className="c-you-line"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        <circle className="c-panel" cx={x(peak.date)} cy={y(peak.pot)} r={7} />
        <circle className="c-you" cx={x(peak.date)} cy={y(peak.pot)} r={5} />
        <text
          className="c-strong c-halo"
          x={x(peak.date) + (peakEnd ? -8 : 0)}
          y={y(peak.pot) - 12}
          textAnchor={peakEnd ? "end" : "middle"}
        >
          {`${month(peak.date)}: ${short(peak.pot)}`}
        </text>
        <circle className="c-panel" cx={x(last.date)} cy={y(last.pot)} r={7} />
        <circle className="c-you" cx={x(last.date)} cy={y(last.pot)} r={5} />
        <text className="c-strong c-halo" x={x(last.date)} y={y(last.pot) + 24} textAnchor="end">
          {`${month(last.date)}: ${short(last.pot)}`}
        </text>
        {years.map((yr) => (
          <text key={yr} className="c-tick" x={x(`${yr}-01-01`)} y={B + 20} textAnchor="middle">
            {yr}
          </text>
        ))}
      </svg>
    </div>
  );
}
