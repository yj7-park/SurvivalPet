export class InteractionPrompt {
  private scene:     Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private keyLabel?:  Phaser.GameObjects.Text;
  private descText?:  Phaser.GameObjects.Text;
  private bobTween?:  Phaser.Tweens.Tween;
  private isVisible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._build();
  }

  private _build(): void {
    const keyBg = this.scene.add.graphics()
      .fillStyle(0x333355, 0.9)
      .fillRoundedRect(0, 0, 22, 18, 4)
      .lineStyle(1.5, 0x8888cc, 1)
      .strokeRoundedRect(0, 0, 22, 18, 4);

    this.keyLabel = this.scene.add.text(11, 9, 'F', {
      fontSize: '12px', fontFamily: 'monospace',
      color: '#ccccff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.descText = this.scene.add.text(28, 1, '', {
      fontSize: '12px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#dddddd',
    });

    this.container = this.scene.add.container(0, 0, [keyBg, this.keyLabel, this.descText])
      .setDepth(95).setScrollFactor(0).setAlpha(0);

    this.bobTween = this.scene.tweens.add({
      targets: this.container, y: '+=4',
      yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut',
      paused: true,
    });
  }

  show(worldX: number, worldY: number, key: string, desc: string): void {
    if (this.isVisible || !this.container || !this.keyLabel || !this.descText) return;
    this.isVisible = true;
    this.keyLabel.setText(key);
    this.descText.setText(desc);

    const cam = this.scene.cameras.main;
    const sx  = (worldX - cam.scrollX) - 25;
    const sy  = (worldY - cam.scrollY) - 40;
    this.container.setPosition(sx, sy);

    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 180 });
    this.bobTween?.resume();
  }

  updatePosition(worldX: number, worldY: number): void {
    if (!this.isVisible || !this.container) return;
    const cam = this.scene.cameras.main;
    this.container.setPosition(
      (worldX - cam.scrollX) - 25,
      (worldY - cam.scrollY) - 40,
    );
  }

  hide(): void {
    if (!this.isVisible || !this.container) return;
    this.isVisible = false;
    this.bobTween?.pause();
    this.scene.tweens.add({ targets: this.container, alpha: 0, duration: 120 });
  }

  destroy(): void {
    this.bobTween?.stop();
    this.container?.destroy();
  }
}
