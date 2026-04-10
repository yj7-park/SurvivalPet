import Phaser from 'phaser';
import { TILE_SIZE, TileType } from '../world/MapGenerator';
import type { Inventory } from './Inventory';
import type { CharacterStats } from '../entities/CharacterStats';
import type { ProficiencySystem } from './ProficiencySystem';
import type { WeatherType } from './WeatherSystem';
import type { Season } from '../systems/GameTime';
import {
  CropType, CROP_SEASONS, CROP_GROW_SPEED, CROP_YIELD,
  CROP_ITEM_IDS, CROP_LABELS, CROP_EMOJI, SEED_TO_CROP, SEED_ITEM_IDS,
} from '../config/crops';
import {
  CropGrowthAnimator, DryWarningIndicator, FarmPlotBorder,
  playWaterAnimation, playHarvestEffect,
} from './FarmingVisualSystem';
import { registerFarmTileTextures } from '../generators/FarmTileGenerator';
import { registerCropHarvestTextures } from '../generators/CropSpriteGenerator';

const WET_DURATION_MS = 30 * 60 * 1000; // 30분 실시간 = 1게임일 촉촉 유지
const HOE_MAX_DURABILITY = 30;
const WATERING_CAN_MAX_DURABILITY = 20;
const WATERING_CAN_MAX_CHARGES = 5;
const WILD_CROP_MAX = 10;
const WILD_CROP_DENSITY = 0.02;

export interface Crop {
  tileX: number;
  tileY: number;
  type: CropType;
  stage: 0 | 1 | 2;
  growthProgress: number;
  isWet: boolean;
  wetUntil: number;
}

export interface WildCrop {
  id: string;
  tileX: number;
  tileY: number;
  type: CropType;
  harvested: boolean;
  sprite?: Phaser.GameObjects.Image;
}

export interface ToolState {
  hoeDurability: number;
  wateringCanDurability: number;
  wateringCanCharges: number;
}

export type TillResult = 'ok' | 'no_hoe' | 'broke' | 'occupied';
export type WaterResult = 'ok' | 'filled' | 'no_can' | 'no_charges' | 'broke' | 'no_farmland';
export type PlantResult = 'ok' | 'no_seed' | 'no_farmland' | 'occupied' | 'wrong_season_warn';

export class FarmingSystem {
  private farmland = new Set<string>();  // "tx_ty"
  private crops = new Map<string, Crop>(); // "tx_ty" → Crop
  private wildCrops: WildCrop[] = [];

  private farmlandSprites = new Map<string, Phaser.GameObjects.Image>();
  private cropSprites = new Map<string, Phaser.GameObjects.Image>();

  private toolState: ToolState = {
    hoeDurability: HOE_MAX_DURABILITY,
    wateringCanDurability: WATERING_CAN_MAX_DURABILITY,
    wateringCanCharges: 0,
  };

  private onMaturedCb?: (msg: string) => void;

  private cropAnimator!: CropGrowthAnimator;
  private dryIndicator!: DryWarningIndicator;
  private farmBorder!: FarmPlotBorder;

  constructor(private scene: Phaser.Scene) {
    this.cropAnimator  = new CropGrowthAnimator(scene);
    this.dryIndicator  = new DryWarningIndicator(scene);
    this.farmBorder    = new FarmPlotBorder(scene);
    registerFarmTileTextures(scene);
    registerCropHarvestTextures(scene);
  }

  setOnMatured(cb: (msg: string) => void): void { this.onMaturedCb = cb; }
  getToolState(): ToolState { return { ...this.toolState }; }

  // ── Hoe tilling ──────────────────────────────────────────────────────────────

  till(tileX: number, tileY: number, inventory: Inventory): TillResult {
    if (!inventory.has('item_hoe', 1)) return 'no_hoe';
    const key = `${tileX}_${tileY}`;
    if (this.farmland.has(key)) return 'occupied';
    if (this.crops.has(key)) return 'occupied';

    this.farmland.add(key);
    this.toolState.hoeDurability--;
    if (this.toolState.hoeDurability <= 0) {
      inventory.remove('item_hoe', 1);
      this.toolState.hoeDurability = HOE_MAX_DURABILITY;
      this.drawFarmlandSprite(tileX, tileY, false);
      this.refreshFarmBorder();
      return 'broke';
    }
    this.drawFarmlandSprite(tileX, tileY, false);
    this.refreshFarmBorder();
    return 'ok';
  }

  // ── Watering ─────────────────────────────────────────────────────────────────

  waterFromSource(inventory: Inventory): boolean {
    if (!inventory.has('item_watering_can', 1)) return false;
    this.toolState.wateringCanCharges = WATERING_CAN_MAX_CHARGES;
    return true;
  }

  water(tileX: number, tileY: number, inventory: Inventory): WaterResult {
    if (!inventory.has('item_watering_can', 1)) return 'no_can';
    if (this.toolState.wateringCanCharges <= 0) return 'no_charges';

    const key = `${tileX}_${tileY}`;
    if (!this.farmland.has(key) && !this.crops.has(key)) return 'no_farmland';

    this.toolState.wateringCanCharges--;
    this.toolState.wateringCanDurability--;

    if (this.toolState.wateringCanDurability <= 0) {
      inventory.remove('item_watering_can', 1);
      this.toolState.wateringCanDurability = WATERING_CAN_MAX_DURABILITY;
      this.toolState.wateringCanCharges = 0;
      this.setWet(tileX, tileY);
      return 'broke';
    }

    this.setWet(tileX, tileY);
    // 물주기 시각 효과
    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;
    playWaterAnimation(this.scene, wx, wy);
    this.dryIndicator.hide(`${tileX}_${tileY}`);
    return 'ok';
  }

  private setWet(tileX: number, tileY: number): void {
    const key = `${tileX}_${tileY}`;
    const crop = this.crops.get(key);
    const wetUntil = Date.now() + WET_DURATION_MS;
    if (crop) {
      crop.isWet = true;
      crop.wetUntil = wetUntil;
    }
    // Update farmland sprite to wet
    this.updateFarmlandSprite(tileX, tileY, true);
  }

  // ── Planting ─────────────────────────────────────────────────────────────────

  plant(tileX: number, tileY: number, cropType: CropType, inventory: Inventory, season: Season): PlantResult {
    const seedId = SEED_TO_CROP[cropType] ? cropType : null;
    if (!seedId) return 'no_seed';

    const seedItemId = Object.keys(SEED_TO_CROP).find(k => SEED_TO_CROP[k] === cropType)!;
    if (!inventory.has(seedItemId, 1)) return 'no_seed';

    const key = `${tileX}_${tileY}`;
    if (!this.farmland.has(key)) return 'no_farmland';
    if (this.crops.has(key)) return 'occupied';

    inventory.remove(seedItemId, 1);
    const farmlandSprite = this.farmlandSprites.get(key);
    const isWet = farmlandSprite !== undefined && this.isWetFarmland(tileX, tileY);

    const crop: Crop = {
      tileX, tileY, type: cropType, stage: 0,
      growthProgress: 0, isWet, wetUntil: isWet ? Date.now() + WET_DURATION_MS : 0,
    };
    this.crops.set(key, crop);
    this.drawCropSprite(tileX, tileY, cropType, 0);

    const wrongSeason = !CROP_SEASONS[cropType].includes(season);
    return wrongSeason ? 'wrong_season_warn' : 'ok';
  }

  // ── Harvesting ───────────────────────────────────────────────────────────────

  harvest(tileX: number, tileY: number, inventory: Inventory, stats: CharacterStats, proficiency: ProficiencySystem): boolean {
    const key = `${tileX}_${tileY}`;
    const crop = this.crops.get(key);
    if (!crop || crop.stage < 2) return false;

    const [min, max] = CROP_YIELD[crop.type];
    const base = Phaser.Math.Between(min, max);
    const bonus = Math.floor((stats.str - 5) * 0.3);
    let yieldAmt = Math.max(min, base + bonus);

    const farmingLevel = proficiency.getLevel('farming' as import('./ProficiencySystem').ProficiencyType);
    if (farmingLevel >= 5) yieldAmt += 1;
    if (farmingLevel >= 10 && Math.random() < 0.1) yieldAmt *= 2;

    const itemId = CROP_ITEM_IDS[crop.type];
    if (inventory.canAdd(itemId)) inventory.add(itemId, yieldAmt);

    // Seed return chance
    const seedChance = farmingLevel >= 3 ? 0.7 : 0.5;
    if (Math.random() < seedChance) {
      const seedCount = Math.random() < 0.5 ? 1 : 2;
      const seedItemId = Object.keys(SEED_TO_CROP).find(k => SEED_TO_CROP[k] === crop.type)!;
      if (inventory.canAdd(seedItemId)) inventory.add(seedItemId, seedCount);
    }

    proficiency.addXP('farming' as import('./ProficiencySystem').ProficiencyType, 10);

    // Remove crop, keep farmland (in wet state)
    const cropWorldX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const cropWorldY = tileY * TILE_SIZE + TILE_SIZE / 2;
    // Harvest visual effect
    playHarvestEffect(this.scene, crop.type, cropWorldX, cropWorldY);
    this.crops.delete(key);
    const cropSpr = this.cropSprites.get(key);
    if (cropSpr) {
      this.scene.tweens.add({
        targets: cropSpr,
        scaleX: 1.5, scaleY: 1.5, alpha: 0,
        duration: 250, ease: 'Quad.easeOut',
        onComplete: () => cropSpr.destroy(),
      });
    }
    this.cropSprites.delete(key);
    this.dryIndicator.hide(key);
    // Restore wet farmland sprite
    this.updateFarmlandSprite(tileX, tileY, true);
    this.refreshFarmBorder();
    return true;
  }

  harvestWild(wildCropId: string, inventory: Inventory): boolean {
    const wc = this.wildCrops.find(w => w.id === wildCropId);
    if (!wc || wc.harvested) return false;

    wc.harvested = true;
    wc.sprite?.destroy();
    wc.sprite = undefined;

    const [min, max] = CROP_YIELD[wc.type];
    const yieldAmt = Phaser.Math.Between(min, max);
    const itemId = CROP_ITEM_IDS[wc.type];
    if (inventory.canAdd(itemId)) inventory.add(itemId, yieldAmt);

    // Always give seed from wild
    const seedItemId = Object.keys(SEED_TO_CROP).find(k => SEED_TO_CROP[k] === wc.type)!;
    if (inventory.canAdd(seedItemId)) inventory.add(seedItemId, Phaser.Math.Between(1, 2));
    return true;
  }

  // ── Day tick ─────────────────────────────────────────────────────────────────

  onDayEnd(weather: WeatherType, season: Season): void {
    const weatherMult: Partial<Record<WeatherType, number>> = {
      rain: 1.3, snow: 0, blizzard: 0,
    };
    const wMult = weatherMult[weather] ?? 1.0;
    const isRaining = (weather === 'rain' || weather === 'storm');

    for (const [key, crop] of this.crops.entries()) {
      if (season === 'winter') continue;
      if (!CROP_SEASONS[crop.type].includes(season)) continue;

      // Auto-wet if raining
      if (isRaining) {
        crop.isWet = true;
        crop.wetUntil = Date.now() + WET_DURATION_MS;
      }

      const wetMult = crop.isWet ? 1.0 : 0.5;
      const farmingBonus = 1.0; // will be passed from proficiency if needed
      const progress = CROP_GROW_SPEED[crop.type] * wetMult * wMult * farmingBonus;
      crop.growthProgress += progress;

      if (crop.growthProgress >= 1.0 && crop.stage < 2) {
        crop.growthProgress -= 1.0;
        crop.stage = (crop.stage + 1) as 0 | 1 | 2;
        this.drawCropSprite(crop.tileX, crop.tileY, crop.type, crop.stage);

        // 성장 애니메이션
        const spr = this.cropSprites.get(key);
        if (spr) {
          if (crop.stage === 2) {
            this.cropAnimator.onHarvestReady(spr);
          } else {
            this.cropAnimator.onStageAdvance(spr);
          }
        }

        if (crop.stage === 2) {
          const label = CROP_LABELS[crop.type];
          const emoji = CROP_EMOJI[crop.type];
          this.onMaturedCb?.(`${emoji} [${label}] 수확 가능합니다`);
        }
      }

      // Update farmland sprite for wet state
      const flKey = key;
      const isWet = crop.isWet && Date.now() < crop.wetUntil;
      this.updateFarmlandSprite(crop.tileX, crop.tileY, isWet);
      void flKey;
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  update(_delta: number): void {
    const now = Date.now();
    for (const [key, crop] of this.crops.entries()) {
      if (crop.isWet && now >= crop.wetUntil) {
        crop.isWet = false;
        this.updateFarmlandSprite(crop.tileX, crop.tileY, false);
      }
      // 물 고갈 경고 (stage < 2, not wet)
      if (crop.stage < 2 && !crop.isWet) {
        const wx = crop.tileX * TILE_SIZE + TILE_SIZE / 2;
        const wy = crop.tileY * TILE_SIZE + TILE_SIZE / 2;
        this.dryIndicator.show(key, wx, wy);
      } else {
        this.dryIndicator.hide(key);
      }
    }
  }

  // ── Wild crops ───────────────────────────────────────────────────────────────

  spawnWildCrops(mapX: number, mapY: number, tiles: TileType[][], season: Season): void {
    if (season === 'winter') return;

    const WILD_CROPS_BY_SEASON: Record<Season, CropType[]> = {
      spring: ['wheat', 'carrot'],
      summer: ['wheat', 'carrot', 'pumpkin'],
      autumn: ['wheat', 'potato'],
      winter: [],
    };
    const possible = WILD_CROPS_BY_SEASON[season] ?? [];
    if (possible.length === 0) return;

    const dirtTiles: [number, number][] = [];
    for (let ty = 0; ty < tiles.length; ty++) {
      for (let tx = 0; tx < tiles[ty].length; tx++) {
        if (tiles[ty][tx] === TileType.Dirt) dirtTiles.push([tx, ty]);
      }
    }

    const rng = Math.random;
    let count = 0;
    for (const [tx, ty] of dirtTiles) {
      if (count >= WILD_CROP_MAX) break;
      if (rng() > WILD_CROP_DENSITY) continue;
      const cropType = possible[Math.floor(rng() * possible.length)];
      const id = `wild_${mapX}_${mapY}_${tx}_${ty}`;
      const wx = tx * TILE_SIZE + TILE_SIZE / 2;
      const wy = ty * TILE_SIZE + TILE_SIZE / 2;
      const sprite = this.scene.add.image(wx, wy, `crop_${cropType}_2`)
        .setDepth((ty + 1) * TILE_SIZE - 2);
      this.wildCrops.push({ id, tileX: tx, tileY: ty, type: cropType, harvested: false, sprite });
      count++;
    }
  }

  // ── Query ─────────────────────────────────────────────────────────────────────

  isFarmland(tx: number, ty: number): boolean { return this.farmland.has(`${tx}_${ty}`); }
  getCropAt(tx: number, ty: number): Crop | undefined { return this.crops.get(`${tx}_${ty}`); }
  isReadyToHarvest(tx: number, ty: number): boolean { return (this.crops.get(`${tx}_${ty}`)?.stage ?? -1) === 2; }

  getHarvestable(wx: number, wy: number, radius: number): Crop | undefined {
    for (const crop of this.crops.values()) {
      if (crop.stage < 2) continue;
      const cx = crop.tileX * TILE_SIZE + TILE_SIZE / 2;
      const cy = crop.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(cx - wx, cy - wy) <= radius) return crop;
    }
    return undefined;
  }

  getWildCropNear(wx: number, wy: number, radius: number): WildCrop | undefined {
    for (const wc of this.wildCrops) {
      if (wc.harvested) continue;
      const cx = wc.tileX * TILE_SIZE + TILE_SIZE / 2;
      const cy = wc.tileY * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(cx - wx, cy - wy) <= radius) return wc;
    }
    return undefined;
  }

  private isWetFarmland(tx: number, ty: number): boolean {
    const key = `${tx}_${ty}`;
    const crop = this.crops.get(key);
    return crop ? crop.isWet && Date.now() < crop.wetUntil : false;
  }

  // ── Rendering ─────────────────────────────────────────────────────────────────

  private drawFarmlandSprite(tx: number, ty: number, wet: boolean): void {
    const key = `${tx}_${ty}`;
    this.farmlandSprites.get(key)?.destroy();
    const textureKey = wet ? 'farmland_wet' : 'farmland_dry';
    const img = this.scene.add.image(tx * TILE_SIZE, ty * TILE_SIZE, textureKey)
      .setOrigin(0, 0).setDepth(0.5);
    this.farmlandSprites.set(key, img);
  }

  private updateFarmlandSprite(tx: number, ty: number, wet: boolean): void {
    const key = `${tx}_${ty}`;
    const existing = this.farmlandSprites.get(key);
    if (existing) {
      const textureKey = wet ? 'farmland_wet' : 'farmland_dry';
      existing.setTexture(textureKey);
    } else {
      this.drawFarmlandSprite(tx, ty, wet);
    }
  }

  private drawCropSprite(tx: number, ty: number, cropType: CropType, stage: 0 | 1 | 2): void {
    const key = `${tx}_${ty}`;
    this.cropSprites.get(key)?.destroy();
    const textureKey = `crop_${cropType}_${stage}`;
    const wx = tx * TILE_SIZE + TILE_SIZE / 2;
    const wy = ty * TILE_SIZE + TILE_SIZE / 2;
    const img = this.scene.add.image(wx, wy, textureKey)
      .setDepth((ty + 1) * TILE_SIZE - 2);
    this.cropSprites.set(key, img);
  }

  // ── Map lifecycle ─────────────────────────────────────────────────────────────

  clearMap(): void {
    this.farmlandSprites.forEach(s => s.destroy());
    this.farmlandSprites.clear();
    this.cropSprites.forEach(s => s.destroy());
    this.cropSprites.clear();
    this.wildCrops.forEach(w => w.sprite?.destroy());
    this.wildCrops = [];
    this.farmland.clear();
    this.crops.clear();
    this.dryIndicator.hideAll();
    this.farmBorder.draw([]);
  }

  destroy(): void {
    this.clearMap();
    this.dryIndicator.destroy();
    this.farmBorder.destroy();
  }

  private refreshFarmBorder(): void {
    const positions: { tx: number; ty: number }[] = [];
    for (const key of this.farmland.keys()) {
      const [tx, ty] = key.split('_').map(Number);
      positions.push({ tx, ty });
    }
    this.farmBorder.draw(positions);
  }

  getHarvestableCount(): number {
    let count = 0;
    for (const crop of this.crops.values()) {
      if (crop.stage === 2) count++;
    }
    return count;
  }

  // ── Serialization ─────────────────────────────────────────────────────────────

  serialize(): {
    farmlands: Array<{ tileX: number; tileY: number; mapX: number; mapY: number; isWet: boolean; wetUntil: number; crop?: { type: string; stage: 0|1|2; growthProgress: number } }>;
    harvestedWildCrops: string[];
    toolState: ToolState;
  } {
    // We don't serialize mapX/mapY per-farmland since FarmingSystem is per-map
    // GameScene will pass mapX/mapY when serializing
    const farmlands = [];
    for (const crop of this.crops.values()) {
      farmlands.push({
        tileX: crop.tileX, tileY: crop.tileY, mapX: 0, mapY: 0,
        isWet: crop.isWet, wetUntil: crop.wetUntil,
        crop: { type: crop.type, stage: crop.stage, growthProgress: crop.growthProgress },
      });
    }
    // Also serialize farmland without crops
    for (const key of this.farmland.keys()) {
      if (!this.crops.has(key)) {
        const [tx, ty] = key.split('_').map(Number);
        farmlands.push({
          tileX: tx, tileY: ty, mapX: 0, mapY: 0,
          isWet: false, wetUntil: 0,
        });
      }
    }
    const harvestedWildCrops = this.wildCrops.filter(w => w.harvested).map(w => w.id);
    return { farmlands, harvestedWildCrops, toolState: { ...this.toolState } };
  }

  restoreFromSave(data: {
    farmlands?: Array<{ tileX: number; tileY: number; mapX: number; mapY: number; isWet: boolean; wetUntil: number; crop?: { type: string; stage: 0|1|2; growthProgress: number } }>;
    harvestedWildCrops?: string[];
    toolState?: Partial<ToolState>;
  }, mapX: number, mapY: number): void {
    if (data.toolState) {
      Object.assign(this.toolState, data.toolState);
    }
    if (!data.farmlands) return;
    for (const fl of data.farmlands) {
      if (fl.mapX !== mapX || fl.mapY !== mapY) continue;
      const key = `${fl.tileX}_${fl.tileY}`;
      this.farmland.add(key);
      const isWet = fl.isWet && Date.now() < fl.wetUntil;
      this.drawFarmlandSprite(fl.tileX, fl.tileY, isWet);

      if (fl.crop) {
        const crop: Crop = {
          tileX: fl.tileX, tileY: fl.tileY,
          type: fl.crop.type as CropType,
          stage: fl.crop.stage,
          growthProgress: fl.crop.growthProgress,
          isWet: fl.isWet,
          wetUntil: fl.wetUntil,
        };
        this.crops.set(key, crop);
        this.drawCropSprite(fl.tileX, fl.tileY, crop.type, crop.stage);
      }
    }
    // Mark harvested wild crops (will be filtered after spawnWildCrops)
    this._harvestedIds = new Set(data.harvestedWildCrops ?? []);
  }

  private _harvestedIds = new Set<string>();

  markHarvestedWildCrops(): void {
    for (const wc of this.wildCrops) {
      if (this._harvestedIds.has(wc.id)) {
        wc.harvested = true;
        wc.sprite?.destroy();
        wc.sprite = undefined;
      }
    }
    this._harvestedIds.clear();
  }
}
