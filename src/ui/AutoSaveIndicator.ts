function drawSaveSpinner(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  r: number,
  angle: number
): void {
  gfx.lineStyle(1.5, 0x88cc88, 0.9);
  gfx.beginPath();
  gfx.arc(cx, cy, r, angle, angle + Math.PI * 1.5, false);
  gfx.strokePath();

  const ax = cx + Math.cos(angle) * r;
  const ay = cy + Math.sin(angle) * r;
  const headAngle = angle - Math.PI / 2;
  gfx.fillStyle(0x88cc88, 0.9);
  gfx.fillTriangle(
    ax + Math.cos(headAngle) * 4,       ay + Math.sin(headAngle) * 4,
    ax + Math.cos(headAngle + 2.4) * 3, ay + Math.sin(headAngle + 2.4) * 3,
    ax + Math.cos(headAngle - 2.4) * 3, ay + Math.sin(headAngle - 2.4) * 3
  );
}

export { drawSaveSpinner };

export class AutoSaveIndicator {
  private icon:      Phaser.GameObjects.Graphics;
  private label:     Phaser.GameObjects.Text;
  private spinAngle  = 0;
  private state: 'idle' | 'saving' | 'done' = 'idle';
  private scene:     Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    this.icon = scene.add.graphics()
      .setScrollFactor(0).setDepth(85).setAlpha(0);

    this.label = scene.add.text(
      W - 16, H - 12,
      '저장됨',
      { fontSize: '9px', color: '#88cc88', fontFamily: 'Courier New' }
    ).setOrigin(1, 1).setScrollFactor(0).setDepth(85).setAlpha(0);

    scene.events.on('update', this.onUpdate, this);
  }

  startSaving(): void {
    this.state = 'saving';
    this.icon.setAlpha(1);
    this.label.setAlpha(0);
  }

  doneSaving(): void {
    this.state = 'done';
    this.spinAngle = 0;
    this.icon.clear();

    this.label.setAlpha(1);
    this.scene.tweens.add({
      targets: [this.label, this.icon],
      alpha: 0,
      delay: 2000,
      duration: 600,
      onComplete: () => { this.state = 'idle'; },
    });
  }

  private onUpdate(_time: number, delta: number): void {
    if (this.state !== 'saving') return;
    this.spinAngle += delta * 0.004;
    const W  = this.scene.cameras.main.width;
    const H  = this.scene.cameras.main.height;
    const cx = W - 28;
    const cy = H - 12;
    this.icon.clear();
    drawSaveSpinner(this.icon, cx, cy, 8, this.spinAngle);
  }

  destroy(): void {
    this.scene.events.off('update', this.onUpdate, this);
    this.icon.destroy();
    this.label.destroy();
  }
}
