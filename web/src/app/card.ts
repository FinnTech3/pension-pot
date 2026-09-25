// The result as a 1080 by 1350 picture, drawn in the browser; nothing is uploaded.

export interface CardContent {
  lead: string;
  big: string;
  unit: string;
  lines: string[];
  history: number[];
}

const INK = "#14171a";
const TEXT = "#eef1f0";
const SOFT = "#bcc3c2";
const MUTED = "#939b9a";
const REST = "#434a49";
const YOU = "#3987e5";

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
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, 1080, 1350);

  // the mark: a pot filling up
  [10, 16, 22, 28, 34].forEach((h, i) => {
    ctx.fillStyle = i === 4 ? TEXT : REST;
    ctx.fillRect(P + i * 14, P + 40 - h, 10, h);
  });
  ctx.fillStyle = TEXT;
  ctx.font = '700 44px "IBM Plex Sans Condensed", sans-serif';
  ctx.fillText("Pension pot", P + 84, P + 40);

  ctx.fillStyle = SOFT;
  ctx.font = '400 40px "IBM Plex Sans", sans-serif';
  let y = P + 150;
  for (const line of wrap(ctx, c.lead, inner)) {
    ctx.fillText(line, P, y);
    y += 52;
  }

  let size = 260;
  ctx.fillStyle = TEXT;
  do {
    ctx.font = `700 ${size}px "IBM Plex Sans Condensed", sans-serif`;
    if (ctx.measureText(c.big).width <= inner) break;
    size -= 10;
  } while (size > 120);
  y += size * 0.85;
  ctx.fillText(c.big, P - 6, y);
  ctx.font = '600 44px "IBM Plex Sans", sans-serif';
  y += 70;
  ctx.fillText(c.unit, P, y);
  y += 80;
  ctx.font = '400 38px "IBM Plex Sans", sans-serif';
  for (const text of c.lines) {
    for (const line of wrap(ctx, text, inner)) {
      ctx.fillText(line, P, y);
      y += 50;
    }
    y += 14;
  }

  // the price since 2005, as a line
  const base = 1350 - P - 90;
  const height = 170;
  const hi = Math.max(...c.history);
  ctx.strokeStyle = YOU;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  c.history.forEach((v, i) => {
    const px = P + (i / (c.history.length - 1)) * inner;
    const py = base - (v / hi) * height;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = '400 28px "IBM Plex Sans", sans-serif';
  ctx.fillText("the same retirement's price, each month since 2005", P, base + 44);
  ctx.font = '400 32px "IBM Plex Mono", monospace';
  ctx.fillText("finntech3.github.io/pension-pot", P, 1350 - P);
}
