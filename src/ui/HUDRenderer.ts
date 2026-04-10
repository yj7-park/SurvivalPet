// HUDRenderer: 미배분 스탯 포인트 뱃지 및 레벨 XP 바 보조 렌더링

export function drawUnspentStatBadge(
  ctx: CanvasRenderingContext2D,
  points: number,
  x: number,
  y: number
): void {
  if (points <= 0) return;

  ctx.fillStyle = '#f0c030';
  ctx.beginPath();
  ctx.roundRect(x, y, 22, 16, 4);
  ctx.fill();

  ctx.fillStyle = '#1a1008';
  ctx.font = 'bold 9px "Courier New"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`+${Math.min(points, 99)}`, x + 11, y + 8);
}

export function drawLevelXpBar(
  ctx: CanvasRenderingContext2D,
  level: number,
  xpRatio: number,   // 0~1
  x: number, y: number, w: number
): void {
  // 레벨 레이블
  ctx.fillStyle = '#f0c030';
  ctx.font = 'bold 9px "Courier New"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`Lv.${level}`, x, y - 2);

  // XP 트랙
  ctx.fillStyle = '#2a1a08';
  ctx.fillRect(x, y, w, 4);

  // XP 채움
  const filled = Math.round(w * Math.min(1, xpRatio));
  if (filled > 0) {
    ctx.fillStyle = '#c8a030';
    ctx.fillRect(x, y, filled, 4);
  }
}
