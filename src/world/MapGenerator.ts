import { createNoise2D, NoiseFunction2D } from 'simplex-noise';
import { SeededRandom } from '../utils/seedRandom';
import seedrandom from 'seedrandom';

export const TILE_SIZE = 32;
const MAP_W = 100;
const MAP_H = 100;
const NOISE_SCALE = 40;

export enum TileType {
  Dirt = 'dirt',
  Water = 'water',
  Rock = 'rock',
  Tree = 'tree',
}

export interface MapData {
  tiles: TileType[][];
}

const HEIGHT_MAP_CACHE_MAX = 9;

export class MapGenerator {
  private noise: NoiseFunction2D;
  private heightMapCache = new Map<string, number[][]>();

  constructor(private seed: string) {
    // simplex-noise v4는 noise 함수에 prng를 넣어 seed 지원
    this.noise = createNoise2D(seedrandom(seed));
  }

  generateMap(mapX: number, mapY: number): MapData {
    const heightMap = this.getCachedHeightMap(mapX, mapY);
    let tiles = this.classifyTiles(heightMap);
    tiles = this.generateRivers(mapX, mapY, heightMap, tiles);
    tiles = this.smoothWater(tiles);
    tiles = this.smoothRock(tiles);
    tiles = this.placeTrees(mapX, mapY, tiles);
    return { tiles };
  }

  private getCachedHeightMap(mapX: number, mapY: number): number[][] {
    const key = `${this.seed}:${mapX},${mapY}`;
    if (this.heightMapCache.has(key)) {
      // LRU: move to end by re-inserting
      const cached = this.heightMapCache.get(key)!;
      this.heightMapCache.delete(key);
      this.heightMapCache.set(key, cached);
      return cached;
    }
    const heightMap = this.generateHeightMap(mapX, mapY);
    if (this.heightMapCache.size >= HEIGHT_MAP_CACHE_MAX) {
      // evict oldest (first) entry
      const firstKey = this.heightMapCache.keys().next().value;
      if (firstKey !== undefined) this.heightMapCache.delete(firstKey);
    }
    this.heightMapCache.set(key, heightMap);
    return heightMap;
  }

  private generateHeightMap(mapX: number, mapY: number): number[][] {
    const map: number[][] = [];
    for (let ty = 0; ty < MAP_H; ty++) {
      map[ty] = [];
      for (let tx = 0; tx < MAP_W; tx++) {
        const nx = (mapX * MAP_W + tx) / NOISE_SCALE;
        const ny = (mapY * MAP_H + ty) / NOISE_SCALE;
        const h =
          this.noise(nx, ny) * 1.0 +
          this.noise(nx * 2, ny * 2) * 0.5 +
          this.noise(nx * 4, ny * 4) * 0.25;
        map[ty][tx] = h / 1.75; // 정규화
      }
    }
    return map;
  }

  private classifyTiles(heightMap: number[][]): TileType[][] {
    return heightMap.map(row =>
      row.map(h => {
        if (h < -0.15) return TileType.Water;
        if (h >= 0.55) return TileType.Rock;
        return TileType.Dirt;
      })
    );
  }

  private generateRivers(mapX: number, mapY: number, heightMap: number[][], tiles: TileType[][]): TileType[][] {
    const result = tiles.map(row => [...row]);
    const rng = new SeededRandom(`${this.seed}_river_${mapX}_${mapY}`);

    // 암석 고점 탐색
    const peaks: [number, number][] = [];
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (tiles[ty][tx] === TileType.Rock && rng.next() < 0.01) {
          peaks.push([tx, ty]);
        }
      }
    }

    for (const [sx, sy] of peaks.slice(0, 3)) {
      let x = sx, y = sy;
      for (let step = 0; step < 200; step++) {
        if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) break;
        if (result[y][x] === TileType.Water) break;

        const width = rng.int(1, 2);
        for (let wx = -width; wx <= width; wx++) {
          for (let wy = -width; wy <= width; wy++) {
            const nx = x + wx, ny = y + wy;
            if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
              result[ny][nx] = TileType.Water;
            }
          }
        }

        // 경사 하강
        let minH = heightMap[y][x];
        let nx = x, ny = y;
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]) {
          const cx = x + dx, cy = y + dy;
          if (cx >= 0 && cx < MAP_W && cy >= 0 && cy < MAP_H && heightMap[cy][cx] < minH) {
            minH = heightMap[cy][cx];
            nx = cx; ny = cy;
          }
        }
        if (nx === x && ny === y) break;
        x = nx; y = ny;
      }
    }
    return result;
  }

  private smoothWater(tiles: TileType[][]): TileType[][] {
    let result = tiles.map(row => [...row]);
    for (let iter = 0; iter < 3; iter++) {
      const next = result.map(row => [...row]);
      for (let ty = 0; ty < MAP_H; ty++) {
        for (let tx = 0; tx < MAP_W; tx++) {
          const waterCount = this.countNeighbors(result, tx, ty, TileType.Water);
          if (waterCount >= 5) next[ty][tx] = TileType.Water;
        }
      }
      result = next;
    }

    // 너무 작은 물 덩어리 제거
    const visited = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(false));
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (result[ty][tx] === TileType.Water && !visited[ty][tx]) {
          const group = this.floodFill(result, tx, ty, TileType.Water, visited);
          if (group.length < 5) {
            for (const [gx, gy] of group) result[gy][gx] = TileType.Dirt;
          }
        }
      }
    }
    return result;
  }

  private smoothRock(tiles: TileType[][]): TileType[][] {
    const result = tiles.map(row => [...row]);
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (tiles[ty][tx] === TileType.Rock) {
          const rockCount = this.countNeighbors(tiles, tx, ty, TileType.Rock);
          if (rockCount < 2) result[ty][tx] = TileType.Dirt;
        }
      }
    }
    return result;
  }

  private placeTrees(mapX: number, mapY: number, tiles: TileType[][]): TileType[][] {
    const result = tiles.map(row => [...row]);
    const rng = new SeededRandom(`${this.seed}_tree_${mapX}_${mapY}`);
    const minDist = 2;
    const placed: [number, number][] = [];

    // Poisson Disk Sampling (간략 구현)
    const candidates: [number, number][] = [];
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (tiles[ty][tx] === TileType.Dirt) candidates.push([tx, ty]);
      }
    }

    // Fisher-Yates shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (const [cx, cy] of candidates) {
      if (rng.next() > 0.20) continue; // 약 20% 밀도

      const tooClose = placed.some(([px, py]) =>
        Math.abs(px - cx) < minDist && Math.abs(py - cy) < minDist
      );
      if (tooClose) continue;

      result[cy][cx] = TileType.Tree;
      placed.push([cx, cy]);
    }
    return result;
  }

  private countNeighbors(tiles: TileType[][], tx: number, ty: number, type: TileType): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = tx + dx, ny = ty + dy;
        if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H && tiles[ny][nx] === type) count++;
      }
    }
    return count;
  }

  private floodFill(
    tiles: TileType[][], sx: number, sy: number,
    type: TileType, visited: boolean[][]
  ): [number, number][] {
    const group: [number, number][] = [];
    const stack = [[sx, sy]];
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) continue;
      if (visited[y][x] || tiles[y][x] !== type) continue;
      visited[y][x] = true;
      group.push([x, y]);
      stack.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
    }
    return group;
  }
}
