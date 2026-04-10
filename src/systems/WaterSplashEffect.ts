import Phaser from 'phaser';

export function playWaterEntry(scene: Phaser.Scene, x: number, y: number): void {
  [0, 120].forEach(delay => {
    scene.time.delayedCall(delay, () => {
      const gfx = scene.add.graphics().setDepth(12);
      const obj = { r: 0, a: 0.6 };
      scene.tweens.add({
        targets: obj, r: 28, a: 0,
        duration: 500, ease: 'Quad.easeOut',
        onUpdate: () => {
          gfx.clear();
          gfx.lineStyle(1.5, 0x80ccff, obj.a);
          gfx.strokeEllipse(x, y, obj.r * 2, obj.r * 0.6);
        },
        onComplete: () => gfx.destroy()
      });
    });
  });

  const emitter = scene.add.particles(x, y, 'fx_pixel', {
    tint:     [0x60b8f0, 0x90d0ff, 0xaaddff],
    speed:    { min: 40, max: 100 },
    angle:    { min: -140, max: -40 },
    gravityY: 180,
    scale:    { start: 1.2, end: 0 },
    alpha:    { start: 0.9, end: 0 },
    lifespan: { min: 300, max: 600 },
    quantity: 8, emitting: false
  });
  emitter.setDepth(13);
  emitter.explode(8);
  scene.time.delayedCall(700, () => emitter.destroy());
}

export function playWaterExit(scene: Phaser.Scene, x: number, y: number): void {
  for (let i = 0; i < 5; i++) {
    const dx = Phaser.Math.Between(-10, 10);
    const drop = scene.add.graphics()
      .fillStyle(0x60b8f0, 0.7)
      .fillRect(0, 0, 2, 4)
      .setPosition(x + dx, y - 12)
      .setDepth(35);

    scene.tweens.add({
      targets: drop,
      y: drop.y + 20,
      alpha: 0,
      duration: 400 + i * 60,
      delay: i * 50,
      ease: 'Quad.easeIn',
      onComplete: () => drop.destroy()
    });
  }

  playWaterEntry(scene, x, y + 4);
}

export class WaterWalkRipples {
  private stepTimer = 0;
  private readonly STEP_INTERVAL = 350;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(playerX: number, playerY: number, isInWater: boolean, delta: number): void {
    if (!isInWater) { this.stepTimer = 0; return; }

    this.stepTimer += delta;
    if (this.stepTimer >= this.STEP_INTERVAL) {
      this.stepTimer = 0;
      this.spawnStepRipple(playerX, playerY);
    }
  }

  private spawnStepRipple(x: number, y: number): void {
    const gfx = this.scene.add.graphics().setDepth(12);
    const obj = { r: 2, a: 0.5 };
    this.scene.tweens.add({
      targets: obj, r: 14, a: 0,
      duration: 350, ease: 'Quad.easeOut',
      onUpdate: () => {
        gfx.clear();
        gfx.lineStyle(1, 0x80ccff, obj.a);
        gfx.strokeEllipse(x, y, obj.r * 2, obj.r * 0.5);
      },
      onComplete: () => gfx.destroy()
    });
  }
}
