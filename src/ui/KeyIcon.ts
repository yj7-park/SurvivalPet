/**
 * 키보드·마우스 아이콘 Canvas 드로잉.
 */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
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

export function drawKeyIcon(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
): void {
  const W = label.length > 2 ? 36 : 20;
  const H = 20;

  ctx.fillStyle = '#2a2218';
  roundRect(ctx, x, y, W, H, 3);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, x + 1, y + 1, W - 2, 8, 2);
  ctx.fill();

  ctx.strokeStyle = '#6a5030';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, W, H, 3);
  ctx.stroke();

  ctx.fillStyle = '#f0e0b0';
  ctx.font = 'bold 9px Courier New';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + W / 2, y + H / 2 + 1);
}

export function drawMouseIcon(
  ctx: CanvasRenderingContext2D,
  button: 'left' | 'right',
  x: number,
  y: number,
): void {
  ctx.fillStyle = '#2a2218';
  ctx.beginPath();
  ctx.ellipse(x + 9, y + 12, 9, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f0c030';
  ctx.fillRect(x + (button === 'left' ? 2 : 8), y + 2, 7, 10);

  ctx.strokeStyle = '#6a5030';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 9, y + 2);
  ctx.lineTo(x + 9, y + 12);
  ctx.stroke();
}

/** 키 아이콘 Canvas(40×24px) 생성 */
export function createKeyIconCanvas(label: string): HTMLCanvasElement {
  const W = label.length > 2 ? 40 : 24;
  const H = 24;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  drawKeyIcon(ctx, label, 2, 2);
  return canvas;
}
