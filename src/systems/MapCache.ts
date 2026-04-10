import Phaser from 'phaser';
import { MapGenerator } from '../world/MapGenerator';

type MapData = ReturnType<MapGenerator['generateMap']>;

export class MapCache {
  private cache = new Map<string, MapData>();
  private generating = new Set<string>();

  get(mapX: number, mapY: number): MapData | null {
    return this.cache.get(`${mapX},${mapY}`) ?? null;
  }

  set(mapX: number, mapY: number, data: MapData): void {
    this.cache.set(`${mapX},${mapY}`, data);
  }

  has(mapX: number, mapY: number): boolean {
    return this.cache.has(`${mapX},${mapY}`);
  }

  delete(mapX: number, mapY: number): void {
    this.cache.delete(`${mapX},${mapY}`);
  }

  /** Remove cached maps more than 1 step away from current position */
  evict(currentMapX: number, currentMapY: number): void {
    for (const key of this.cache.keys()) {
      const [mx, my] = key.split(',').map(Number);
      if (Math.abs(mx - currentMapX) > 1 || Math.abs(my - currentMapY) > 1) {
        this.cache.delete(key);
      }
    }
  }

  /** Schedule async generation of a neighbour map (no-op if already cached/in-flight) */
  requestGenerate(
    mapX: number, mapY: number,
    generator: MapGenerator,
    scene: Phaser.Scene,
    delayMs = 120,
  ): void {
    if (mapX < 0 || mapX > 9 || mapY < 0 || mapY > 9) return;
    const key = `${mapX},${mapY}`;
    if (this.cache.has(key) || this.generating.has(key)) return;
    this.generating.add(key);
    scene.time.delayedCall(delayMs, () => {
      if (!this.cache.has(key)) {
        try {
          this.cache.set(key, generator.generateMap(mapX, mapY));
        } catch (e) {
          console.warn(`MapCache: failed to generate (${mapX},${mapY})`, e);
        }
      }
      this.generating.delete(key);
    });
  }

  /** Return a map synchronously — fall back to immediate generation if missing */
  getOrGenerate(mapX: number, mapY: number, generator: MapGenerator): MapData {
    const key = `${mapX},${mapY}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, generator.generateMap(mapX, mapY));
    }
    return this.cache.get(key)!;
  }
}
