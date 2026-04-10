import { TILE_SIZE } from '../world/MapGenerator';
import { Inventory } from './Inventory';
import { CharacterStats } from '../entities/CharacterStats';
import { PlacedStructure, STRUCTURE_DEFS, StructMaterial } from './BuildSystem';

// 재료별 하루 내구도 감소량 (게임 내 1일 = 현실 30분 = 1,800,000ms)
const DECAY_PER_DAY: Record<StructMaterial, number> = { wood: 5, stone: 2 };
const MS_PER_DAY = 1_800_000;

export type DamageResult =
  | { alive: true; durability: number }
  | { alive: false };

export type RepairResult =
  | { ok: true; recovered: number; cost: number }
  | { ok: false; reason: 'insufficient_materials' | 'already_full' | 'not_found' };

/** 균열 레벨: 0=없음, 1=가벼운, 2=심한, 3=붕괴 직전 */
export function getCrackLevel(durRatio: number): 0 | 1 | 2 | 3 {
  if (durRatio >= 0.70) return 0;
  if (durRatio >= 0.40) return 1;
  if (durRatio >= 0.20) return 2;
  return 3;
}

/** 내구도 비율에 따른 스프라이트 틴트 색상 (0xRRGGBB) */
export function getDurabilityTint(durRatio: number): number {
  if (durRatio >= 0.70) return 0xffffff;
  if (durRatio >= 0.40) return 0xffffaa;
  if (durRatio >= 0.20) return 0xffcc44;
  return 0xff5522;
}

/** 수리 비용 계산 */
export function calcRepairCost(struct: PlacedStructure, full: boolean): { itemKey: string; count: number }[] {
  const def = STRUCTURE_DEFS[struct.defName];
  if (!def) return [];
  const cost = struct.material === 'wood' ? def.woodCost : def.stoneCost;
  const ratio = full ? 0.8 : 0.2;
  return Object.entries(cost).map(([itemKey, count]) => ({
    itemKey,
    count: Math.max(1, Math.floor(count * ratio)),
  }));
}

/** 수리 회복량 */
export function calcRepairAmount(struct: PlacedStructure, full: boolean): number {
  if (full) return struct.maxDurability - struct.durability;
  return Math.floor(struct.maxDurability * 0.3);
}

/** 수리 소요 시간 (ms) */
export function calcRepairTime(full: boolean, str: number): number {
  const base = full ? 20000 : 5000;
  const bonus = (str - 5) * (full ? 1200 : 300);
  return Math.max(full ? 8000 : 2000, base - bonus);
}

export class DurabilitySystem {
  /** 시간 경과에 의한 자연 노후화. Returns list of destroyed structure tile keys. */
  update(delta: number, structures: PlacedStructure[], roofedTiles: Set<string>): string[] {
    const destroyed: string[] = [];
    for (const s of structures) {
      const isIndoor = roofedTiles.has(`${s.tileX},${s.tileY}`);
      const decayMult = isIndoor ? 0.5 : 1.0;
      const decay = (DECAY_PER_DAY[s.material] / MS_PER_DAY) * delta * decayMult;
      s.durability = Math.max(0, s.durability - decay);
      const ratio = s.durability / s.maxDurability;
      s.sprite.setTint(getDurabilityTint(ratio));
      if (s.durability <= 0) {
        destroyed.push(`${s.tileX},${s.tileY}`);
      }
    }
    return destroyed;
  }

  /** 피해 적용. 반환값이 alive:false 이면 호출자가 buildSystem.removeStructureAt()을 호출해야 함 */
  applyDamage(struct: PlacedStructure, amount: number): DamageResult {
    struct.durability = Math.max(0, struct.durability - amount);
    const ratio = struct.durability / struct.maxDurability;
    struct.sprite.setTint(getDurabilityTint(ratio));
    if (struct.durability <= 0) return { alive: false };
    return { alive: true, durability: struct.durability };
  }

  /** 수리 실행 (자원 소모 포함). 시간 처리는 GameScene에서 */
  repair(
    struct: PlacedStructure,
    full: boolean,
    inventory: Inventory,
    _charStats: CharacterStats,
  ): RepairResult {
    if (struct.durability >= struct.maxDurability) {
      return { ok: false, reason: 'already_full' };
    }
    const costs = calcRepairCost(struct, full);
    // Check materials
    for (const { itemKey, count } of costs) {
      if (!inventory.has(itemKey, count)) {
        return { ok: false, reason: 'insufficient_materials' };
      }
    }
    // Consume materials
    for (const { itemKey, count } of costs) {
      inventory.remove(itemKey, count);
    }
    const amount = calcRepairAmount(struct, full);
    struct.durability = Math.min(struct.maxDurability, struct.durability + amount);
    struct.sprite.setTint(getDurabilityTint(struct.durability / struct.maxDurability));
    const totalCost = costs.reduce((sum, c) => sum + c.count, 0);
    return { ok: true, recovered: amount, cost: totalCost };
  }

  /** 근접 시 내구도 바 위치 계산 */
  getDurabilityBarPos(struct: PlacedStructure): { x: number; y: number } {
    return {
      x: struct.tileX * TILE_SIZE,
      y: struct.tileY * TILE_SIZE - 4,
    };
  }
}
