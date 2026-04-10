export type WeaponType = 'melee' | 'ranged';

export interface WeaponConfig {
  id: string;
  name: string;
  type: WeaponType;
  baseDamage: number;
  baseCooldownSec: number;
  rangeTiles: number;
  projectileSpeed?: number; // px/s, ranged only
  recipe: { itemId: string; amount: number }[];
  craftTimeSec: number; // at STR 5
  requiredCraftLevel: number; // crafting proficiency level required
}

export const WEAPONS: WeaponConfig[] = [
  {
    id: 'fists', name: '맨손', type: 'melee',
    baseDamage: 5, baseCooldownSec: 2.0, rangeTiles: 1,
    recipe: [], craftTimeSec: 0, requiredCraftLevel: 1,
  },
  {
    id: 'bow', name: '활', type: 'ranged',
    baseDamage: 8, baseCooldownSec: 2.0, rangeTiles: 8,
    projectileSpeed: 300,
    recipe: [{ itemId: 'item_wood', amount: 8 }], craftTimeSec: 6,
    requiredCraftLevel: 2,
  },
  {
    id: 'sword_wood', name: '나무 칼', type: 'melee',
    baseDamage: 14, baseCooldownSec: 1.5, rangeTiles: 1.5,
    recipe: [{ itemId: 'item_wood', amount: 6 }], craftTimeSec: 5,
    requiredCraftLevel: 2,
  },
  {
    id: 'sword_stone', name: '석재 칼', type: 'melee',
    baseDamage: 22, baseCooldownSec: 1.5, rangeTiles: 1.5,
    recipe: [
      { itemId: 'item_wood', amount: 4 },
      { itemId: 'item_processed_stone', amount: 4 },
    ],
    craftTimeSec: 8, requiredCraftLevel: 5,
  },
  {
    id: 'sword_iron', name: '철제 칼', type: 'melee',
    baseDamage: 18, baseCooldownSec: 1.0, rangeTiles: 1.5,
    recipe: [
      { itemId: 'item_processed_stone', amount: 8 },
      { itemId: 'item_wood', amount: 3 },
    ],
    craftTimeSec: 30, requiredCraftLevel: 6,
  },
];

export function calcDamage(weapon: WeaponConfig | null, STR: number): number {
  return (weapon?.baseDamage ?? 5) + STR * 2;
}

export function calcCooldownMs(weapon: WeaponConfig | null, AGI: number): number {
  const base = weapon?.baseCooldownSec ?? 2.0;
  return Math.max(600, (base - (AGI - 5) * 0.1) * 1000);
}

export function calcDodgeChance(AGI: number): number {
  return Math.min(0.4, AGI * 0.04);
}
