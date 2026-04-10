export class LightningSystem {
  private overlay?: Phaser.GameObjects.Rectangle;
  private boltGfx?: Phaser.GameObjects.Graphics;

  create(scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    this.overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0xeeeeff, 0)
      .setScrollFactor(0).setDepth(75);

    this.boltGfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(74);
  }

  triggerStrike(scene: Phaser.Scene): void {
    if (!this.overlay || !this.boltGfx) return;

    scene.tweens.add({
      targets: this.overlay,
      alpha: 0.55,
      duration: 40, yoyo: true, repeat: 1,
      onComplete: () => {
        scene.time.delayedCall(80, () => {
          scene.tweens.add({
            targets: this.overlay,
            alpha: 0.3,
            duration: 30, yoyo: true,
          });
        });
      },
    });

    this.drawBolt(scene);

    scene.time.delayedCall(120, () => {
      scene.cameras.main.shake(300, 0.008);
    });
  }

  private drawBolt(scene: Phaser.Scene): void {
    if (!this.boltGfx) return;
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    const startX = W * 0.2 + Math.random() * W * 0.6;
    const endY   = H * (0.4 + Math.random() * 0.4);
    const segments = 8;
    const points: { x: number; y: number }[] = [{ x: startX, y: 0 }];

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      points.push({
        x: startX + (Math.random() - 0.5) * 50 * (1 - t),
        y: endY * t,
      });
    }

    this.boltGfx.clear();
    this.boltGfx.lineStyle(2, 0xeeeeff, 0.9);
    this.boltGfx.strokePoints(points, false);

    const bp = points[Math.floor(segments * 0.4)];
    this.boltGfx.lineStyle(1, 0xccccff, 0.5);
    this.boltGfx.beginPath();
    this.boltGfx.moveTo(bp.x, bp.y);
    this.boltGfx.lineTo(bp.x + (Math.random() - 0.5) * 60, bp.y + 80);
    this.boltGfx.strokePath();

    scene.time.delayedCall(180, () => this.boltGfx?.clear());
  }

  destroy(): void {
    this.overlay?.destroy();
    this.boltGfx?.destroy();
  }
}
