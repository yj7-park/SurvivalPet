import Phaser from 'phaser';
import type { LightSource } from '../ui/DarknessLayer';

const LIGHT_WARM_COLORS: Record<string, { color: number; alpha: number }> = {
  player_torch: { color: 0xff8820, alpha: 0.18 },
  placed_torch: { color: 0xff7010, alpha: 0.20 },
  campfire:     { color: 0xff5010, alpha: 0.25 },
  player_body:  { color: 0x8899cc, alpha: 0.06 },
};

/**
 * 광원 따뜻한 색상 틴트 레이어 (ADD 블렌드, depth 49).
 * DarknessLayer(depth 50) 바로 아래에서 따뜻한 주황빛 오버레이.
 */
export class WarmLightLayer {
  private rt: Phaser.GameObjects.RenderTexture;

  constructor(private scene: Phaser.Scene) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    this.rt = scene.add.renderTexture(0, 0, W, H)
      .setScrollFactor(0)
      .setDepth(49)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
  }

  update(lights: LightSource[], cam: Phaser.Cameras.Scene2D.Camera, darknessAlpha: number): void {
    if (darknessAlpha <= 0 || lights.length === 0) {
      this.rt.setVisible(false);
      return;
    }
    this.rt.setVisible(true);
    this.rt.clear();

    for (const light of lights) {
      const cfg = LIGHT_WARM_COLORS[light.type] ?? { color: 0xff8820, alpha: 0.15 };
      const sx = (light.x - cam.worldView.x) * cam.zoom;
      const sy = (light.y - cam.worldView.y) * cam.zoom;
      const r  = light.radius * cam.zoom;

      // 방사형 그라디언트 (5단계)
      const gfx = this.scene.make.graphics({ x: 0, y: 0 });
      const steps = 5;
      for (let i = 0; i < steps; i++) {
        const ratio  = (steps - i) / steps;
        const stepA  = cfg.alpha * ratio * ratio * darknessAlpha;
        gfx.fillStyle(cfg.color, stepA);
        gfx.fillCircle(sx, sy, r * (i + 1) / steps);
      }
      this.rt.draw(gfx, 0, 0);
      gfx.destroy();
    }
  }

  destroy(): void { this.rt.destroy(); }
}
