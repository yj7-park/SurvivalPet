export class FogWeatherSystem {
  private fogLayers: Phaser.GameObjects.RenderTexture[] = [];
  private listeners: Array<() => void> = [];
  private scene?: Phaser.Scene;

  create(scene: Phaser.Scene, density: 'light' | 'thick' = 'light'): void {
    this.scene = scene;
    const W     = scene.cameras.main.width;
    const H     = scene.cameras.main.height;
    const alpha = density === 'thick' ? 0.45 : 0.22;

    for (let i = 0; i < 2; i++) {
      const rt = scene.add.renderTexture(0, 0, W, H)
        .setScrollFactor(0)
        .setDepth(68 + i)
        .setAlpha(0);

      const gfx = scene.make.graphics({});
      gfx.fillStyle(0xc0ccd8, 1);
      for (let j = 0; j < 12; j++) {
        gfx.fillEllipse(
          Math.random() * W, Math.random() * H,
          80 + Math.random() * 160,
          40 + Math.random() * 80
        );
      }
      rt.draw(gfx, 0, 0);
      gfx.destroy();

      scene.tweens.add({ targets: rt, alpha, duration: 4000 });
      this.fogLayers.push(rt);

      const speed = (i + 1) * 0.12;
      const fn = (_t: number, delta: number): void => {
        rt.x -= speed * (delta / 16.67);
        if (rt.x < -W) rt.x = 0;
      };
      this.listeners.push(fn as () => void);
      scene.events.on('update', fn);
    }
  }

  stop(scene: Phaser.Scene): void {
    this.listeners.forEach(fn => scene.events.off('update', fn));
    this.listeners = [];

    scene.tweens.add({
      targets: this.fogLayers,
      alpha: 0, duration: 3000,
      onComplete: () => {
        this.fogLayers.forEach(l => l.destroy());
        this.fogLayers = [];
      },
    });
  }
}
