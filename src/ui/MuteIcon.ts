import Phaser from 'phaser';

export class MuteIcon {
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(isMuted: boolean, volume = 1.0): void {
    const cam = this.scene.cameras.main;
    const x = cam.width - 28;
    const y = cam.height - 28;

    this.gfx?.destroy();
    this.gfx = this.scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(88);

    if (isMuted) {
      this.gfx.fillStyle(0xe04040, 0.85);
      this.gfx.fillRect(x, y + 4, 5, 8);
      this.gfx.fillTriangle(x + 5, y + 1, x + 5, y + 15, x + 11, y + 8);
      this.gfx.lineStyle(2, 0xe04040, 1.0);
      this.gfx.lineBetween(x + 13, y + 4, x + 17, y + 12);
      this.gfx.lineBetween(x + 17, y + 4, x + 13, y + 12);

      this.gfx.setAlpha(0);
      this.scene.tweens.add({ targets: this.gfx, alpha: 0.85, duration: 300 });
    } else {
      this.drawSpeakerWaves(x, y, volume);
    }
  }

  private drawSpeakerWaves(x: number, y: number, vol: number): void {
    if (!this.gfx) return;
    const arcs = vol > 0.6 ? 3 : vol > 0.3 ? 2 : 1;
    this.gfx.lineStyle(1.5, 0xc8b88a, 0.7);
    for (let i = 0; i < arcs; i++) {
      const r = 5 + i * 4;
      this.gfx.beginPath();
      this.gfx.arc(x + 10, y + 8, r, -0.6, 0.6);
      this.gfx.strokePath();
    }
  }

  hide(): void {
    this.gfx?.destroy();
    this.gfx = null;
  }

  destroy(): void {
    this.hide();
  }
}
