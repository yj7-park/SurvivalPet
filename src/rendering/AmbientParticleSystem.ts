export type AmbientType =
  | 'firefly' | 'leaf_fall' | 'dust_mote' | 'water_drip' | 'ember'
  | 'petal'   | 'snow_drift' | 'mist_wisp' | 'bubble'     | 'spore';

const AMBIENT_CONFIG: Record<AmbientType, {
  count: number;
  color: number;
  size:  [number, number];
  speed: [number, number];
  life:  [number, number];
  alpha: [number, number];
}> = {
  firefly:    { count: 18, color: 0xaaffaa, size: [2, 3],  speed: [8,  18],  life: [3000, 6000],  alpha: [0.5, 1.0] },
  leaf_fall:  { count: 20, color: 0xcc8833, size: [3, 6],  speed: [20, 40],  life: [4000, 7000],  alpha: [0.6, 0.9] },
  dust_mote:  { count: 30, color: 0xddccaa, size: [1, 2],  speed: [3,  10],  life: [5000, 9000],  alpha: [0.2, 0.5] },
  water_drip: { count: 12, color: 0x88aaff, size: [2, 3],  speed: [60, 90],  life: [800,  1200],  alpha: [0.5, 0.8] },
  ember:      { count: 15, color: 0xff6622, size: [2, 4],  speed: [15, 35],  life: [1500, 3000],  alpha: [0.6, 1.0] },
  petal:      { count: 16, color: 0xffaacc, size: [3, 5],  speed: [12, 25],  life: [4000, 7000],  alpha: [0.5, 0.9] },
  snow_drift: { count: 25, color: 0xeeeeff, size: [2, 4],  speed: [10, 30],  life: [5000, 8000],  alpha: [0.4, 0.8] },
  mist_wisp:  { count: 10, color: 0xaabbcc, size: [8, 16], speed: [4,  10],  life: [6000, 10000], alpha: [0.1, 0.3] },
  bubble:     { count: 14, color: 0x88ccff, size: [2, 5],  speed: [10, 20],  life: [2000, 4000],  alpha: [0.3, 0.6] },
  spore:      { count: 20, color: 0xaaffdd, size: [1, 3],  speed: [5,  15],  life: [4000, 7000],  alpha: [0.3, 0.7] },
};

interface AmbientParticle {
  x: number; y: number;
  vx: number; vy: number;
  alpha: number; size: number;
  life: number; maxLife: number;
  color: number;
  angle: number; spin: number;
  phase: number;
}

export class AmbientParticleSystem {
  private scene:     Phaser.Scene;
  private particles: AmbientParticle[] = [];
  private gfx:       Phaser.GameObjects.Graphics;
  private type:      AmbientType;
  private cfg:       typeof AMBIENT_CONFIG[AmbientType];
  private spawnArea: { x: number; y: number; w: number; h: number };
  private active = true;

  constructor(
    scene: Phaser.Scene,
    type: AmbientType,
    spawnArea: { x: number; y: number; w: number; h: number },
  ) {
    this.scene     = scene;
    this.type      = type;
    this.cfg       = AMBIENT_CONFIG[type];
    this.spawnArea = spawnArea;
    this.gfx       = scene.add.graphics().setDepth(30);

    for (let i = 0; i < this.cfg.count; i++) {
      this.particles.push(this._spawn(true));
    }
  }

  private _spawn(initialScatter = false): AmbientParticle {
    const cfg = this.cfg;
    const sa  = this.spawnArea;
    const life = Phaser.Math.Between(cfg.life[0], cfg.life[1]);
    return {
      x: sa.x + Math.random() * sa.w,
      y: initialScatter
        ? sa.y + Math.random() * sa.h
        : (this.type === 'water_drip' || this.type === 'leaf_fall' ? sa.y : sa.y + sa.h),
      vx:      (Math.random() - 0.5) * cfg.speed[1] * 0.3,
      vy:      this._baseVY(),
      alpha:   Phaser.Math.FloatBetween(cfg.alpha[0], cfg.alpha[1]),
      size:    Phaser.Math.Between(cfg.size[0], cfg.size[1]),
      life,
      maxLife: life,
      color:   cfg.color,
      angle:   Math.random() * Math.PI * 2,
      spin:    (Math.random() - 0.5) * 0.06,
      phase:   Math.random() * Math.PI * 2,
    };
  }

  private _baseVY(): number {
    const spd = Phaser.Math.FloatBetween(this.cfg.speed[0], this.cfg.speed[1]) / 1000;
    switch (this.type) {
      case 'ember':
      case 'bubble':    return -spd;
      case 'firefly':   return (Math.random() - 0.5) * spd;
      case 'mist_wisp': return (Math.random() - 0.5) * spd * 0.5;
      default:          return spd;
    }
  }

  update(delta: number, camX: number, camY: number): void {
    if (!this.active) return;
    this.gfx.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) { this.particles[i] = this._spawn(); continue; }

      const progress = 1 - p.life / p.maxLife;

      switch (this.type) {
        case 'firefly':
          p.x += p.vx * delta * 0.001 + Math.sin(p.phase + progress * Math.PI * 4) * 0.3;
          p.y += p.vy * delta * 0.001 + Math.cos(p.phase + progress * Math.PI * 3) * 0.2;
          break;
        case 'leaf_fall':
        case 'petal':
          p.x += p.vx * delta * 0.001 + Math.sin(p.phase + progress * Math.PI * 6) * 0.6;
          p.y += p.vy * delta * 0.001;
          p.angle += p.spin;
          break;
        case 'ember':
          p.x += p.vx * delta * 0.001 + (Math.random() - 0.5) * 0.4;
          p.y += p.vy * delta * 0.001;
          break;
        default:
          p.x += p.vx * delta * 0.001;
          p.y += p.vy * delta * 0.001;
      }

      const lifeRatio = p.life / p.maxLife;
      const fadeIn    = Math.min(1, (1 - lifeRatio) * 8);
      const fadeOut   = Math.min(1, lifeRatio * 5);
      const alpha     = p.alpha * Math.min(fadeIn, fadeOut);
      const finalAlpha = this.type === 'firefly'
        ? alpha * (0.5 + 0.5 * Math.sin(p.phase + progress * Math.PI * 8))
        : alpha;

      const sx = p.x - camX;
      const sy = p.y - camY;

      this.gfx.fillStyle(p.color, finalAlpha);
      switch (this.type) {
        case 'leaf_fall':
        case 'petal':
          this.gfx.fillEllipse(sx, sy, p.size * 3, p.size * 1.6);
          break;
        case 'mist_wisp':
          this.gfx.fillStyle(p.color, finalAlpha * 0.5);
          this.gfx.fillCircle(sx, sy, p.size);
          break;
        case 'water_drip':
          this.gfx.fillRect(sx - 1, sy - p.size, 2, p.size * 2);
          break;
        default:
          this.gfx.fillCircle(sx, sy, p.size);
      }
    }
  }

  pause():  void { this.active = false; }
  resume(): void { this.active = true;  }

  destroy(): void {
    this.gfx.destroy();
    this.particles.length = 0;
  }
}

export function attachEmberEffect(
  scene: Phaser.Scene,
  worldX: number, worldY: number,
): { system: AmbientParticleSystem; stop: () => void } {
  const system = new AmbientParticleSystem(scene, 'ember', {
    x: worldX - 20, y: worldY - 10, w: 40, h: 10,
  });

  let active = true;
  const updateFn = (_time: number, delta: number) => {
    if (!active) return;
    const cam = scene.cameras.main;
    system.update(delta, cam.scrollX, cam.scrollY);
  };
  scene.events.on('update', updateFn);

  return {
    system,
    stop: () => {
      active = false;
      scene.events.off('update', updateFn);
      system.destroy();
    },
  };
}
