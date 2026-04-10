import Phaser from 'phaser';
import type { WeatherType } from './WeatherSystem';
import type { LightSource } from '../ui/DarknessLayer';
import type { Inventory } from './Inventory';
import { TILE_SIZE } from '../world/MapGenerator';

const FUEL_DURATION_PER_WOOD_MS = 3 * 60 * 1000; // 3 min per wood piece
const WARMTH_RADIUS = 96; // px
const MAX_CAMPFIRES = 10;
const MAX_FUEL_MS = 9 * FUEL_DURATION_PER_WOOD_MS; // reference max for sprite ratio

const FUEL_CONSUMPTION: Record<WeatherType, number> = {
  clear:    1.0,
  cloudy:   1.0,
  rain:     2.0,
  fog:      1.0,
  snow:     1.5,
  storm:    3.0,
  blizzard: 4.0,
  leaves:   1.0,
};

const EXTINGUISH_CHANCE: Partial<Record<WeatherType, number>> = {
  rain:     0.0005,
  storm:    0.002,
  blizzard: 0.005,
};

export interface Campfire {
  id: string;
  tileX: number;
  tileY: number;
  mapX: number;
  mapY: number;
  fuelMs: number;
  lit: boolean;
  isIndoor: boolean;
  sprite?: Phaser.GameObjects.Sprite;
}

interface FireEmitters {
  flame: Phaser.GameObjects.Particles.ParticleEmitter;
  smoke: Phaser.GameObjects.Particles.ParticleEmitter;
}

export class CampfireSystem {
  private campfires = new Map<string, Campfire>();
  private emitters  = new Map<string, FireEmitters>();
  private scene: Phaser.Scene;
  private onExtinguishedCb?: (id: string) => void;
  private onFuelEmptyCb?: (id: string) => void;
  private onFuelAddedCb?: (id: string, fuelMs: number) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** 모닥불 설치. 성공 시 Campfire 반환, 실패 시 null */
  place(tileX: number, tileY: number, mapX: number, mapY: number, isIndoor: boolean): Campfire | null {
    if (this.campfires.size >= MAX_CAMPFIRES) return null;
    const id = `cf_${mapX}_${mapY}_${tileX}_${tileY}`;
    if (this.campfires.has(id)) return null;

    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;
    const sprite = this.scene.add.sprite(wx, wy, 'campfire_large').setDepth(1.5);

    const campfire: Campfire = {
      id, tileX, tileY, mapX, mapY,
      fuelMs: 3 * FUEL_DURATION_PER_WOOD_MS, // initial 3 wood
      lit: true, isIndoor, sprite,
    };
    this.campfires.set(id, campfire);
    this.createEmitters(id, wx, wy);
    return campfire;
  }

  private createEmitters(id: string, wx: number, wy: number): void {
    const flame = this.scene.add.particles(wx, wy - 4, 'fx_raindrop', {
      tint: [0xff4400, 0xff8800, 0xffcc00, 0xff2200],
      scale: { start: 1.3, end: 0 },
      alpha: { start: 0.9, end: 0 },
      speedY: { min: -80, max: -50 },
      speedX: { min: -12, max: 12 },
      lifespan: { min: 300, max: 500 },
      quantity: 2, frequency: 45,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(2.5);

    const smoke = this.scene.add.particles(wx, wy - 10, 'fx_raindrop', {
      tint: [0x888880, 0xa0a098, 0x707068],
      scale: { start: 0.6, end: 2.0 },
      alpha: { start: 0.3, end: 0 },
      speedY: { min: -28, max: -12 },
      speedX: { min: -7,  max: 7 },
      lifespan: { min: 1200, max: 2000 },
      quantity: 1, frequency: 220,
    }).setDepth(2.6);

    this.emitters.set(id, { flame, smoke });
  }

  private destroyEmitters(id: string): void {
    const em = this.emitters.get(id);
    if (!em) return;
    em.flame.destroy();
    em.smoke.destroy();
    this.emitters.delete(id);
  }

  private updateEmitterIntensity(id: string, lit: boolean, fuelRatio: number): void {
    const em = this.emitters.get(id);
    if (!em) return;

    if (!lit) {
      em.flame.stop();
      em.smoke.stop();
      return;
    }

    em.flame.start();
    em.smoke.start();

    if (fuelRatio > 0.8) {
      em.flame.setQuantity(3); em.smoke.setQuantity(1);
    } else if (fuelRatio > 0.5) {
      em.flame.setQuantity(2); em.smoke.setQuantity(1);
    } else if (fuelRatio > 0.2) {
      em.flame.setQuantity(1); em.smoke.setQuantity(2);
    } else {
      em.flame.setQuantity(1); em.smoke.setQuantity(3);
      em.flame.setFrequency(Phaser.Math.Between(80, 200));
    }
  }

  private playExtinguishEffect(wx: number, wy: number): void {
    for (let i = 0; i < 10; i++) {
      const puff = this.scene.add.circle(wx, wy, Phaser.Math.Between(3, 7), 0xddddcc)
        .setDepth(3);
      this.scene.tweens.add({
        targets: puff,
        x: puff.x + Phaser.Math.Between(-28, 28),
        y: puff.y - Phaser.Math.Between(15, 45),
        scale: { from: 1, to: 3 }, alpha: 0,
        duration: Phaser.Math.Between(500, 900),
        ease: 'Quad.easeOut',
        onComplete: () => puff.destroy(),
      });
    }
  }

  /** 연료 투입 (인벤토리에서 목재 소모) */
  addFuel(id: string, woodCount: number, inventory: Inventory): boolean {
    const cf = this.campfires.get(id);
    if (!cf) return false;
    if (!inventory.has('item_wood', woodCount)) return false;
    inventory.remove('item_wood', woodCount);
    cf.fuelMs = Math.min(cf.fuelMs + woodCount * FUEL_DURATION_PER_WOOD_MS, MAX_FUEL_MS);
    if (!cf.lit && cf.fuelMs > 0) cf.lit = true;
    this.updateSprite(cf);
    this.onFuelAddedCb?.(cf.id, cf.fuelMs);
    return true;
  }

  /** 수동 소화 */
  extinguish(id: string): void {
    const cf = this.campfires.get(id);
    if (!cf) return;
    cf.lit = false;
    this.updateSprite(cf);
    this.onExtinguishedCb?.(id);
  }

  /** 재점화 (목재 1개 필요) */
  relight(id: string, inventory: Inventory): boolean {
    const cf = this.campfires.get(id);
    if (!cf || cf.lit) return false;
    if (!inventory.has('item_wood', 1)) return false;
    inventory.remove('item_wood', 1);
    cf.fuelMs += FUEL_DURATION_PER_WOOD_MS;
    cf.lit = true;
    this.updateSprite(cf);
    this.onFuelAddedCb?.(cf.id, cf.fuelMs);
    return true;
  }

  /** 모닥불 철거 */
  remove(id: string): void {
    const cf = this.campfires.get(id);
    if (!cf) return;
    cf.sprite?.destroy();
    this.destroyEmitters(id);
    this.campfires.delete(id);
  }

  getAll(): Campfire[] { return [...this.campfires.values()]; }
  get(id: string): Campfire | undefined { return this.campfires.get(id); }
  getCount(): number { return this.campfires.size; }

  /** 플레이어 위치 근처 모닥불 반환 */
  getNearby(px: number, py: number, range = 48): Campfire | null {
    for (const cf of this.campfires.values()) {
      const wx = cf.tileX * TILE_SIZE + TILE_SIZE / 2;
      const wy = cf.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(px - wx, py - wy) <= range) return cf;
    }
    return null;
  }

  /** 방한 배율: 가장 가까운 켜진 모닥불 기준 (1.0 = 효과 없음, 0.5 = 최대) */
  getWarmthMultiplier(px: number, py: number): number {
    let best = 1.0;
    for (const cf of this.campfires.values()) {
      if (!cf.lit) continue;
      const wx = cf.tileX * TILE_SIZE + TILE_SIZE / 2;
      const wy = cf.tileY * TILE_SIZE + TILE_SIZE / 2;
      const dist = Math.hypot(px - wx, py - wy);
      if (dist <= WARMTH_RADIUS) {
        const t = 1 - dist / WARMTH_RADIUS;
        const mult = 1.0 - t * 0.5; // lerp(1.0, 0.5, t)
        best = Math.min(best, mult);
      }
    }
    return best;
  }

  isWarm(px: number, py: number): boolean {
    return this.getWarmthMultiplier(px, py) < 1.0;
  }

  /** LightSystem에 제공할 광원 목록 */
  getLightSources(): LightSource[] {
    return [...this.campfires.values()]
      .filter(cf => cf.lit && cf.fuelMs > 0)
      .map(cf => {
        const ratio = cf.fuelMs / MAX_FUEL_MS;
        let radius = 200;
        if (ratio < 0.2) radius = 100;
        else if (ratio < 0.5) radius = 140;
        else if (ratio < 0.8) radius = 170;
        return {
          id: cf.id,
          x: cf.tileX * TILE_SIZE + TILE_SIZE / 2,
          y: cf.tileY * TILE_SIZE + TILE_SIZE / 2,
          radius,
          flicker: true,
          type: 'placed_torch' as const,
        };
      });
  }

  /** 요리 가능 여부 (켜져 있고 범위 내) */
  canCookAt(id: string, px: number, py: number): boolean {
    const cf = this.campfires.get(id);
    if (!cf || !cf.lit) return false;
    const wx = cf.tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = cf.tileY * TILE_SIZE + TILE_SIZE / 2;
    return Math.hypot(px - wx, py - wy) <= 64;
  }

  update(delta: number, weather: WeatherType): void {
    for (const cf of this.campfires.values()) {
      if (!cf.lit) continue;

      const consumption = cf.isIndoor ? 1.0 : (FUEL_CONSUMPTION[weather] ?? 1.0);
      cf.fuelMs -= delta * consumption;

      if (cf.fuelMs <= 0) {
        cf.fuelMs = 0;
        cf.lit = false;
        const wx = cf.tileX * TILE_SIZE + TILE_SIZE / 2;
        const wy = cf.tileY * TILE_SIZE + TILE_SIZE / 2;
        this.playExtinguishEffect(wx, wy);
        this.updateEmitterIntensity(cf.id, false, 0);
        this.updateSprite(cf);
        this.onFuelEmptyCb?.(cf.id);
        continue;
      }

      // 날씨에 의한 소화
      if (!cf.isIndoor) {
        const baseChance = EXTINGUISH_CHANCE[weather] ?? 0;
        if (baseChance > 0 && Math.random() < baseChance * (delta / 16.67)) {
          cf.lit = false;
          const wx = cf.tileX * TILE_SIZE + TILE_SIZE / 2;
          const wy = cf.tileY * TILE_SIZE + TILE_SIZE / 2;
          this.playExtinguishEffect(wx, wy);
          this.updateEmitterIntensity(cf.id, false, 0);
          this.updateSprite(cf);
          this.onExtinguishedCb?.(cf.id);
          continue;
        }
      }

      const fuelRatio = cf.fuelMs / MAX_FUEL_MS;
      this.updateEmitterIntensity(cf.id, true, fuelRatio);
      this.updateSprite(cf);
    }
  }

  onExtinguished(cb: (id: string) => void): void { this.onExtinguishedCb = cb; }
  onFuelEmpty(cb: (id: string) => void): void { this.onFuelEmptyCb = cb; }
  onFuelAdded(cb: (id: string, fuelMs: number) => void): void { this.onFuelAddedCb = cb; }

  private updateSprite(cf: Campfire): void {
    if (!cf.sprite) return;
    if (!cf.lit || cf.fuelMs <= 0) {
      cf.sprite.setTexture('campfire_ash');
      return;
    }
    const ratio = cf.fuelMs / MAX_FUEL_MS;
    if (ratio >= 0.8) cf.sprite.setTexture('campfire_large');
    else if (ratio >= 0.5) cf.sprite.setTexture('campfire_medium');
    else cf.sprite.setTexture('campfire_small');
  }

  clearMap(): void {
    for (const cf of this.campfires.values()) {
      cf.sprite?.destroy();
      this.destroyEmitters(cf.id);
    }
    this.campfires.clear();
  }

  destroy(): void { this.clearMap(); }
}
