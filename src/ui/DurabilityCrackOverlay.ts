/**
 * 내구도 크랙 오버레이 스프라이트 생성 + 슬롯 내구도 게이지.
 */

/** 크랙 오버레이 Canvas (16×16px, 3단계) */
export function drawCrackOverlay(level: 1 | 2 | 3): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 16;
  const ctx = canvas.getContext('2d')!;

  ctx.strokeStyle = level === 3 ? 'rgba(200,50,10,0.9)' : 'rgba(180,140,80,0.8)';
  ctx.lineWidth = 1;

  if (level >= 1) {
    ctx.beginPath(); ctx.moveTo(12, 1); ctx.lineTo(8, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 7);  ctx.lineTo(10, 9); ctx.stroke();
  }
  if (level >= 2) {
    ctx.beginPath(); ctx.moveTo(3, 8);  ctx.lineTo(7, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, 12); ctx.lineTo(5, 15); ctx.stroke();
  }
  if (level >= 3) {
    ctx.strokeStyle = 'rgba(200,50,10,0.7)';
    ctx.beginPath(); ctx.moveTo(1, 1);  ctx.lineTo(15, 15); ctx.stroke();
    ctx.fillStyle = 'rgba(200,0,0,0.15)';
    ctx.fillRect(0, 0, 16, 16);
  }

  return canvas;
}

/** 내구도에 따른 크랙 레벨 (0=없음, 1/2/3) */
export function getCrackLevel(durability: number, maxDurability: number): 0 | 1 | 2 | 3 {
  const ratio = maxDurability > 0 ? durability / maxDurability : 1;
  if (ratio > 0.5) return 0;
  if (ratio > 0.25) return 1;
  if (ratio > 0.0) return 2;
  return 3;
}

/** 내구도 게이지 바 색상 */
export function getDurabilityBarColor(ratio: number): string {
  if (ratio > 0.5) return '#40c040';
  if (ratio > 0.25) return '#e0a020';
  return '#e03020';
}

/**
 * 슬롯 하단 내구도 바 그리기 (HTML Canvas 2D 컨텍스트용).
 * slotX/slotY는 캔버스 내 좌표, slotW는 슬롯 너비.
 */
export function drawDurabilityBar(
  ctx: CanvasRenderingContext2D,
  durability: number,
  maxDurability: number,
  slotX: number,
  slotY: number,
  slotW: number,
): void {
  if (maxDurability <= 0) return;
  const ratio = durability / maxDurability;

  // 배경
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(slotX + 1, slotY + 33, slotW - 2, 2);

  // 채움
  ctx.fillStyle = getDurabilityBarColor(ratio);
  ctx.fillRect(slotX + 1, slotY + 33, (slotW - 2) * ratio, 2);
}
