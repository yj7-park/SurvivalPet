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
  passable: boolean;
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

/** 중단된 건축 상태 — 비용은 이미 차감됨 */
interface PartialBuild {
  id: string;
  defName: string;
  material: StructMaterial;
  tileX: number;
  tileY: number;
  progressMs: number;  // 이미 진행된 시간
  totalMs: number;     // 전체 필요 시간
  ghost: Phaser.GameObjects.Sprite;  // 반투명 미완성 스프라이트
}

/** 큐에 대기 중인 건축 계획 */
export interface PendingBuild {
  id: string;
  defName: string;
  material: StructMaterial;
  tileX: number;
  tileY: number;
  ghost: Phaser.GameObjects.Sprite;  // 극도로 반투명한 스프라이트
}

export class BuildSystem {
  private structures = new Map<string, PlacedStructure>();
  private partialBuilds = new Map<string, PartialBuild>();
  private pendingBuilds: PendingBuild[] = [];
  private scene!: Phaser.Scene;
  private queueLines!: Phaser.GameObjects.Graphics;

  // 현재 진행 중인 건설/철거 타겟
  activeDef: StructureDef | null = null;
  activeMaterial: StructMaterial = 'wood';
  private previewSprite: Phaser.GameObjects.Sprite | null = null;

  private buildTarget: { tileX: number; tileY: number; defName: string; material: StructMaterial; totalMs: number } | null = null;
  private buildProgressMs = 0;
  private buildProgressBg!: Phaser.GameObjects.Rectangle;
  private buildProgressFill!: Phaser.GameObjects.Rectangle;
  private buildCompleteCallback: (() => void) | null = null;

  // 철거 상태
  private demolishTarget: PlacedStructure | null = null;
  private demolishProgressMs = 0;
  private demolishTotalMs = 0;
  private demolishInventory: Inventory | null = null;
  private demolishProgressBg!: Phaser.GameObjects.Rectangle;
  private demolishProgressFill!: Phaser.GameObjects.Rectangle;
  private onDemolishComplete: (() => void) | null = null;

  private nextPendingId = 0;

  init(scene: Phaser.Scene): void {
    this.scene = scene;
    this.buildProgressBg   = scene.add.rectangle(0, 0, 32, 5, 0x333333).setDepth(2000).setVisible(false).setOrigin(0.5);
    this.buildProgressFill = scene.add.rectangle(0, 0, 32, 5, 0xffaa00).setDepth(2001).setVisible(false).setOrigin(0.5);
    this.demolishProgressBg   = scene.add.rectangle(0, 0, 32, 5, 0x333333).setDepth(2000).setVisible(false).setOrigin(0.5);
    this.demolishProgressFill = scene.add.rectangle(0, 0, 32, 5, 0xff4400).setDepth(2001).setVisible(false).setOrigin(0.5);
    this.queueLines = scene.add.graphics().setDepth(2002);
  }

  setBuildCompleteCallback(cb: () => void): void { this.buildCompleteCallback = cb; }
  setDemolishCompleteCallback(cb: () => void): void { this.onDemolishComplete = cb; }

  tileKey(tx: number, ty: number): string { return `${tx},${ty}`; }

  getAt(tx: number, ty: number): PlacedStructure | null {
    return this.structures.get(this.tileKey(tx, ty)) ?? null;
  }

  getPartialAt(tx: number, ty: number): PartialBuild | null {
    return this.partialBuilds.get(this.tileKey(tx, ty)) ?? null;
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
    if (this.getPartialAt(tx, ty)) return false;
    return true;
  }

  // ── 건설 ─────────────────────────────────────────────────

  startBuild(defName: string, material: StructMaterial, tileX: number, tileY: number, stats: CharacterStats, inventory: Inventory, profMult = 1.0): boolean {
    if (this.buildTarget) return false; // 이미 진행 중

    const def = STRUCTURE_DEFS[defName];
    if (!def) return false;

    const key = this.tileKey(tileX, tileY);
    const partial = this.partialBuilds.get(key);

    if (partial) {
      // 중단된 건축 재개 — 비용은 이미 차감됨
      this.buildTarget = { tileX, tileY, defName: partial.defName, material: partial.material, totalMs: partial.totalMs };
      this.buildProgressMs = partial.progressMs;
      partial.ghost.destroy();
      this.partialBuilds.delete(key);
    } else {
      // 새 건축 시작 — 비용 차감
      const cost = material === 'wood' ? def.woodCost : def.stoneCost;
      for (const [itemKey, count] of Object.entries(cost)) {
        if (!inventory.has(itemKey, count)) return false;
      }
      for (const [itemKey, count] of Object.entries(cost)) {
        inventory.remove(itemKey, count);
      }

      const totalMs = stats.buildTime(def.baseTimeSec) * (material === 'stone' ? 2 : 1) * profMult;
      this.buildTarget = { tileX, tileY, defName, material, totalMs };
      this.buildProgressMs = 0;
    }

    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;
    this.buildProgressBg.setPosition(wx, wy - TILE_SIZE).setVisible(true);
    this.buildProgressFill.setPosition(wx, wy - TILE_SIZE).setVisible(true);
    return true;
  }

  /** 플레이어가 건설 범위를 벗어나면 중단 (진행 상태 저장) */
  pauseBuild(): void {
    if (!this.buildTarget) return;
    const { tileX, tileY, defName, material, totalMs } = this.buildTarget;
    const key = this.tileKey(tileX, tileY);
    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;

    const ratio = Math.min(1, this.buildProgressMs / totalMs);
    const ghost = this.scene.add.sprite(wx, wy, `struct_${defName}_${material}`)
      .setDepth(1).setAlpha(0.3 + ratio * 0.3).setTint(0xffaa00);

    this.partialBuilds.set(key, {
      id: key, defName, material, tileX, tileY,
      progressMs: this.buildProgressMs, totalMs,
      ghost,
    });

    this.buildTarget = null;
    this.buildProgressMs = 0;
    this.buildProgressBg.setVisible(false);
    this.buildProgressFill.setVisible(false);
  }

  cancelBuild(): void {
    this.buildTarget = null;
    this.buildProgressMs = 0;
    this.buildProgressBg.setVisible(false);
    this.buildProgressFill.setVisible(false);
  }

  isBuildInProgress(): boolean { return this.buildTarget !== null; }
  isDemolishInProgress(): boolean { return this.demolishTarget !== null; }

  // ── 철거 ─────────────────────────────────────────────────

  startDemolish(tx: number, ty: number, stats: CharacterStats, inventory: Inventory): boolean {
    const struct = this.getAt(tx, ty);
    if (!struct) return false;
    if (this.demolishTarget) return false;
    if (this.buildTarget) return false;

    const def = STRUCTURE_DEFS[struct.defName];
    this.demolishTarget = struct;
    this.demolishInventory = inventory;
    // 철거는 건설의 60% 시간
    this.demolishTotalMs = stats.buildTime(def.baseTimeSec) * (struct.material === 'stone' ? 2 : 1) * 0.6;
    this.demolishProgressMs = 0;

    const wx = tx * TILE_SIZE + TILE_SIZE / 2;
    const wy = ty * TILE_SIZE + TILE_SIZE / 2;
    this.demolishProgressBg.setPosition(wx, wy - TILE_SIZE).setVisible(true);
    this.demolishProgressFill.setPosition(wx, wy - TILE_SIZE).setVisible(true);
    return true;
  }

  cancelDemolish(): void {
    this.demolishTarget = null;
    this.demolishProgressMs = 0;
    this.demolishProgressBg.setVisible(false);
    this.demolishProgressFill.setVisible(false);
  }

  private completeDemolish(): void {
    if (!this.demolishTarget || !this.demolishInventory) return;
    const struct = this.demolishTarget;
    const def = STRUCTURE_DEFS[struct.defName];
    const cost = struct.material === 'wood' ? def.woodCost : def.stoneCost;

    // 내구도 기반 자원 반환: >75% → 75%, 50-75% → 50%, <50% → 25%
    const durRatio = struct.durability / struct.maxDurability;
    const returnRatio = durRatio > 0.75 ? 0.75 : durRatio > 0.5 ? 0.5 : 0.25;
    for (const [itemKey, count] of Object.entries(cost)) {
      this.demolishInventory.add(itemKey, Math.ceil(count * returnRatio));
    }

    struct.sprite.destroy();
    this.structures.delete(struct.id);

    this.demolishTarget = null;
    this.demolishInventory = null;
    this.demolishProgressMs = 0;
    this.demolishProgressBg.setVisible(false);
    this.demolishProgressFill.setVisible(false);
    this.onDemolishComplete?.();
  }

  // ── 대기 중인 건축 (큐 시각화) ────────────────────────────

  addPendingBuild(defName: string, material: StructMaterial, tileX: number, tileY: number): string {
    const id = `pending_${this.nextPendingId++}`;
    const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const wy = tileY * TILE_SIZE + TILE_SIZE / 2;
    const ghost = this.scene.add.sprite(wx, wy, `struct_${defName}_${material}`)
      .setDepth(1).setAlpha(0.25).setTint(0x88aaff);
    this.pendingBuilds.push({ id, defName, material, tileX, tileY, ghost });
    this.redrawQueueLines();
    return id;
  }

  removePendingBuild(id: string): void {
    const idx = this.pendingBuilds.findIndex(p => p.id === id);
    if (idx < 0) return;
    this.pendingBuilds[idx].ghost.destroy();
    this.pendingBuilds.splice(idx, 1);
    this.redrawQueueLines();
  }

  redrawQueueLines(playerX?: number, playerY?: number): void {
    this.queueLines.clear();
    if (this.pendingBuilds.length === 0) return;
    this.queueLines.lineStyle(1.5, 0x88aaff, 0.6);

    // 플레이어 위치 → 첫번째 ghost → 두번째 ghost → …
    const points: { x: number; y: number }[] = [];
    if (playerX !== undefined && playerY !== undefined) {
      points.push({ x: playerX, y: playerY });
    }
    for (const p of this.pendingBuilds) {
      points.push({ x: p.tileX * TILE_SIZE + TILE_SIZE / 2, y: p.tileY * TILE_SIZE + TILE_SIZE / 2 });
    }

    for (let i = 0; i < points.length - 1; i++) {
      this.queueLines.strokeLineShape(new Phaser.Geom.Line(points[i].x, points[i].y, points[i+1].x, points[i+1].y));
    }
  }

  getPendingBuilds(): PendingBuild[] { return [...this.pendingBuilds]; }

  // ── update ────────────────────────────────────────────────

  update(delta: number, survival: SurvivalStats, playerX?: number, playerY?: number): void {
    // 큐 연결선 매 프레임 갱신 (플레이어가 이동하므로)
    if (this.pendingBuilds.length > 0) {
      this.redrawQueueLines(playerX, playerY);
    }

    // 건설 진행
    if (this.buildTarget) {
      const { tileX, tileY, totalMs } = this.buildTarget;
      const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
      const wy = tileY * TILE_SIZE + TILE_SIZE / 2;

      // 플레이어가 범위를 벗어나면 중단 (취소 X, 진행 저장)
      if (playerX !== undefined && playerY !== undefined) {
        if (Math.hypot(playerX - wx, playerY - wy) > BUILD_RANGE + 4) {
          this.pauseBuild();
          return;
        }
      }

      this.buildProgressMs += delta;
      const ratio = Math.min(1, this.buildProgressMs / totalMs);

      this.buildProgressBg.setPosition(wx, wy - TILE_SIZE);
      this.buildProgressFill.setPosition(wx, wy - TILE_SIZE);
      this.buildProgressFill.setSize(32 * ratio, 5);

      if (ratio >= 1) this.completeBuildAction(survival);
    }

    // 철거 진행
    if (this.demolishTarget) {
      const { tileX, tileY } = this.demolishTarget;
      const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
      const wy = tileY * TILE_SIZE + TILE_SIZE / 2;

      // 플레이어가 범위 벗어나면 철거 취소
      if (playerX !== undefined && playerY !== undefined) {
        if (Math.hypot(playerX - wx, playerY - wy) > BUILD_RANGE + 4) {
          this.cancelDemolish();
          return;
        }
      }

      this.demolishProgressMs += delta;
      const ratio = Math.min(1, this.demolishProgressMs / this.demolishTotalMs);

      this.demolishProgressBg.setPosition(wx, wy - TILE_SIZE);
      this.demolishProgressFill.setPosition(wx, wy - TILE_SIZE);
      this.demolishProgressFill.setSize(32 * ratio, 5);

      if (ratio >= 1) this.completeDemolish();
    }
  }

  private completeBuildAction(survival: SurvivalStats): void {
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
    this.buildProgressMs = 0;
    this.buildProgressBg.setVisible(false);
    this.buildProgressFill.setVisible(false);
    this.buildCompleteCallback?.();
  }

  // ── Preview sprite ────────────────────────────────────────

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

  // ── 기타 ─────────────────────────────────────────────────

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
    this.partialBuilds.forEach(p => p.ghost.destroy());
    this.partialBuilds.clear();
    this.pendingBuilds.forEach(p => p.ghost.destroy());
    this.pendingBuilds = [];
    this.queueLines?.clear();
    this.buildTarget = null;
    this.buildProgressMs = 0;
    this.buildProgressBg?.setVisible(false);
    this.buildProgressFill?.setVisible(false);
    this.demolishTarget = null;
    this.demolishProgressBg?.setVisible(false);
    this.demolishProgressFill?.setVisible(false);
  }

  /** 모든 구조물 목록 반환 */
  getAllStructures(): PlacedStructure[] { return [...this.structures.values()]; }
  /** 부분 건축 목록 반환 */
  getAllPartialBuilds(): PartialBuild[] { return [...this.partialBuilds.values()]; }
}
