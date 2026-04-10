import Phaser from 'phaser';

/** 8단계 달 위상 텍스처 키 */
export function moonPhaseKey(phaseIdx: number): string {
  return `moon_phase_${phaseIdx}`;
}

/** 달 텍스처(8단계) 캔버스 생성 */
export function drawMoonCanvas(phaseIdx: number): HTMLCanvasElement {
  const phase = phaseIdx / 8; // 0 ~ <1
  const W = 32, H = 32, cx = W / 2, cy = H / 2, r = 12;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 달 본체
  ctx.fillStyle = '#f0eecc';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

  // 크레이터
  ctx.fillStyle = 'rgba(180,170,120,0.5)';
  [[cx - 3, cy - 2, 2.5], [cx + 4, cy + 3, 1.8], [cx + 1, cy - 5, 1.5]].forEach(([x, y, rad]) => {
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  });

  // 위상 마스크
  if (phase > 0.02 && phase < 0.98) {
    const progress = phase < 0.5 ? phase * 2 : (phase - 0.5) * 2;
    const maskR = r * Math.abs(1 - 2 * (phase < 0.5 ? phase : phase - 0.5)) + 0.5;
    const maskX = phase < 0.5 ? cx + r - progress * r * 2 : cx - r + progress * r * 2;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath(); ctx.ellipse(maskX, cy, maskR, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else if (phase < 0.02) {
    // 삭 (완전히 어두움)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // 달 테두리 미광
  ctx.strokeStyle = 'rgba(255,255,200,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.stroke();

  return canvas;
}

/** 달 시스템: 위상 & 위치 계산 + 스프라이트 관리 */
export class MoonSystem {
  private moonSprite!: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene) {
    this.registerTextures();
    this.moonSprite = scene.add.image(-100, -100, moonPhaseKey(4))
      .setScrollFactor(0).setDepth(1).setVisible(false);
  }

  private registerTextures(): void {
    for (let i = 0; i < 8; i++) {
      const key = moonPhaseKey(i);
      if (!this.scene.textures.exists(key)) {
        this.scene.textures.addCanvas(key, drawMoonCanvas(i));
      }
    }
  }

  getMoonPhase(gameDay: number): number {
    return (gameDay % 30) / 30;
  }

  getMoonPosition(gameHour: number): { x: number; y: number } {
    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;
    // 20:00 동쪽 → 04:00 서쪽
    const t = gameHour >= 20
      ? (gameHour - 20) / 8
      : (gameHour + 4) / 8;
    const x = W * 0.15 + W * 0.7 * t;
    const y = H * 0.35 - Math.sin(t * Math.PI) * (H * 0.22);
    return { x, y };
  }

  update(gameHour: number, gameDay: number): void {
    const isDaytime = gameHour >= 6 && gameHour < 20;
    this.moonSprite.setVisible(!isDaytime);

    if (!isDaytime) {
      const { x, y } = this.getMoonPosition(gameHour);
      const phase = this.getMoonPhase(gameDay);
      const phaseIdx = Math.round(phase * 7) % 8;
      this.moonSprite.setPosition(x, y).setTexture(moonPhaseKey(phaseIdx));
    }
  }

  destroy(): void { this.moonSprite.destroy(); }
}
