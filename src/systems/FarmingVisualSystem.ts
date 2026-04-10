import Phaser from 'phaser';
import { TILE_SIZE } from '../world/MapGenerator';
import type { CropType } from '../config/crops';

// ── 수확 색상 팔레트 ──────────────────────────────────────────
const HARVEST_COLORS: Record<CropType, number> = {
  wheat:   0xf0c030,
  carrot:  0xe06820,
  potato:  0xc8d080,
  pumpkin: 0xe87020,
};

const CROP_POPUP_NAME: Record<CropType, string> = {
  wheat:   '🌾 밀',
  carrot:  '🥕 당근',
  potato:  '🥔 감자',
  pumpkin: '🎃 호박',
};

// ── 물주기 파티클 ─────────────────────────────────────────────
export function playWaterAnimation(scene: Phaser.Scene, tileWorldX: number, tileWorldY: number): void {
  const drops = 5;
  for (let i = 0; i < drops; i++) {
    const delay = i * 60;
    const gfx = scene.add.graphics();
    gfx.fillStyle(0x4090e0, 0.9);
    gfx.fillRect(0, 0, 3, 5);
    gfx.setPosition(tileWorldX - 20 + i * 4, tileWorldY - 16);
    gfx.setDepth(55);

    scene.tweens.add({
      targets: gfx,
      x: tileWorldX + Phaser.Math.Between(-6, 6),
      y: tileWorldY + 4,
      duration: 300,
      delay,
      ease: 'Quad.easeIn',
      onComplete: () => {
        spawnWaterSplash(scene, gfx.x, gfx.y);
        gfx.destroy();
      },
    });
  }
}

function spawnWaterSplash(scene: Phaser.Scene, x: number, y: number): void {
  if (!scene.textures.exists('fx_pixel')) return;
  const emitter = scene.add.particles(x, y, 'fx_pixel', {
    tint:     [0x60b0f0, 0x80c8ff, 0xaaddff],
    speed:    { min: 15, max: 40 },
    angle:    { min: -150, max: -30 },
    scale:    { start: 0.6, end: 0 },
    alpha:    { start: 0.9, end: 0 },
    lifespan: 300,
    quantity: 4,
    emitting: false,
  });
  emitter.explode(4);
  scene.time.delayedCall(400, () => emitter.destroy());
}

// ── 수확 이펙트 ───────────────────────────────────────────────
export function playHarvestEffect(
  scene: Phaser.Scene,
  cropType: CropType,
  worldX: number,
  worldY: number,
): void {
  const color = HARVEST_COLORS[cropType];

  // 파티클 버스트
  if (scene.textures.exists('fx_pixel')) {
    const emitter = scene.add.particles(worldX, worldY, 'fx_pixel', {
      tint:     [color, 0xffffff, color],
      speed:    { min: 40, max: 100 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.2, end: 0 },
      alpha:    { start: 1.0, end: 0 },
      lifespan: 500,
      quantity: 7,
      emitting: false,
    });
    emitter.explode(7);
    scene.time.delayedCall(600, () => emitter.destroy());
  }

  // 수확물 이름 팝업
  const popup = scene.add.text(worldX, worldY - 8, CROP_POPUP_NAME[cropType], {
    fontSize: '11px', fontFamily: 'Courier New',
    color: '#ffffff', stroke: '#000000', strokeThickness: 2,
  }).setDepth(90).setOrigin(0.5);

  scene.tweens.add({
    targets: popup,
    y: popup.y - 24,
    alpha: { from: 1, to: 0 },
    duration: 700,
    ease: 'Quad.easeOut',
    onComplete: () => popup.destroy(),
  });
}

// ── 성장 단계 애니메이터 ─────────────────────────────────────
export class CropGrowthAnimator {
  constructor(private scene: Phaser.Scene) {}

  /** 새 단계 진입 시 scale punch 효과 */
  onStageAdvance(cropSprite: Phaser.GameObjects.Image): void {
    this.scene.tweens.add({
      targets: cropSprite,
      scaleX: { from: 0.6, to: 1.0 },
      scaleY: { from: 0.6, to: 1.0 },
      duration: 400,
      ease: 'Back.easeOut',
    });
    this.emitGrowParticles(cropSprite.x, cropSprite.y);
  }

  /** 수확 가능 상태 흔들림 tween */
  onHarvestReady(cropSprite: Phaser.GameObjects.Image): void {
    // 기존 tween 정지
    this.scene.tweens.killTweensOf(cropSprite);
    this.scene.tweens.add({
      targets: cropSprite,
      angle: { from: -4, to: 4 },
      duration: 800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private emitGrowParticles(x: number, y: number): void {
    if (!this.scene.textures.exists('fx_pixel')) return;
    const emitter = this.scene.add.particles(x, y, 'fx_pixel', {
      tint:     [0x60c040, 0x80d060, 0x40a020],
      speed:    { min: 20, max: 60 },
      angle:    { min: -90, max: -30 },
      scale:    { start: 0.8, end: 0 },
      alpha:    { start: 1.0, end: 0 },
      lifespan: 500,
      quantity: 3,
      emitting: false,
    });
    emitter.explode(3);
    this.scene.time.delayedCall(600, () => emitter.destroy());
  }
}

// ── 물 고갈 경고 아이콘 ───────────────────────────────────────
export class DryWarningIndicator {
  private indicators = new Map<string, { gfx: Phaser.GameObjects.Graphics; tween: Phaser.Tweens.Tween }>();

  constructor(private scene: Phaser.Scene) {}

  show(cropKey: string, worldX: number, worldY: number): void {
    if (this.indicators.has(cropKey)) return;
    const gfx = this.scene.add.graphics().setDepth(72);
    gfx.fillStyle(0x4090e0, 0.9);
    // 물방울 역삼각형
    gfx.fillTriangle(worldX - 5, worldY - 24, worldX + 5, worldY - 24, worldX, worldY - 14);
    // 상단 원
    gfx.fillCircle(worldX, worldY - 26, 4);

    const tween = this.scene.tweens.add({
      targets: gfx,
      alpha: { from: 1.0, to: 0.3 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    this.indicators.set(cropKey, { gfx, tween });
  }

  hide(cropKey: string): void {
    const entry = this.indicators.get(cropKey);
    if (entry) {
      entry.tween.destroy();
      entry.gfx.destroy();
      this.indicators.delete(cropKey);
    }
  }

  hideAll(): void {
    for (const key of [...this.indicators.keys()]) {
      this.hide(key);
    }
  }

  destroy(): void { this.hideAll(); }
}

// ── 경작지 경계 점선 ─────────────────────────────────────────
export class FarmPlotBorder {
  private gfx: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(22);
  }

  draw(tiledPositions: { tx: number; ty: number }[]): void {
    this.gfx.clear();
    if (tiledPositions.length === 0) return;

    this.gfx.lineStyle(1, 0xa06030, 0.5);

    for (const { tx, ty } of tiledPositions) {
      const wx = tx * TILE_SIZE, wy = ty * TILE_SIZE;
      const W = TILE_SIZE;
      const edges = [
        { dx: 0, dy: -1, x1: wx,   y1: wy,   x2: wx + W, y2: wy      }, // top
        { dx: 0, dy:  1, x1: wx,   y1: wy+W,  x2: wx + W, y2: wy + W  }, // bottom
        { dx:-1, dy:  0, x1: wx,   y1: wy,   x2: wx,     y2: wy + W  }, // left
        { dx: 1, dy:  0, x1: wx+W, y1: wy,   x2: wx + W, y2: wy + W  }, // right
      ];
      for (const { dx, dy, x1, y1, x2, y2 } of edges) {
        const isNeighbor = tiledPositions.some(p => p.tx === tx + dx && p.ty === ty + dy);
        if (!isNeighbor) {
          this.drawDashedLine(x1, y1, x2, y2, 4, 4);
        }
      }
    }
  }

  private drawDashedLine(x1: number, y1: number, x2: number, y2: number, dashLen: number, gapLen: number): void {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len, uy = dy / len;
    let pos = 0;
    let drawing = true;
    while (pos < len) {
      const segLen = Math.min(drawing ? dashLen : gapLen, len - pos);
      if (drawing) {
        this.gfx.beginPath();
        this.gfx.moveTo(x1 + ux * pos, y1 + uy * pos);
        this.gfx.lineTo(x1 + ux * (pos + segLen), y1 + uy * (pos + segLen));
        this.gfx.strokePath();
      }
      pos += segLen;
      drawing = !drawing;
    }
  }

  destroy(): void { this.gfx.destroy(); }
}

// ── 농업 커서 업데이트 ────────────────────────────────────────
export function updateFarmingCursor(activeTool: string | null): void {
  const canvas = document.querySelector('canvas');
  if (!canvas) return;
  switch (activeTool) {
    case 'item_hoe':          canvas.style.cursor = 'crosshair'; break;
    case 'item_watering_can': canvas.style.cursor = 'cell';      break;
    default:                  canvas.style.cursor = 'default';   break;
  }
}
