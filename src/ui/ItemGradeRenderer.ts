import { ItemGrade, GRADE_COLORS, GRADE_LABELS } from '../data/ItemGrade';
import { ItemData } from '../systems/ItemFactory';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawLegendaryCorners(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  hexColor: string
): void {
  ctx.fillStyle = hexColor;
  const sz = 6;
  ctx.beginPath(); ctx.moveTo(x, y);       ctx.lineTo(x + sz, y);       ctx.lineTo(x, y + sz);       ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w, y);   ctx.lineTo(x + w - sz, y);   ctx.lineTo(x + w, y + sz);   ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y + h);   ctx.lineTo(x + sz, y + h);   ctx.lineTo(x, y + h - sz);   ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w, y + h); ctx.lineTo(x + w - sz, y + h); ctx.lineTo(x + w, y + h - sz); ctx.closePath(); ctx.fill();
}

export function drawGradedSlot(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  item: ItemData
): void {
  const col     = GRADE_COLORS[item.grade];
  const hexStr  = col.hex;

  if (item.grade !== 'normal') {
    ctx.fillStyle = hexStr + '22';
    roundRect(ctx, sx + 1, sy + 1, 46, 46, 4);
    ctx.fill();
  }

  ctx.strokeStyle = hexStr;
  ctx.lineWidth = item.grade === 'legendary' ? 2.5 : item.grade === 'epic' ? 2 : 1.5;
  roundRect(ctx, sx + 0.5, sy + 0.5, 47, 47, 4);
  ctx.stroke();

  if (item.grade === 'legendary') {
    drawLegendaryCorners(ctx, sx, sy, 48, 48, hexStr);
  }
}

export function drawGradeBadge(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  grade: ItemGrade
): void {
  if (grade === 'normal') return;
  const BADGE_LABELS: Partial<Record<ItemGrade, string>> = {
    uncommon: 'U', rare: 'R', epic: 'E', legendary: 'L',
  };
  const col = GRADE_COLORS[grade];
  const bx  = sx + 35, by = sy + 2;

  ctx.fillStyle = col.hex;
  roundRect(ctx, bx, by, 11, 11, 2);
  ctx.fill();
  ctx.fillStyle = '#0a0a0a';
  ctx.font = 'bold 8px "Courier New"';
  ctx.textAlign = 'center';
  ctx.fillText(BADGE_LABELS[grade] ?? '', bx + 5.5, by + 8);
}

export function drawGradeTooltipHeader(
  ctx: CanvasRenderingContext2D,
  item: ItemData,
  x: number, y: number,
  W: number
): number {
  const col    = GRADE_COLORS[item.grade];
  const hexStr = col.hex;

  ctx.fillStyle = hexStr;
  ctx.fillRect(x, y + 4, 3, 60);

  ctx.fillStyle = hexStr;
  ctx.font = 'bold 13px "Courier New"';
  ctx.textAlign = 'left';
  ctx.fillText(item.name, x + 12, y + 18);

  ctx.fillStyle = hexStr + 'bb';
  ctx.font = '10px "Courier New"';
  ctx.fillText(`[${GRADE_LABELS[item.grade]}]`, x + 12, y + 32);

  ctx.strokeStyle = hexStr + '44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 38);
  ctx.lineTo(x + W - 12, y + 38);
  ctx.stroke();

  return y + 52;
}
