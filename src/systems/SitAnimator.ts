import Phaser from 'phaser';

export interface ChairData {
  worldX: number;
  worldY: number;
  facing: 'up' | 'down' | 'left' | 'right';
}

export class SitAnimator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  sit(playerSprite: Phaser.GameObjects.Sprite, chair: ChairData): void {
    const texKey = `char_sit_${chair.facing}`;
    if (this.scene.textures.exists(texKey)) {
      playerSprite.setTexture(texKey);
    }

    this.scene.tweens.add({
      targets: playerSprite,
      scaleY: 0.85,
      duration: 150, ease: 'Quad.easeOut'
    });

    this.scene.tweens.add({
      targets: playerSprite,
      y: chair.worldY + 8,
      duration: 100
    });
  }

  stand(playerSprite: Phaser.GameObjects.Sprite): void {
    this.scene.tweens.add({
      targets: playerSprite,
      scaleY: 1.0,
      duration: 150, ease: 'Back.easeOut'
    });
    if (this.scene.textures.exists('char_idle')) {
      playerSprite.setTexture('char_idle');
    }
  }
}
