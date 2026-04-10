export class SnowSystem {
  private flakes?: Phaser.GameObjects.Particles.ParticleEmitter;
  private accumGfx?: Phaser.GameObjects.Graphics;

  create(scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    this.flakes = scene.add.particles(0, 0, '__DEFAULT', {
      x:       { min: -20, max: W + 20 },
      y:       { min: -10, max: 0 },
      speedX:  { min: -15, max: 15 },
      speedY:  { min: 40, max: 90 },
      scale:   { start: 0.3, end: 0.1 },
      alpha:   { start: 0.85, end: 0.4 },
      lifespan: { min: 3000, max: 5000 },
      frequency: 15,
      quantity: 1,
      tint:    0xddeeff,
      accelerationX: { min: -10, max: 10 },
      rotate:  { min: 0, max: 360 },
      blendMode: Phaser.BlendModes.NORMAL,
    }).setScrollFactor(0).setDepth(70);

    this.accumGfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(71).setAlpha(0);

    this.growAccumulation(scene, W, H);
  }

  private growAccumulation(scene: Phaser.Scene, W: number, H: number): void {
    const state = { t: 0 };
    const accum = this.accumGfx!;
    scene.tweens.add({
      targets: state, t: 1,
      duration: 60000,
      onUpdate: () => {
        const thickness = state.t * 8;
        accum.clear();
        if (thickness > 0.5) {
          accum.setAlpha(0.7);
          accum.fillStyle(0xeef4ff, 1);
          accum.fillRect(0, H - Math.round(thickness), W, Math.round(thickness));
        }
      },
    });
  }

  stop(): void {
    this.flakes?.destroy();
    this.accumGfx?.destroy();
  }
}
