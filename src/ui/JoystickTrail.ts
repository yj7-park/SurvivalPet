import Phaser from 'phaser';

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

export class JoystickTrail {
  private trail: TrailPoint[] = [];

  update(
    hx: number, hy: number,
    active: boolean,
    gfx: Phaser.GameObjects.Graphics
  ): void {
    if (!active) {
      this.trail = [];
      gfx.clear();
      return;
    }

    this.trail.push({ x: hx, y: hy, t: Date.now() });
    const cutoff = Date.now() - 200;
    this.trail = this.trail.filter(p => p.t > cutoff);

    gfx.clear();
    this.trail.forEach((p, i) => {
      const ratio = this.trail.length > 1 ? i / (this.trail.length - 1) : 0;
      const alpha = ratio * 0.3;
      const r = 3 * ratio;
      if (r >= 0.5) {
        gfx.fillStyle(0xf0c030, alpha);
        gfx.fillCircle(p.x, p.y, r);
      }
    });
  }

  reset(): void {
    this.trail = [];
  }
}
