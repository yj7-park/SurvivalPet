import type { Season } from '../systems/GameTime';

export type CropDrawType = 'wheat' | 'carrot' | 'potato' | 'pumpkin';

/** 밀 3단계 + harvest 스프라이트 생성 */
function drawWheat(ctx: CanvasRenderingContext2D, stage: 0 | 1 | 2, harvest: boolean): void {
  const W = 32, H = 32;
  const green  = '#4a8a30';
  const yellow = '#d4b030';
  const stemColor = (harvest || stage === 2) ? yellow : green;

  if (stage === 0) {
    ctx.fillStyle = green;
    ctx.fillRect(13, 20, 2, 8);
    ctx.fillRect(17, 18, 2, 10);
  } else if (stage === 1) {
    ctx.strokeStyle = green;
    ctx.lineWidth = 2;
    ctx.fillStyle = green;
    ctx.fillRect(15, 12, 2, 16);
    // Y자 잎
    ctx.beginPath(); ctx.moveTo(16, 15); ctx.lineTo(10, 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, 15); ctx.lineTo(22, 9); ctx.stroke();
  } else {
    // 줄기
    ctx.fillStyle = stemColor;
    ctx.fillRect(15, 10, 2, 18);
    // 이삭 5개 타원
    ctx.fillStyle = harvest ? '#f0c840' : '#a8c040';
    for (let i = 0; i < 5; i++) {
      const ox = 9 + i * 3;
      const oy = 5 + Math.abs(i - 2) * 2;
      ctx.beginPath();
      ctx.ellipse(ox, oy, 2, 4, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  void W; void H;
}

/** 당근 3단계 스프라이트 생성 */
function drawCarrot(ctx: CanvasRenderingContext2D, stage: 0 | 1 | 2, harvest: boolean): void {
  const green  = '#50a030';
  const orange = '#e06820';

  if (stage === 0) {
    // 2줄기 초록 잎
    ctx.fillStyle = green;
    ctx.fillRect(13, 18, 2, 10);
    ctx.fillRect(17, 20, 2, 8);
  } else if (stage === 1) {
    // 4줄기 잎 + 당근 힌트
    ctx.fillStyle = green;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(10 + i * 4, 12 + i % 2 * 4, 2, 14 - i % 2 * 2);
    }
    ctx.fillStyle = `${orange}88`;
    ctx.fillRect(14, 24, 4, 4);
  } else {
    // 풍성한 잎
    ctx.fillStyle = green;
    ctx.strokeStyle = green;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const x = 8 + i * 4;
      const y = 8 + Math.abs(i - 2) * 3;
      ctx.fillRect(x, y, 2, 16 - Math.abs(i - 2) * 2);
    }
    // 당근 몸통 삼각형
    ctx.fillStyle = harvest ? '#ff8840' : orange;
    ctx.beginPath();
    ctx.moveTo(16, 28); ctx.lineTo(12, 16); ctx.lineTo(20, 16); ctx.closePath();
    ctx.fill();
    // 흰 하이라이트
    if (harvest) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(13, 18, 2, 4);
    }
  }
}

/** 감자 3단계 스프라이트 생성 */
function drawPotato(ctx: CanvasRenderingContext2D, stage: 0 | 1 | 2, harvest: boolean): void {
  const green = '#508030';
  const white = '#f0f0f0';

  if (stage === 0) {
    ctx.fillStyle = green;
    ctx.fillRect(12, 20, 4, 8);
    ctx.fillRect(16, 22, 4, 6);
  } else if (stage === 1) {
    ctx.fillStyle = green;
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 5;
      ctx.fillRect(x, 14 + (i % 2) * 3, 4, 14 - (i % 2) * 3);
    }
  } else {
    // 풍성한 잎
    ctx.fillStyle = green;
    for (let i = 0; i < 6; i++) {
      const x = 5 + i * 4;
      const y = 10 + Math.abs(i - 2.5) * 2;
      ctx.fillRect(x, y, 4, 18 - Math.abs(i - 2.5) * 2);
    }
    // 흰 꽃
    ctx.fillStyle = harvest ? '#ffee44' : white;
    ctx.beginPath(); ctx.arc(16, 8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = harvest ? '#ffcc00' : '#ffff88';
    ctx.beginPath(); ctx.arc(16, 8, 1, 0, Math.PI * 2); ctx.fill();
  }
}

/** 호박 3단계 스프라이트 생성 */
function drawPumpkin(ctx: CanvasRenderingContext2D, stage: 0 | 1 | 2, harvest: boolean): void {
  const green  = '#508030';
  const orange = '#e87020';

  if (stage === 0) {
    // 덩굴 줄기 + 잎 1개
    ctx.strokeStyle = green;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(16, 28); ctx.lineTo(16, 14); ctx.stroke();
    ctx.fillStyle = green;
    ctx.beginPath(); ctx.ellipse(20, 16, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill();
  } else if (stage === 1) {
    // 덩굴 확장 + 잎 3개
    ctx.strokeStyle = green;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(16, 28); ctx.bezierCurveTo(10, 22, 6, 16, 8, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, 28); ctx.bezierCurveTo(22, 22, 26, 16, 24, 12); ctx.stroke();
    ctx.fillStyle = green;
    [[8, 12], [16, 10], [24, 12]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.ellipse(x, y, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
    });
  } else {
    // 덩굴 + 호박
    ctx.strokeStyle = green;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(16, 26); ctx.bezierCurveTo(8, 20, 4, 12, 6, 8); ctx.stroke();
    ctx.fillStyle = green;
    [[6, 8], [14, 6], [22, 8]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.ellipse(x, y, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    });
    // 호박 (주황 원형 + 세그먼트)
    const pc = harvest ? '#f09030' : orange;
    ctx.fillStyle = pc;
    ctx.beginPath(); ctx.arc(16, 22, 7, 0, Math.PI * 2); ctx.fill();
    // 세그먼트 선
    ctx.strokeStyle = `${pc}88`;
    ctx.lineWidth = 1;
    for (const dx of [-3, 0, 3]) {
      ctx.beginPath(); ctx.moveTo(16 + dx, 15); ctx.lineTo(16 + dx, 29); ctx.stroke();
    }
    // 꼭지
    ctx.fillStyle = green;
    ctx.fillRect(15, 14, 2, 4);
    // 하이라이트
    if (harvest) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(13, 19, 2, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/** 작물 타입·단계별 스프라이트 캔버스 생성 */
export function drawCropCanvas(
  type: CropDrawType,
  stage: 0 | 1 | 2,
  harvest = false,
  season: Season = 'spring',
): HTMLCanvasElement {
  const W = 32, H = 32;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  switch (type) {
    case 'wheat':   drawWheat(ctx, stage, harvest);   break;
    case 'carrot':  drawCarrot(ctx, stage, harvest);  break;
    case 'potato':  drawPotato(ctx, stage, harvest);  break;
    case 'pumpkin': drawPumpkin(ctx, stage, harvest); break;
  }

  // 계절별 색조 보정
  const CROP_SEASON_TINT: Record<Season, string | null> = {
    spring: null,
    summer: 'rgba(200,230,100,0.08)',
    autumn: 'rgba(255,180,60,0.10)',
    winter: 'rgba(130,155,180,0.25)',
  };
  const tint = CROP_SEASON_TINT[season];
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
  }

  return canvas;
}

/** SpriteGenerator로부터 추가 텍스처 등록 시 사용 */
export function registerCropHarvestTextures(scene: Phaser.Scene): void {
  const types: CropDrawType[] = ['wheat', 'carrot', 'potato', 'pumpkin'];
  for (const type of types) {
    const key = `crop_${type}_harvest`;
    if (!scene.textures.exists(key)) {
      scene.textures.addCanvas(key, drawCropCanvas(type, 2, true));
    }
  }
}
