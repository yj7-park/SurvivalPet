import Phaser from 'phaser';

export interface LightSource {
  id: string;
  x: number; y: number;  // world px
  radius: number;
  flicker: boolean;
  type: 'player_torch' | 'placed_torch' | 'player_body';
}

const FLICKER_AMP: Record<string, number> = {
  player_torch: 8,
  placed_torch: 6,
  player_body: 0,
};
const FLICKER_PERIOD: Record<string, number> = {
  player_torch: 1.5,
  placed_torch: 2.0,
  player_body: 1.0,
};

export class DarknessLayer {
  private rt: Phaser.GameObjects.RenderTexture;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const W = scene.scale.width;
    const H = scene.scale.height;
    this.rt = scene.add.renderTexture(0, 0, W, H)
      .setScrollFactor(0)
      .setDepth(45)
      .setOrigin(0, 0)
      .setVisible(false);
  }

  update(alpha: number, lights: LightSource[], camera: Phaser.Cameras.Scene2D.Camera, time: number): void {
    if (alpha <= 0) {
      this.rt.setVisible(false);
      return;
    }
    this.rt.setVisible(true);

    // Fill darkness
    this.rt.clear();
    this.rt.fill(0x000000, alpha);

    // Erase light holes (world → screen)
    for (const light of lights) {
      const sx = (light.x - camera.worldView.x) * camera.zoom;
      const sy = (light.y - camera.worldView.y) * camera.zoom;
      let r = light.radius * camera.zoom;

      if (light.flicker) {
        const amp = FLICKER_AMP[light.type] ?? 6;
        const period = FLICKER_PERIOD[light.type] ?? 2.0;
        const noise = (Math.random() - 0.5) * amp * 0.3;
        r += Math.sin((time / 1000) * (Math.PI * 2 / period)) * amp + noise;
        r = Math.max(0, r);
      }

      this.eraseLightCircle(sx, sy, r);
    }
  }

  private eraseLightCircle(cx: number, cy: number, r: number): void {
    // Multi-layer gradient erase: center fully erased → edge fades
    const gfx = this.scene.make.graphics({ x: 0, y: 0 });
    // Inner core: fully transparent (fully erased)
    gfx.fillStyle(0x000000, 1.0);
    gfx.fillCircle(cx, cy, r * 0.45);
    // Gradient rings
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      gfx.fillStyle(0x000000, 1.0 - i * (1.0 / (steps + 1)));
      gfx.fillCircle(cx, cy, r * (0.45 + i * (0.55 / steps)));
    }
    this.rt.erase(gfx, 0, 0);
    gfx.destroy();
  }

  destroy(): void {
    this.rt.destroy();
  }
}
