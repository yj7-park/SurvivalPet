export class RepairAnimator {
  private hammerGfx?: Phaser.GameObjects.Graphics;
  private sparks?: Phaser.GameObjects.Particles.ParticleEmitter;
  private hitTimer?: Phaser.Time.TimerEvent;
  private benchX = 0;
  private benchY = 0;
  private scene?: Phaser.Scene;

  startRepair(scene: Phaser.Scene, benchX: number, benchY: number): void {
    this.scene  = scene;
    this.benchX = benchX;
    this.benchY = benchY;

    this.hammerGfx = scene.add.graphics().setDepth(36);
    this.drawHammer(-Math.PI / 4);

    this.hitTimer = scene.time.addEvent({
      delay: 600, loop: true,
      callback: () => this.strikeHammer(scene),
    });

    this.sparks = scene.add.particles(benchX, benchY - 4, '__DEFAULT', {
      speed:    { min: 30, max: 90 },
      angle:    { min: -120, max: -60 },
      scale:    { start: 0.6, end: 0 },
      lifespan: 350,
      tint:     [0xffaa00, 0xff6600, 0xffff66],
      blendMode: Phaser.BlendModes.ADD,
      frequency: -1,
    });
    this.sparks.setDepth(55);
  }

  private drawHammer(swingAngle: number): void {
    if (!this.hammerGfx) return;
    this.hammerGfx.clear();
    const hx = this.benchX - 8;
    const hy = this.benchY - 24;

    this.hammerGfx.lineStyle(2, 0x8B6914, 1);
    this.hammerGfx.beginPath();
    this.hammerGfx.moveTo(hx, hy);
    this.hammerGfx.lineTo(
      hx + 10 * Math.cos(swingAngle),
      hy + 10 * Math.sin(swingAngle)
    );
    this.hammerGfx.strokePath();

    this.hammerGfx.fillStyle(0x777777, 1);
    this.hammerGfx.fillRect(hx + 8, hy - 3, 10, 6);
  }

  private strikeHammer(scene: Phaser.Scene): void {
    const obj = { angle: -Math.PI / 4 };
    scene.tweens.add({
      targets: obj,
      angle:   Math.PI / 6,
      duration: 100, ease: 'Quad.easeIn',
      onUpdate: () => this.drawHammer(obj.angle),
      onComplete: () => {
        this.sparks?.explode(6);
        scene.cameras.main.shake(80, 0.003);

        scene.tweens.add({
          targets: obj,
          angle: -Math.PI / 4,
          duration: 300, ease: 'Quad.easeOut',
          onUpdate: () => this.drawHammer(obj.angle),
        });
      },
    });
  }

  stopRepair(): void {
    this.hitTimer?.remove();
    this.sparks?.destroy();
    this.hammerGfx?.destroy();
    this.hitTimer  = undefined;
    this.sparks    = undefined;
    this.hammerGfx = undefined;
  }
}

export function playRepairCompleteEffect(
  scene: Phaser.Scene,
  itemSprite: Phaser.GameObjects.Image
): void {
  const emitter = scene.add.particles(itemSprite.x, itemSprite.y, '__DEFAULT', {
    speed:    { min: 40, max: 80 },
    scale:    { start: 0.8, end: 0 },
    lifespan: 500, quantity: 10,
    tint:     [0xffffff, 0x88ddff, 0xaaaaff],
    blendMode: Phaser.BlendModes.ADD,
  });
  emitter.explode(10);
  scene.time.delayedCall(600, () => emitter.destroy());

  const txt = scene.add.text(itemSprite.x, itemSprite.y - 20, '수리 완료!', {
    fontSize: '11px', color: '#88ffaa',
    fontFamily: 'Courier New', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(itemSprite.depth + 5);

  scene.tweens.add({
    targets: txt,
    y: itemSprite.y - 42, alpha: 0,
    duration: 800, ease: 'Quad.easeOut',
    onComplete: () => txt.destroy(),
  });
}
