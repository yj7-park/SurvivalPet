import type { Season } from '../systems/GameTime';

/**
 * 경작지 타일 스프라이트 생성.
 * 세 가지 상태: tilled (기본), tilled_wet (물 준), tilled_dry (물 필요)
 */
export function drawFarmTileCanvas(
  state: 'tilled' | 'tilled_wet' | 'tilled_dry',
  season: Season = 'spring',
): HTMLCanvasElement {
  const W = 32, H = 32;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 기본 흙 색
  const baseHex = state === 'tilled_wet' ? 0x6a3c18
                : state === 'tilled_dry' ? 0xb0804a
                : 0x8a5c28;
  const r = (baseHex >> 16) & 0xff;
  const g = (baseHex >> 8) & 0xff;
  const b = baseHex & 0xff;

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, W, H);

  // 고랑 무늬 — 4개 가로 줄
  ctx.strokeStyle = state === 'tilled_wet' ? 'rgba(40,20,8,0.5)' : 'rgba(80,50,20,0.4)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    const y = 4 + row * 8;
    ctx.beginPath();
    ctx.moveTo(2, y);
    ctx.lineTo(W - 2, y);
    ctx.stroke();
  }

  // wet: 표면 반짝임 3개 점
  if (state === 'tilled_wet') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    [[6, 6], [14, 20], [24, 12]].forEach(([x, y]) => {
      ctx.fillRect(x, y, 2, 2);
    });
  }

  // dry: 균열 선 2개 짧은 대각선
  if (state === 'tilled_dry') {
    ctx.strokeStyle = 'rgba(160,100,40,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, 8);  ctx.lineTo(12, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, 18); ctx.lineTo(26, 22); ctx.stroke();
  }

  // 계절별 색조 보정
  if (season === 'winter') {
    ctx.fillStyle = 'rgba(200,200,220,0.15)';
    ctx.fillRect(0, 0, W, H);
  }

  return canvas;
}

/** SpriteGenerator에서 호출하여 새 경작지 텍스처 등록 */
export function registerFarmTileTextures(scene: Phaser.Scene, season: Season = 'spring'): void {
  const states: Array<'tilled' | 'tilled_wet' | 'tilled_dry'> = ['tilled', 'tilled_wet', 'tilled_dry'];
  for (const state of states) {
    const key = `farmtile_${state}`;
    if (!scene.textures.exists(key)) {
      scene.textures.addCanvas(key, drawFarmTileCanvas(state, season));
    }
  }
}
