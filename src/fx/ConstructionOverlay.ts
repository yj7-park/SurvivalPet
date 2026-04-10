export class ConstructionOverlay {
  private scaffoldGfx?:   Phaser.GameObjects.Graphics;
  private progressBar?:   Phaser.GameObjects.Graphics;
  private progressLabel?: Phaser.GameObjects.Text;
  private dustTimer?:     Phaser.Time.TimerEvent;
  private tileX = 0;
  private tileY = 0;
  private tileW = 1;

  create(
    scene: Phaser.Scene,
    tileX: number, tileY: number,
    tileW: number, tileH: number
  ): void {
    this.tileX = tileX;
    this.tileY = tileY;
    this.tileW = tileW;

    const px = tileX * 32, py = tileY * 32;
    const pw = tileW * 32, ph = tileH * 32;

    this.scaffoldGfx = scene.add.graphics().setDepth(36);
    this.drawScaffolding(px, py, pw, ph);

    this.progressBar = scene.add.graphics().setDepth(38);
    this.progressLabel = scene.add.text(
      px + pw / 2, py - 18, '0%',
      { fontSize: '9px', color: '#ffdd88', fontFamily: 'Courier New' }
    ).setOrigin(0.5, 1).setDepth(38);

    this.dustTimer = scene.time.addEvent({
      delay: 800, loop: true,
      callback: () => this.spawnDust(scene, px + pw / 2, py + ph / 2),
    });
  }

  update(progress: number): void {
    if (!this.progressBar || !this.progressLabel || !this.scaffoldGfx) return;
    const px  = this.tileX * 32;
    const py  = this.tileY * 32;
    const pw  = this.tileW * 32;
    const barW = pw - 8;

    this.progressBar.clear();
    this.progressBar.fillStyle(0x222222, 0.8);
    this.progressBar.fillRoundedRect(px + 4, py - 12, barW, 6, 2);
    this.progressBar.fillStyle(0xf0c030, 1);
    this.progressBar.fillRoundedRect(px + 4, py - 12, barW * progress, 6, 2);
    this.progressLabel.setText(`${Math.round(progress * 100)}%`);
    this.scaffoldGfx.setAlpha(1 - progress * 0.8);
  }

  private drawScaffolding(px: number, py: number, pw: number, ph: number): void {
    if (!this.scaffoldGfx) return;
    this.scaffoldGfx.lineStyle(1, 0xc8a050, 0.7);
    for (let x = px; x <= px + pw; x += 32) {
      this.scaffoldGfx.beginPath();
      this.scaffoldGfx.moveTo(x, py);
      this.scaffoldGfx.lineTo(x, py + ph);
      this.scaffoldGfx.strokePath();
    }
    for (let y = py; y <= py + ph; y += 16) {
      this.scaffoldGfx.beginPath();
      this.scaffoldGfx.moveTo(px, y);
      this.scaffoldGfx.lineTo(px + pw, y);
      this.scaffoldGfx.strokePath();
    }
    this.scaffoldGfx.lineStyle(1, 0xc8a050, 0.4);
    this.scaffoldGfx.beginPath();
    this.scaffoldGfx.moveTo(px, py);
    this.scaffoldGfx.lineTo(px + pw, py + ph);
    this.scaffoldGfx.strokePath();
  }

  private spawnDust(scene: Phaser.Scene, cx: number, cy: number): void {
    const emitter = scene.add.particles(
      cx + (Math.random() - 0.5) * 20,
      cy + (Math.random() - 0.5) * 20,
      '__DEFAULT', {
        speed:   { min: 8, max: 25 },
        scale:   { start: 0.4, end: 0 },
        alpha:   { start: 0.35, end: 0 },
        lifespan: 600, quantity: 2,
        tint:    0xc8b090,
      }
    ).setDepth(37);
    emitter.explode(2);
    scene.time.delayedCall(700, () => emitter.destroy());
  }

  destroy(): void {
    this.dustTimer?.remove();
    this.scaffoldGfx?.destroy();
    this.progressBar?.destroy();
    this.progressLabel?.destroy();
  }
}
