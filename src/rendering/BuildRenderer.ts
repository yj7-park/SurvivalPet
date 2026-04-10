import Phaser from 'phaser';

/** Handles build-time chip particles, completion effects, and preview grid. */
export class BuildRenderer {
  constructor(private scene: Phaser.Scene) {}

  /** Call once per second during active construction (at structure world pos). */
  spawnBuildParticles(x: number, y: number, material: 'wood' | 'stone'): void {
    const tints: number[] = material === 'wood'
      ? [0xc8884a, 0xa06030, 0xe0aa6a]
      : [0x909090, 0x707070, 0xb0b0b0];

    for (let i = 0; i < 3; i++) {
      const chip = this.scene.add.rectangle(
        x + Phaser.Math.Between(-8, 8),
        y + Phaser.Math.Between(-8, 8),
        Phaser.Math.Between(2, 5),
        Phaser.Math.Between(2, 4),
        tints[Math.floor(Math.random() * tints.length)],
      ).setDepth(y + 2);

      this.scene.tweens.add({
        targets: chip,
        x: chip.x + Phaser.Math.Between(-20, 20),
        y: chip.y - Phaser.Math.Between(10, 25),
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        duration: Phaser.Math.Between(300, 500),
        ease: 'Quad.easeOut',
        onComplete: () => chip.destroy(),
      });
    }

    // Impact ring
    const ring = this.scene.add.graphics().setDepth(y + 3);
    ring.lineStyle(1, material === 'wood' ? 0xc8884a : 0x909090, 0.6);
    ring.strokeCircle(x, y, 4);
    this.scene.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** Call when a structure is fully built. */
  playBuildCompleteEffect(x: number, y: number): void {
    // 8 golden stars radially
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const star = this.scene.add.star(x, y, 4, 2, 5, 0xffd060)
        .setAlpha(0.9).setDepth(y + 5);
      this.scene.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * 35,
        y: y + Math.sin(angle) * 35 - 10,
        alpha: 0,
        scale: 0,
        duration: 500,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy(),
      });
    }

    // Golden ring expand
    const ring = this.scene.add.graphics().setDepth(y + 6);
    ring.lineStyle(2, 0xffd060, 0.8);
    ring.strokeCircle(x, y, 4);
    this.scene.tweens.add({
      targets: ring,
      scale: 5,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    // "건설 완료!" text
    const text = this.scene.add.text(x, y - 20, '건설 완료!', {
      fontSize: '11px', fontFamily: 'Courier New',
      color: '#ffd060', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(80);
    this.scene.tweens.add({
      targets: text,
      y: text.y - 20,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  destroy(): void {}
}
