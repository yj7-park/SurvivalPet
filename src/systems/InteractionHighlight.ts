import Phaser from 'phaser';

export class InteractionHighlight {
  private outlineGfx: Phaser.GameObjects.Graphics | null = null;
  private keyHint: Phaser.GameObjects.Text | null = null;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  showHighlight(target: Phaser.GameObjects.Image, interactKey = 'E'): void {
    const x = target.x;
    const y = target.y;
    const w = target.displayWidth;
    const h = target.displayHeight;
    const depth = target.depth + 0.5;

    this.outlineGfx?.destroy();
    this.outlineGfx = this.scene.add.graphics().setDepth(depth);
    this.outlineGfx.lineStyle(2, 0xf0c030, 1.0);
    this.outlineGfx.strokeRect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);

    this.scene.tweens.add({
      targets: this.outlineGfx,
      alpha: { from: 1.0, to: 0.3 },
      duration: 600, yoyo: true, repeat: -1
    });

    this.keyHint?.destroy();
    this.keyHint = this.scene.add.text(x, y - h / 2 - 14, `[${interactKey}]`, {
      fontSize: '9px', fontFamily: 'Courier New',
      color: '#f0c030', stroke: '#000000', strokeThickness: 2
    }).setDepth(depth + 0.1).setOrigin(0.5);
  }

  hideHighlight(): void {
    this.outlineGfx?.destroy();
    this.outlineGfx = null;
    this.keyHint?.destroy();
    this.keyHint = null;
  }

  destroy(): void {
    this.hideHighlight();
  }
}
