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

export class CampfireSystem {
  private campfires = new Map<string, Campfire>();
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
    return campfire;
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
        this.updateSprite(cf);
        this.onFuelEmptyCb?.(cf.id);
        continue;
      }

      // 날씨에 의한 소화
      if (!cf.isIndoor) {
        const baseChance = EXTINGUISH_CHANCE[weather] ?? 0;
        if (baseChance > 0 && Math.random() < baseChance * (delta / 16.67)) {
          cf.lit = false;
          this.updateSprite(cf);
          this.onExtinguishedCb?.(cf.id);
          continue;
        }
      }

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
    for (const cf of this.campfires.values()) cf.sprite?.destroy();
    this.campfires.clear();
  }

  destroy(): void { this.clearMap(); }
}
