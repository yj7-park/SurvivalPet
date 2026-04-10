import Phaser from 'phaser';

export class WaterCharacterMask {
  private upperBody: Phaser.GameObjects.Sprite | null = null;
  private lowerBody: Phaser.GameObjects.Sprite | null = null;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  enterWater(charSprite: Phaser.GameObjects.Sprite): void {
    charSprite.setVisible(false);

    const half = charSprite.height / 2;

    this.upperBody = this.scene.add.sprite(charSprite.x, charSprite.y, charSprite.texture.key)
      .setCrop(0, 0, charSprite.width, half)
      .setDepth(35);

    this.lowerBody = this.scene.add.sprite(charSprite.x, charSprite.y, charSprite.texture.key)
      .setCrop(0, half, charSprite.width, half)
      .setAlpha(0.55)
      .setTint(0x80c0f0)
      .setDepth(8);

    this.scene.tweens.add({
      targets: this.lowerBody,
      x: charSprite.x + 2,
      duration: 600, ease: 'Sine.easeInOut',
      yoyo: true, repeat: -1
    });
  }

  update(x: number, y: number): void {
    this.upperBody?.setPosition(x, y);
    this.lowerBody?.setPosition(x, y);
  }

  exitWater(charSprite: Phaser.GameObjects.Sprite): void {
    charSprite.setVisible(true);
    this.upperBody?.destroy(); this.upperBody = null;
    this.lowerBody?.destroy(); this.lowerBody = null;
  }

  isActive(): boolean {
    return this.upperBody !== null;
  }
}
