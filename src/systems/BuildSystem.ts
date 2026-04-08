import Phaser from 'phaser';
import { TileType, TILE_SIZE } from '../world/MapGenerator';
import { Inventory } from './Inventory';
import { CharacterStats } from '../entities/CharacterStats';
import { SurvivalStats } from './SurvivalStats';

export const BUILD_RANGE = 1.5 * TILE_SIZE; // 48px
export type StructMaterial = 'wood' | 'stone';

export interface StructureDef {
  name: string;
  label: string;
  baseTimeSec: number;
  woodCost: Record<string, number>;
  stoneCost: Record<string, number>;
  woodDurability: number;
  stoneDurability: number;
  passable: boolean; // can player walk through?
}

export const STRUCTURE_DEFS: Record<string, StructureDef> = {
  wall:       { name:'wall',       label:'벽',     baseTimeSec:3, woodCost:{item_wood:5},  stoneCost:{item_processed_stone:3},  woodDurability:100, stoneDurability:300, passable:false },
  door:       { name:'door',       label:'문',     baseTimeSec:2, woodCost:{item_wood:3},  stoneCost:{item_processed_stone:2},  woodDurability:80,  stoneDurability:240, passable:true  },
  roof:       { name:'roof',       label:'지붕',   baseTimeSec:4, woodCost:{item_wood:8},  stoneCost:{item_processed_stone:5},  woodDurability:120, stoneDurability:360, passable:true  },
  bed:        { name:'bed',        label:'침대',   baseTimeSec:5, woodCost:{item_wood:6},  stoneCost:{item_processed_stone:4},  woodDurability:60,  stoneDurability:180, passable:false },
  table:      { name:'table',      label:'식탁',   baseTimeSec:4, woodCost:{item_wood:4},  stoneCost:{item_processed_stone:3},  woodDurability:60,  stoneDurability:180, passable:false },
  chair:      { name:'chair',      label:'의자',   baseTimeSec:2, woodCost:{item_wood:2},  stoneCost:{item_processed_stone:2},  woodDurability:40,  stoneDurability:120, passable:false },
  workbench:  { name:'workbench',  label:'작업대', baseTimeSec:6, woodCost:{item_wood:10}, stoneCost:{item_processed_stone:6},  woodDurability:80,  stoneDurability:240, passable:false },
  kitchen:    { name:'kitchen',    label:'조리대', baseTimeSec:6, woodCost:{item_wood:8},  stoneCost:{item_processed_stone:5},  woodDurability:80,  stoneDurability:240, passable:false },
  shelf:      { name:'shelf',      label:'선반',   baseTimeSec:4, woodCost:{item_wood:6},  stoneCost:{item_processed_stone:4},  woodDurability:70,  stoneDurability:210, passable:false },
};

export interface PlacedStructure {
  id: string;
  defName: string;
  material: StructMaterial;
  tileX: number;
  tileY: number;
  durability: number;
  maxDurability: number;
  sprite: Phaser.GameObjects.Sprite;
}

export class BuildSystem {
  private structures = new Map<string, PlacedStructure>();
  private scene!: Phaser.Scene;

  // Building mode state
  activeDef: StructureDef | null = null;
  activeMaterial: StructMaterial = 'wood';
  private previewSprite: Phaser.GameObjects.Sprite | null = null;

  // Build progress
  private buildTarget: { tileX: number; tileY: number; defName: string; material: StructMaterial } | null = null;
  private buildProgressMs = 0;
  private buildTotalMs = 0;
  private buildProgressBg!: Phaser.GameObjects.Rectangle;
  private buildProgressFill!: Phaser.GameObjects.Rectangle;

  init(scene: Phaser.Scene): void {
    this.scene = scene;
    this.buildProgressBg   = scene.add.rectangle(0, 0, 32, 5, 0x333333).setDepth(5).setVisible(false).setOrigin(0.5);
    this.buildProgressFill = scene.add.rectangle(0, 0, 32, 5, 0xffaa00).setDepth(6).setVisible(false).setOrigin(0.5);
  }

  tileKey(tx: number, ty: number): string { return `${tx},${ty}`; }

  getAt(tx: number, ty: number): PlacedStructure | null {
    return this.structures.get(this.tileKey(tx, ty)) ?? null;
  }

  isPassable(tx: number, ty: number): boolean {
    const s = this.getAt(tx, ty);
    if (!s) return true;
    return STRUCTURE_DEFS[s.defName].passable;
  }

  canPlace(defName: string, tx: number, ty: number, mapTiles: TileType[][]): boolean {
    if (tx < 0 || tx >= 100 || ty < 0 || ty >= 100) return false;
    if (mapTiles[ty]?.[tx] !== TileType.Dirt) return false;
    if (this.getAt(tx, ty)) return false;
    return true;
  }

  startBuild(defName: string, material: StructMaterial, tileX: number, tileY: number, stats: CharacterStats, inventory: Inventory): boolean {
    const def = STRUCTURE_DEFS[defName];
    if (!def) return false;

    const cost = material === 'wood' ? def.woodCost : def.stoneCost;
    for (const [itemKey, count] of Object.entries(cost)) {
      if (!inventory.has(itemKey, count)) return false;
    }

    // Deduct cost
    for (const [itemKey, count] of Object.entries(cost)) {
      inventory.remove(itemKey, count);
    }

    const baseMs = def.baseTimeSec * 1000;
    const actualMs = material === 'stone' ? baseMs * 2 : baseMs;
    this.buildTarget = { tileX, tileY, defName, material };
    this.buildProgressMs = 0;
    this.buildTotalMs = stats.buildTime(def.baseTimeSec) * (material === 'stone' ? 2 : 1);
    void actualMs;

    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;
    this.buildProgressBg.setPosition(wx, wy - TILE_SIZE).setVisible(true);
    this.buildProgressFill.setPosition(wx, wy - TILE_SIZE).setVisible(true);

    return true;
  }

  update(delta: number, survival: SurvivalStats, playerX?: number, playerY?: number): void {
    if (!this.buildTarget) return;

    // 플레이어가 너무 멀어지면 건설 취소
    if (playerX !== undefined && playerY !== undefined) {
      const { tileX, tileY } = this.buildTarget;
      const twx = tileX * TILE_SIZE + TILE_SIZE / 2;
      const twy = tileY * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(playerX - twx, playerY - twy) > BUILD_RANGE + 4) {
        this.cancelBuild();
        return;
      }
    }

    this.buildProgressMs += delta;
    const ratio = Math.min(1, this.buildProgressMs / this.buildTotalMs);
    const { tileX, tileY } = this.buildTarget;
    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;

    this.buildProgressBg.setPosition(wx, wy - TILE_SIZE);
    this.buildProgressFill.setPosition(wx, wy - TILE_SIZE);
    this.buildProgressFill.setSize(32 * ratio, 5);

    if (ratio >= 1) {
      this.completeBuild(survival);
    }
  }

  private completeBuild(survival: SurvivalStats): void {
    if (!this.buildTarget) return;
    const { tileX, tileY, defName, material } = this.buildTarget;
    const def = STRUCTURE_DEFS[defName];
    const maxDur = material === 'wood' ? def.woodDurability : def.stoneDurability;
    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;

    const sprite = this.scene.add.sprite(wx, wy, `struct_${defName}_${material}`).setDepth(1);
    const id = this.tileKey(tileX, tileY);

    this.structures.set(id, {
      id, defName, material, tileX, tileY,
      durability: maxDur, maxDurability: maxDur, sprite,
    });

    survival.addAction(15);
    this.buildTarget = null;
    this.buildProgressBg.setVisible(false);
    this.buildProgressFill.setVisible(false);
  }

  isBuildInProgress(): boolean { return this.buildTarget !== null; }

  cancelBuild(): void {
    this.buildTarget = null;
    this.buildProgressBg.setVisible(false);
    this.buildProgressFill.setVisible(false);
  }

  // Preview sprite in building mode
  updatePreview(tileX: number, tileY: number, canPlace: boolean): void {
    if (!this.activeDef) { this.hidePreview(); return; }
    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;
    const key = `struct_${this.activeDef.name}_${this.activeMaterial}`;

    if (!this.previewSprite) {
      this.previewSprite = this.scene.add.sprite(wx, wy, key).setDepth(8).setAlpha(0.5);
    } else {
      this.previewSprite.setTexture(key);
      this.previewSprite.setPosition(wx, wy);
    }
    this.previewSprite.setTint(canPlace ? 0x44ff44 : 0xff4444);
  }

  hidePreview(): void {
    this.previewSprite?.destroy();
    this.previewSprite = null;
  }

  exitBuildMode(): void {
    this.activeDef = null;
    this.hidePreview();
  }

  damageFrenzy(): void {
    for (const s of this.structures.values()) {
      s.durability = Math.max(0, s.durability - 10);
      if (s.durability <= 0) {
        s.sprite.destroy();
        this.structures.delete(s.id);
      }
    }
  }

  clearAll(): void {
    this.structures.forEach(s => s.sprite.destroy());
    this.structures.clear();
  }
}
