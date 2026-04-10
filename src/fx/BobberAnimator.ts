export class BobberAnimator {
  private bobGfx?:    Phaser.GameObjects.Graphics;
  private rippleGfx?: Phaser.GameObjects.Graphics;
  private phase  = 0;
  private state: 'idle' | 'bite' | 'pulling' = 'idle';
  private alertTimer?: Phaser.Time.TimerEvent;
  private alertText?:  Phaser.GameObjects.Text;
  private scene?: Phaser.Scene;
  worldX = 0;
  worldY = 0;

  create(scene: Phaser.Scene, wx: number, wy: number): void {
    this.scene    = scene;
    this.worldX   = wx;
    this.worldY   = wy;
    this.bobGfx   = scene.add.graphics().setDepth(57);
    this.rippleGfx = scene.add.graphics().setDepth(56);
    scene.events.on('update', this.onUpdate, this);
  }

  private onUpdate(_time: number, delta: number): void {
    this.phase += delta * 0.003;
    const bobOffset = this.state === 'bite'
      ? Math.sin(this.phase * 8) * 5
      : Math.sin(this.phase)     * 2;

    const y = this.worldY + bobOffset;
    this.bobGfx?.clear();
    if (this.bobGfx) this.drawBobber(this.worldX, y);

    if (Math.floor(this.phase * 2) % 3 === 0) {
      if (this.rippleGfx) this.drawSmallRipple(this.worldX, this.worldY);
    }
  }

  private drawBobber(x: number, y: number): void {
    const g = this.bobGfx!;
    g.fillStyle(0xff3333, 1);
    g.fillCircle(x, y + 2, 4);
    g.fillStyle(0xeeeeee, 1);
    g.fillCircle(x, y - 2, 4);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(x - 1, y - 3, 1.5);
    g.fillStyle(0xff3333, 0.3);
    g.fillCircle(x, y + 5, 3);
  }

  private drawSmallRipple(x: number, y: number): void {
    const r     = 6 + (this.phase % 1) * 8;
    const alpha = 0.4 - (this.phase % 1) * 0.4;
    this.rippleGfx!.clear();
    this.rippleGfx!.lineStyle(1, 0x88ccee, alpha);
    this.rippleGfx!.strokeEllipse(x, y, r * 2, r * 0.6);
  }

  setBite(scene: Phaser.Scene): void {
    this.state = 'bite';
    this.alertText = scene.add.text(
      this.worldX, this.worldY - 24, '!',
      {
        fontSize: '18px', color: '#ffff00',
        fontFamily: 'Courier New', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 3,
      }
    ).setOrigin(0.5).setDepth(60);

    scene.tweens.add({
      targets: this.alertText,
      scaleX: 1.4, scaleY: 1.4,
      duration: 150, yoyo: true, repeat: -1,
    });

    this.alertTimer = scene.time.delayedCall(3000, () => {
      this.alertText?.destroy();
      this.alertText = undefined;
    });
  }

  clearBite(): void {
    this.state = 'idle';
    this.alertText?.destroy();
    this.alertText = undefined;
    this.alertTimer?.remove();
  }

  moveTo(x: number, y: number): void {
    this.worldX = x;
    this.worldY = y;
  }

  destroy(): void {
    if (this.scene) this.scene.events.off('update', this.onUpdate, this);
    this.alertText?.destroy();
    this.alertTimer?.remove();
    this.bobGfx?.destroy();
    this.rippleGfx?.destroy();
  }
}
