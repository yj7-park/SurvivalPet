interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

export class WeaponTrailRenderer {
  private trail: TrailPoint[] = [];
  private readonly TRAIL_MS   = 120;

  update(
    weaponX: number,
    weaponY: number,
    isAttacking: boolean,
    color: number,
    gfx: Phaser.GameObjects.Graphics
  ): void {
    if (!isAttacking) {
      this.trail = [];
      gfx.clear();
      return;
    }

    const now = Date.now();
    this.trail.push({ x: weaponX, y: weaponY, t: now });
    const cutoff = now - this.TRAIL_MS;
    this.trail = this.trail.filter(p => p.t > cutoff);

    gfx.clear();
    this.trail.forEach((p, i, arr) => {
      if (i === 0) return;
      const ratio = i / arr.length;
      gfx.lineStyle(2 * ratio, color, ratio * 0.6);
      gfx.lineBetween(arr[i - 1].x, arr[i - 1].y, p.x, p.y);
    });
  }

  reset(): void {
    this.trail = [];
  }
}
