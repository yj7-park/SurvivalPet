import Phaser from 'phaser';
import type { Season } from '../systems/GameTime';
import type { WeatherType } from '../systems/WeatherSystem';
import { TileType, TILE_SIZE } from '../world/MapGenerator';

const MAP_W = 100;
const MAP_H = 100;

export const DIRT_TINTS: Record<Season, number> = {
  spring: 0xd4a876,
  summer: 0xc49060,
  autumn: 0xb8844a,
  winter: 0xc8c0b0,
};

interface DecoConfig {
  key: string;
  seasons: Season[];
  density: number;
}

const DECO_CONFIGS: DecoConfig[] = [
  { key: 'deco_grass_short',    seasons: ['spring', 'summer'],              density: 0.15 },
  { key: 'deco_grass_tall',     seasons: ['summer'],                        density: 0.08 },
  { key: 'deco_flower_yellow',  seasons: ['spring'],                        density: 0.04 },
  { key: 'deco_flower_white',   seasons: ['spring', 'summer'],              density: 0.03 },
  { key: 'deco_pebble',         seasons: ['spring','summer','autumn','winter'], density: 0.10 },
  { key: 'deco_dead_grass',     seasons: ['autumn'],                        density: 0.12 },
  { key: 'deco_snow_patch',     seasons: ['winter'],                        density: 0.20 },
  { key: 'deco_fallen_leaf',    seasons: ['autumn'],                        density: 0.10 },
];

export class TileRenderer {
  private waterSprites: Phaser.GameObjects.Sprite[] = [];
  private decoSprites: Phaser.GameObjects.Image[] = [];
  private currentTint = DIRT_TINTS.spring;

  constructor(private scene: Phaser.Scene) {}

  buildWaterSprites(tiles: TileType[][]): void {
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (tiles[ty][tx] === TileType.Water) {
          const s = this.scene.add.sprite(tx * TILE_SIZE, ty * TILE_SIZE, 'tile_water_anim', 0)
            .setOrigin(0, 0).setDepth(0.05);
          if (this.scene.anims.exists('water_ripple')) s.play('water_ripple');
          this.waterSprites.push(s);
        }
      }
    }
  }

  generateDecorations(tiles: TileType[][], seed: string, season: Season): void {
    const applicable = DECO_CONFIGS.filter(d => d.seasons.includes(season));
    if (applicable.length === 0) return;

    let rngState = this.hashSeed(seed + season);
    const rng = (): number => {
      rngState = (rngState * 1664525 + 1013904223) & 0xffffffff;
      return (rngState >>> 0) / 0xffffffff;
    };

    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (tiles[ty][tx] !== TileType.Dirt) { rng(); continue; }
        const nearRock = this.hasNeighbor(tiles, tx, ty, TileType.Rock);

        for (const deco of applicable) {
          if (deco.key === 'deco_pebble' && !nearRock) continue;
          if (rng() > deco.density) continue;
          const wx = tx * TILE_SIZE + rng() * TILE_SIZE * 0.6 + TILE_SIZE * 0.2;
          const wy = ty * TILE_SIZE + rng() * TILE_SIZE * 0.6 + TILE_SIZE * 0.2;
          if (this.scene.textures.exists(deco.key)) {
            this.decoSprites.push(
              this.scene.add.image(wx, wy, deco.key).setOrigin(0.5, 1.0).setDepth(1.5),
            );
          }
          break;
        }
      }
    }
  }

  applySeasonTint(season: Season, tileRT: Phaser.GameObjects.RenderTexture): void {
    const startTint = this.currentTint;
    const targetTint = DIRT_TINTS[season];
    if (startTint === targetTint) return;
    const tintObj = { t: 0 };
    this.scene.tweens.add({
      targets: tintObj,
      t: 1,
      duration: 500,
      onUpdate: () => {
        this.currentTint = this.lerpColor(startTint, targetTint, tintObj.t);
        tileRT.setTint(this.currentTint);
      },
      onComplete: () => {
        this.currentTint = targetTint;
        tileRT.setTint(targetTint);
      },
    });
  }

  setWeatherWaterSpeed(weather: WeatherType): void {
    const scale = (weather === 'rain' || weather === 'storm') ? 1.5 : 1.0;
    for (const s of this.waterSprites) {
      if (s.anims.currentAnim) s.anims.timeScale = scale;
    }
  }

  setNightWaterSpeed(isNight: boolean): void {
    const scale = isNight ? 0.5 : 1.0;
    for (const s of this.waterSprites) {
      if (s.anims.currentAnim) s.anims.timeScale = scale;
    }
  }

  clearMap(): void {
    this.waterSprites.forEach(s => s.destroy());
    this.waterSprites = [];
    this.decoSprites.forEach(s => s.destroy());
    this.decoSprites = [];
  }

  private hasNeighbor(tiles: TileType[][], tx: number, ty: number, type: TileType): boolean {
    return [[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy]) => tiles[ty+dy]?.[tx+dx] === type);
  }

  private hashSeed(seed: string): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    return h;
  }

  private lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (Math.round(ar + (br - ar) * t) << 16)
         | (Math.round(ag + (bg - ag) * t) << 8)
         |  Math.round(ab + (bb - ab) * t);
  }
}
