import Phaser from 'phaser';
import { TILE_SIZE } from '../world/MapGenerator';

interface IndoorConfig {
  darknessAlphaMultiplier: number;
  ambientColor: number;
  ambientAlpha: number;
}

const INDOOR_LIGHT_CONFIGS: Record<string, IndoorConfig> = {
  dark: {
    darknessAlphaMultiplier: 1.2,
    ambientColor: 0x100820,
    ambientAlpha: 0.0,
  },
  torch: {
    darknessAlphaMultiplier: 0.7,
    ambientColor: 0xff8820,
    ambientAlpha: 0.04,
  },
  campfire: {
    darknessAlphaMultiplier: 0.5,
    ambientColor: 0xff5010,
    ambientAlpha: 0.08,
  },
};

/**
 * 실내 조명 분위기 시스템.
 * 실내 진입 시 분위기 오버레이 + 천장 그림자 렌더링.
 */
export class IndoorLightingSystem {
  private ambientGfx: Phaser.GameObjects.Graphics;
  private ceilingShadowGfx: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.ambientGfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(46).setVisible(false);
    this.ceilingShadowGfx = scene.add.graphics()
      .setDepth(67).setVisible(false);
  }

  /**
   * 실내 상태에 따른 분위기 적용.
   * @param isIndoor 실내 여부
   * @param hasCampfire 실내 모닥불 여부
   * @param hasTorch 실내 횃불 여부
   * @param baseDarknessAlpha 현재 어둠 알파
   */
  applyIndoorAtmosphere(
    isIndoor: boolean,
    hasCampfire: boolean,
    hasTorch: boolean,
    baseDarknessAlpha: number,
  ): number {
    if (!isIndoor) {
      this.ambientGfx.setVisible(false);
      return baseDarknessAlpha;
    }

    const configKey = hasCampfire ? 'campfire' : hasTorch ? 'torch' : 'dark';
    const cfg = INDOOR_LIGHT_CONFIGS[configKey];

    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    this.ambientGfx.clear().setVisible(cfg.ambientAlpha > 0);
    if (cfg.ambientAlpha > 0) {
      this.ambientGfx.fillStyle(cfg.ambientColor, cfg.ambientAlpha);
      this.ambientGfx.fillRect(0, 0, W, H);
    }

    return baseDarknessAlpha * cfg.darknessAlphaMultiplier;
  }

  /**
   * 실내 천장 그림자 렌더링.
   * @param coveredTiles 지붕 아래 타일 좌표 집합 ("tx_ty")
   */
  drawCeilingShadow(coveredTiles: Set<string>): void {
    this.ceilingShadowGfx.clear();
    if (coveredTiles.size === 0) {
      this.ceilingShadowGfx.setVisible(false);
      return;
    }
    this.ceilingShadowGfx.setVisible(true);

    // 각 타일 경계 그림자 (4변)
    const steps = 4;
    for (const key of coveredTiles) {
      const [tx, ty] = key.split('_').map(Number);
      const x = tx * TILE_SIZE, y = ty * TILE_SIZE;
      const w = TILE_SIZE, h = TILE_SIZE;

      for (let i = 0; i < steps; i++) {
        const alpha = 0.12 * (1 - i / steps);
        this.ceilingShadowGfx.fillStyle(0x000000, alpha);
        this.ceilingShadowGfx.fillRect(x + i * 3, y + i * 3, w - i * 6, 3);            // 상단
        this.ceilingShadowGfx.fillRect(x + i * 3, y + h - (i + 1) * 3, w - i * 6, 3); // 하단
        this.ceilingShadowGfx.fillRect(x + i * 3, y + i * 3 + 3, 3, h - i * 6 - 6);   // 좌측
        this.ceilingShadowGfx.fillRect(x + w - (i + 1) * 3, y + i * 3 + 3, 3, h - i * 6 - 6); // 우측
      }
    }
  }

  destroy(): void {
    this.ambientGfx.destroy();
    this.ceilingShadowGfx.destroy();
  }
}
