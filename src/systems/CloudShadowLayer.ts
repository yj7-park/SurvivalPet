import { CloudInstance } from './CloudLayerSystem';

export class CloudShadowLayer {
  private shadowGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.shadowGfx = scene.add.graphics()
      .setDepth(4)
      .setScrollFactor(1);
  }

  update(clouds: CloudInstance[], cam: Phaser.Cameras.Scene2D.Camera): void {
    this.shadowGfx.clear();

    clouds.forEach(cloud => {
      if (cloud.tint === 'storm') return;

      const shadowX = cam.scrollX + cloud.x + 30;
      const shadowY = cam.scrollY + 120 + cloud.layer * 40;
      const w = (cloud.type === 'cumulus_large' ? 120 : 64) * cloud.scale;
      const h = w * 0.25;

      this.shadowGfx.fillStyle(0x000000, 0.06 * cloud.alpha);
      this.shadowGfx.fillEllipse(shadowX, shadowY, w, h);
    });
  }

  destroy(): void {
    this.shadowGfx.destroy();
  }
}
