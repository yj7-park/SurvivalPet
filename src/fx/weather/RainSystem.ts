export class RainSystem {
  private emitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private splashEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  create(scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    this.emitter = scene.add.particles(0, 0, '__DEFAULT', {
      x:       { min: -40, max: W + 40 },
      y:       { min: -10, max: 0 },
      speedX:  { min: 40, max: 80 },
      speedY:  { min: 280, max: 420 },
      scale:   { start: 0.15, end: 0.08 },
      alpha:   { start: 0.6, end: 0.3 },
      lifespan: { min: 600, max: 900 },
      frequency: 8,
      quantity: 2,
      tint:    0x88aacc,
      rotate:  75,
      blendMode: Phaser.BlendModes.NORMAL,
    }).setScrollFactor(0).setDepth(70);

    this.splashEmitter = scene.add.particles(0, H - 16, '__DEFAULT', {
      x:       { min: 0, max: W },
      speedX:  { min: -20, max: 20 },
      speedY:  { min: -25, max: -8 },
      scale:   { start: 0.2, end: 0 },
      alpha:   { start: 0.5, end: 0 },
      lifespan: 250,
      frequency: 18,
      quantity: 1,
      tint:    0x9ab8d0,
      blendMode: Phaser.BlendModes.NORMAL,
    }).setScrollFactor(0).setDepth(70);
  }

  setIntensity(intensity: 'light' | 'moderate' | 'heavy'): void {
    const cfg: Record<string, { freq: number; qty: number }> = {
      light:    { freq: 12, qty: 1 },
      moderate: { freq: 6,  qty: 2 },
      heavy:    { freq: 3,  qty: 4 },
    };
    const { freq, qty } = cfg[intensity];
    this.emitter?.setFrequency(freq, qty);
    this.splashEmitter?.setFrequency(freq * 1.5, qty);
  }

  stop(scene: Phaser.Scene): void {
    const targets = [this.emitter, this.splashEmitter].filter(Boolean) as Phaser.GameObjects.Particles.ParticleEmitter[];
    scene.tweens.add({
      targets, alpha: 0, duration: 2000,
      onComplete: () => targets.forEach(t => t.destroy()),
    });
  }
}

export class WindowRainDrops {
  private drops: Array<{ x: number; y: number; vy: number; alpha: number }> = [];
  private canvas?: Phaser.GameObjects.RenderTexture;
  private scene?: Phaser.Scene;

  create(scene: Phaser.Scene, W: number, H: number): void {
    this.scene  = scene;
    this.canvas = scene.add.renderTexture(0, 0, W, H)
      .setScrollFactor(0).setDepth(72).setAlpha(0.35);

    for (let i = 0; i < 20; i++) {
      this.drops.push({
        x:     Math.random() * W,
        y:     Math.random() * H,
        vy:    0.3 + Math.random() * 0.5,
        alpha: 0.4 + Math.random() * 0.4,
      });
    }
    scene.events.on('update', this.update, this);
  }

  private update(): void {
    if (!this.canvas) return;
    this.canvas.clear();
    const W = this.canvas.width;
    const H = this.canvas.height;

    for (const d of this.drops) {
      d.y += d.vy;
      if (d.y > H + 10) { d.y = -10; d.x = Math.random() * W; }

      const gfx = this.canvas.scene.make.graphics({});
      gfx.fillStyle(0xaaccee, d.alpha);
      gfx.fillEllipse(d.x, d.y, 4, 6);
      this.canvas.draw(gfx, 0, 0);
      gfx.destroy();
    }
  }

  destroy(): void {
    if (this.scene) this.scene.events.off('update', this.update, this);
    this.canvas?.destroy();
  }
}
