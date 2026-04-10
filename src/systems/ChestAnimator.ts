import Phaser from 'phaser';

export class ChestAnimator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  open(chestSprite: Phaser.GameObjects.Image): void {
    chestSprite.setTexture('chest_wood_open');

    this.scene.tweens.add({
      targets: chestSprite,
      scaleY: [1.0, 0.85, 1.0],
      duration: 200, ease: 'Quad.easeOut'
    });

    const emitter = this.scene.add.particles(chestSprite.x, chestSprite.y - 8, 'fx_pixel', {
      tint:     [0xd0b080, 0xe8d090, 0xc0a060],
      speed:    { min: 20, max: 50 },
      angle:    { min: -150, max: -30 },
      scale:    { start: 0.8, end: 0 },
      lifespan: 400, quantity: 5, emitting: false
    });
    emitter.setDepth(chestSprite.depth + 1);
    emitter.explode(5);
    this.scene.time.delayedCall(500, () => emitter.destroy());

    this.scene.time.delayedCall(100, () => {
      const sparkle = this.scene.add.graphics()
        .setPosition(chestSprite.x, chestSprite.y - 4)
        .setDepth(chestSprite.depth + 2);
      sparkle.fillStyle(0xf0c030, 0.8).fillCircle(0, 0, 4);
      this.scene.tweens.add({
        targets: sparkle, alpha: 0, scaleX: 2.5, scaleY: 2.5,
        duration: 300,
        onComplete: () => sparkle.destroy()
      });
    });
  }

  close(chestSprite: Phaser.GameObjects.Image): void {
    this.scene.tweens.add({
      targets: chestSprite,
      scaleY: [1.0, 1.1, 1.0],
      duration: 150, ease: 'Quad.easeIn',
      onComplete: () => chestSprite.setTexture('chest_wood')
    });
  }
}
