import Phaser from 'phaser';

export class ChatInputBox {
  private bg: Phaser.GameObjects.Graphics;
  private textObj: Phaser.GameObjects.Text;
  private cursor: Phaser.GameObjects.Graphics;
  private cursorBlink: Phaser.Tweens.Tween | null = null;
  private input = '';
  private active = false;
  private readonly originX: number;
  private readonly W = 320;
  private readonly H = 20;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const cam = scene.cameras.main;
    const px = 8;
    const py = cam.height - 144;
    this.originX = px + 4;

    this.bg = scene.add.graphics()
      .fillStyle(0x0a0805, 0.85)
      .fillRect(px, py, this.W, this.H)
      .setScrollFactor(0)
      .setDepth(87)
      .setVisible(false);

    this.textObj = scene.add.text(this.originX, py + 5, '> ',
      { fontSize: '9px', fontFamily: 'Courier New', color: '#e8d8b0' }
    ).setScrollFactor(0).setDepth(87).setVisible(false);

    const cx = px + 4 + 14;
    this.cursor = scene.add.graphics()
      .fillStyle(0xe8d8b0, 1.0)
      .fillRect(cx, py + 4, 1, 11)
      .setScrollFactor(0)
      .setDepth(87)
      .setVisible(false);
  }

  activate(): void {
    this.active = true;
    this.input = '';
    this.bg.setVisible(true).setAlpha(0);
    this.textObj.setVisible(true).setText('> ');
    this.cursor.setVisible(true);

    this.scene.tweens.add({ targets: this.bg, alpha: 1, duration: 120 });

    this.cursorBlink = this.scene.tweens.add({
      targets: this.cursor,
      alpha: { from: 1, to: 0 },
      duration: 500, yoyo: true, repeat: -1
    });
  }

  deactivate(): void {
    this.active = false;
    this.cursorBlink?.stop();
    this.cursor.setVisible(false);
    this.scene.tweens.add({
      targets: this.bg, alpha: 0, duration: 150,
      onComplete: () => {
        this.bg.setVisible(false);
        this.textObj.setVisible(false);
      }
    });
  }

  handleKey(key: string): string | null {
    if (!this.active) return null;
    if (key === 'Enter') {
      const msg = this.input.trim();
      if (msg) {
        this.playSendAnimation();
        this.input = '';
        return msg;
      }
      this.deactivate();
      return null;
    }
    if (key === 'Escape') {
      this.deactivate();
      return null;
    }
    if (key === 'Backspace') {
      this.input = this.input.slice(0, -1);
    } else if (key.length === 1) {
      this.input += key;
    }
    this.textObj.setText(`> ${this.input}`);
    return null;
  }

  private playSendAnimation(): void {
    this.scene.tweens.add({
      targets: this.textObj,
      x: this.textObj.x + 20, alpha: 0,
      duration: 150,
      onComplete: () => {
        this.textObj.setText('> ').setX(this.originX).setAlpha(1);
      }
    });
  }

  isActive(): boolean { return this.active; }

  destroy(): void {
    this.cursorBlink?.stop();
    this.bg.destroy();
    this.textObj.destroy();
    this.cursor.destroy();
  }
}
