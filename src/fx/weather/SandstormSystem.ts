export class SandstormSystem {
  private particles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private overlay?: Phaser.GameObjects.Rectangle;
  private dustGfx?: Phaser.GameObjects.Graphics;

  create(scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    this.overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0xc8a050, 0)
      .setScrollFactor(0).setDepth(72);
    scene.tweens.add({ targets: this.overlay, alpha: 0.22, duration: 3000 });

    this.particles = scene.add.particles(0, 0, '__DEFAULT', {
      x:       { min: -20, max: 0 },
      y:       { min: 0, max: H },
      speedX:  { min: 350, max: 550 },
      speedY:  { min: -30, max: 30 },
      scale:   { start: 0.35, end: 0.05 },
      alpha:   { start: 0.5, end: 0 },
      lifespan: { min: 600, max: 1000 },
      frequency: 5,
      quantity: 3,
      tint:    [0xd4a060, 0xc89040, 0xe0b870],
      blendMode: Phaser.BlendModes.NORMAL,
    }).setScrollFactor(0).setDepth(73);

    this.dustGfx = scene.add.graphics().setScrollFactor(0).setDepth(71);
    this.animateDustClouds(scene, W, H);
  }

  private animateDustClouds(scene: Phaser.Scene, W: number, H: number): void {
    for (let i = 0; i < 4; i++) {
      const cloud = { x: -120, y: H * (0.2 + i * 0.2), w: 80 + i * 30, h: 30 + i * 10 };
      const dustGfx = this.dustGfx!;

      scene.tweens.add({
        targets: cloud,
        x: W + 120,
        duration: 3000 + i * 500,
        repeat: -1,
        delay: i * 800,
        onUpdate: () => {
          dustGfx.clear();
          dustGfx.fillStyle(0xc8a050, 0.12);
          dustGfx.fillEllipse(cloud.x, cloud.y, cloud.w, cloud.h);
        },
      });
    }
  }

  stop(scene: Phaser.Scene): void {
    const targets = [this.overlay, this.particles].filter(Boolean) as Phaser.GameObjects.GameObject[];
    scene.tweens.add({
      targets, alpha: 0, duration: 3000,
      onComplete: () => {
        this.particles?.destroy();
        this.overlay?.destroy();
        this.dustGfx?.destroy();
      },
    });
  }
}
