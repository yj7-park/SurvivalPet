import Phaser from 'phaser';
import seedrandom from 'seedrandom';

interface Star {
  x: number;
  y: number;
  size: number;
  twinkle: boolean;
  twinklePeriod: number;
}

export class StarLayer {
  private stars: Star[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  private twinkleTimers: number[] = [];

  constructor(scene: Phaser.Scene, seed: string) {
    this.gfx = scene.add.graphics().setDepth(-1).setScrollFactor(0);
    const rng = seedrandom(seed + '_stars');
    const W = scene.scale.width;
    const H = scene.scale.height;
    this.stars = Array.from({ length: 80 }, () => ({
      x: rng() * W,
      y: rng() * (H / 3),
      size: rng() < 0.2 ? 2 : 1,
      twinkle: rng() < 0.15,
      twinklePeriod: 500 + rng() * 1500,
    }));
    this.twinkleTimers = this.stars.map(() => 0);
  }

  update(gameHour: number, deltaMs: number): void {
    // Stars visible 20:00–06:00; fade in/out in transition hours
    let alpha = 0;
    if (gameHour >= 22 || gameHour < 5) {
      alpha = 1;
    } else if (gameHour >= 20 && gameHour < 22) {
      alpha = (gameHour - 20) / 2;
    } else if (gameHour >= 5 && gameHour < 6) {
      alpha = 1 - (gameHour - 5);
    }

    if (alpha <= 0) {
      this.gfx.clear();
      return;
    }

    this.gfx.clear();
    this.stars.forEach((star, i) => {
      let a = alpha;
      if (star.twinkle) {
        this.twinkleTimers[i] = (this.twinkleTimers[i] + deltaMs) % star.twinklePeriod;
        const t = this.twinkleTimers[i] / star.twinklePeriod;
        a *= 0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI));
      }
      this.gfx.fillStyle(0xffffff, a);
      this.gfx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
    });
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
