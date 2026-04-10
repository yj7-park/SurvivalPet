import { ItemData } from '../systems/ItemFactory';
import { GRADE_COLORS, getGradeLabel } from '../data/ItemGrade';
import { getOptionLabel } from '../data/ItemOptions';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
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

function calcTooltipHeight(item: ItemData): number {
  let h = 80; // base: name + grade + divider + stats
  if (item.stats.attack)  h += 14;
  if (item.stats.defense) h += 14;
  h += 14; // durability
  if (item.options.length > 0)        h += 10 + item.options.length * 13;
  if (item.specialEffects.length > 0) h += 10 + item.specialEffects.length * 13;
  return h + 12;
}

export function renderItemTooltip(
  ctx: CanvasRenderingContext2D,
  item: ItemData,
  x: number, y: number
): void {
  const W     = 220;
  const H     = calcTooltipHeight(item);
  const color = GRADE_COLORS[item.grade].hex;

  // Background
  ctx.fillStyle = 'rgba(12,9,6,0.96)';
  roundRect(ctx, x, y, W, H, 4); ctx.fill();

  // Grade-coloured border
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  roundRect(ctx, x, y, W, H, 4); ctx.stroke();

  // Left accent bar
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 4, 3, H - 8);

  let oy = y + 14;

  // Item name
  ctx.fillStyle = color;
  ctx.font = 'bold 11px "Courier New"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(item.name, x + 10, oy); oy += 16;

  // Grade label
  ctx.fillStyle = color;
  ctx.font = '9px "Courier New"';
  ctx.fillText(`[${getGradeLabel(item.grade)}]`, x + 10, oy); oy += 14;

  // Divider
  ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 8, oy); ctx.lineTo(x + W - 8, oy); ctx.stroke(); oy += 10;

  // Base stats
  ctx.fillStyle = '#e8d8b0'; ctx.font = '10px "Courier New"';
  if (item.stats.attack  !== undefined) { ctx.fillText(`공격력: ${item.stats.attack}`,  x + 10, oy); oy += 14; }
  if (item.stats.defense !== undefined) { ctx.fillText(`방어력: ${item.stats.defense}`, x + 10, oy); oy += 14; }
  ctx.fillText(`내구도: ${item.stats.durability}/${item.stats.maxDurability}`, x + 10, oy); oy += 14;
  if (item.enhanceLevel > 0) {
    ctx.fillStyle = '#f0c030';
    ctx.fillText(`강화: +${item.enhanceLevel}`, x + 10, oy); oy += 14;
  }

  // Options
  if (item.options.length > 0) {
    oy += 4;
    ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 8, oy); ctx.lineTo(x + W - 8, oy); ctx.stroke(); oy += 10;
    item.options.forEach(opt => {
      ctx.fillStyle = '#40e060'; ctx.font = '9px "Courier New"';
      const sign   = opt.value >= 0 ? '+' : '';
      const suffix = opt.isPercent ? '%' : '';
      ctx.fillText(`${sign}${opt.value}${suffix} ${getOptionLabel(opt.type)}`, x + 10, oy);
      oy += 13;
    });
  }

  // Special effects
  if (item.specialEffects.length > 0) {
    oy += 4;
    ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 8, oy); ctx.lineTo(x + W - 8, oy); ctx.stroke(); oy += 10;
    item.specialEffects.forEach(fx => {
      ctx.fillStyle = color; ctx.font = 'italic 9px "Courier New"';
      ctx.fillText(`✦ ${fx.description}`, x + 10, oy); oy += 13;
    });
  }
}
