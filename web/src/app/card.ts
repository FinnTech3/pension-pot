// The result as a 1080 by 1350 picture, the shape that fills a phone screen in
// a feed: the price, and the ridge it sits on. Drawn in the browser; nothing
// is uploaded anywhere.

export interface CardContent {
  lead: string;
  big: string;
  unit: string;
  lines: string[];
  history: number[];
}

// The page's dark theme, fixed, so the picture looks the same whoever saves it.
const PAPER = "#140f22";
const TEXT = "#f0ecf8";
const SOFT = "#c8c0dc";
const MUTED = "#9d94b8";
const RIDGE_1 = "#5a3d8a";
const RIDGE_2 = "#f2c6d6";
const ROSE = "#f2a8cc";
const ACCENT = "#cbb6f0";

const FONTS = [
  '700 260px "IBM Plex Sans Condensed"',
  '700 44px "IBM Plex Sans Condensed"',
  '600 52px "IBM Plex Sans"',
  '400 40px "IBM Plex Sans"',
  '400 32px "IBM Plex Mono"',
];

export async function fontsReady(): Promise<void> {
  try {
    await Promise.all(FONTS.map((f) => document.fonts.load(f)));
  } catch {
    // The card still draws in the fallback fonts.
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawCard(canvas: HTMLCanvasElement, c: CardContent): void {
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const P = 84;
  const inner = 1080 - 2 * P;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // the seal and the series line
  ctx.strokeStyle = TEXT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(P + 34, P + 34, 34, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.textAlign = "center";
  ctx.font = 'italic 600 28px "IBM Plex Serif", serif';
  ctx.fillText("FL", P + 34, P + 44);
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.font = '400 24px "IBM Plex Mono", monospace';
  ctx.fillText("FINN LAKIN · NO. 3 OF 6", P + 90, P + 30);
  ctx.fillText("PENSIONS", P + 90, P + 62);

  ctx.fillStyle = SOFT;
  ctx.font = '400 36px "IBM Plex Sans", sans-serif';
  let y = P + 180;
  for (const line of wrap(ctx, c.lead, inner)) {
    ctx.fillText(line, P, y);
    y += 46;
  }

  let size = 260;
  ctx.fillStyle = TEXT;
  do {
    ctx.font = `700 ${size}px "IBM Plex Sans Condensed", sans-serif`;
    if (ctx.measureText(c.big).width <= inner) break;
    size -= 10;
  } while (size > 120);
  y += size * 0.85;
  ctx.fillStyle = ACCENT;
  ctx.fillText(c.big, P - 6, y);
  ctx.fillStyle = TEXT;
  ctx.font = '600 46px "IBM Plex Serif", serif';
  y += 66;
  ctx.fillText(c.unit, P, y);
  y += 72;
  ctx.fillStyle = SOFT;
  ctx.font = '400 34px "IBM Plex Sans", sans-serif';
  for (const text of c.lines) {
    for (const line of wrap(ctx, text, inner)) {
      ctx.fillText(line, P, y);
      y += 50;
    }
    y += 14;
  }

  // the ridge: the same retirement's price at each month end since 2005
  const base = 1350 - P - 92;
  const height = 240;
  const hi = Math.max(...c.history);
  const px = (i: number) => P + (i / (c.history.length - 1)) * inner;
  // a retirement the state pension already buys has no ridge to draw: every
  // month is nothing, and a ridge scaled to nothing divides by it
  const py = (v: number) => (hi > 0 ? base - (v / hi) * height : base);
  const fill = ctx.createLinearGradient(0, base - height, 0, base);
  fill.addColorStop(0, RIDGE_2);
  fill.addColorStop(1, RIDGE_1);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(px(0), py(c.history[0]!));
  c.history.forEach((v, i) => ctx.lineTo(px(i), py(v)));
  ctx.lineTo(px(c.history.length - 1), base);
  ctx.lineTo(px(0), base);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = RIDGE_2;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  c.history.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
  ctx.stroke();

  // where today sits on it
  const now = c.history[c.history.length - 1]!;
  ctx.strokeStyle = ROSE;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(P, py(now));
  ctx.lineTo(1080 - P, py(now));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = MUTED;
  ctx.font = '400 26px "IBM Plex Sans", sans-serif';
  ctx.fillText(
    hi > 0 ? "the same retirement's price, each month since 2005" : "nothing to buy, each month since 2005",
    P,
    base + 40,
  );
  ctx.font = '400 26px "IBM Plex Mono", monospace';
  ctx.fillText("finntech3.github.io/pension-pot", P, 1350 - P + 10);
}
