interface WindLine {
  x: number; y: number; len: number; vy: number; alpha: number; life: number;
}

export class WindLineSystem {
  private lines: WindLine[] = [];
  private gfx?: Phaser.GameObjects.Graphics;
  private strength = 0;
  private scene?: Phaser.Scene;
  private updateFn?: (t: number, delta: number) => void;

  create(scene: Phaser.Scene): void {
    this.scene = scene;
    this.gfx   = scene.add.graphics().setScrollFactor(0).setDepth(69);

    this.updateFn = (_t: number, delta: number) => this.update(delta, scene);
    scene.events.on('update', this.updateFn, this);
  }

  setStrength(s: number): void {
    this.strength = Math.max(0, Math.min(1, s));
  }

  private update(delta: number, scene: Phaser.Scene): void {
    if (!this.gfx) return;
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    if (Math.random() < this.strength * 0.15) {
      this.lines.push({
        x:     -40,
        y:     Math.random() * H,
        len:   20 + Math.random() * 60 * this.strength,
        vy:    (Math.random() - 0.5) * 0.5,
        alpha: 0.15 + Math.random() * 0.25 * this.strength,
        life:  1.0,
      });
    }

    this.gfx.clear();
    const speed = 400 + this.strength * 300;

    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.x    += (speed * delta) / 1000;
      l.y    += l.vy;
      l.life -= delta / 600;

      if (l.x > W + 60 || l.life <= 0) {
        this.lines.splice(i, 1);
        continue;
      }

      const alpha = l.alpha * Math.min(1, l.life * 3);
      this.gfx.lineStyle(1, 0xccddee, alpha);
      this.gfx.beginPath();
      this.gfx.moveTo(l.x, l.y);
      this.gfx.lineTo(l.x - l.len, l.y);
      this.gfx.strokePath();
    }
  }

  stop(): void {
    if (this.scene && this.updateFn) {
      this.scene.events.off('update', this.updateFn, this);
    }
    this.gfx?.destroy();
  }
}
