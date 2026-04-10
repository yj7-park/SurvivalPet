import { ItemGrade, GRADE_PREFIXES, GRADE_STAT_MULTIPLIER, rollItemGrade } from '../data/ItemGrade';
import { ItemOption, rollOptions } from '../data/ItemOptions';
import { SpecialEffect, rollSpecialEffects, ItemType } from '../data/SpecialEffects';
import { LEGENDARY_ITEMS } from '../data/LegendaryItems';

export { rollItemGrade };

export interface ItemBaseStats {
  attack?:       number;
  defense?:      number;
  speed?:        number;
  durability:    number;
  maxDurability: number;
  weight:        number;
}

export interface ItemData {
  id:             string;
  baseId:         string;
  grade:          ItemGrade;
  name:           string;
  stats:          ItemBaseStats;
  options:        ItemOption[];
  specialEffects: SpecialEffect[];
  enhanceLevel:   number;
}

interface ItemBaseDefinition {
  name:         string;
  type:         ItemType;
  attack?:      number;
  defense?:     number;
  maxDurability: number;
  weight:       number;
}

// Minimal base item table — extend as needed
export const ITEM_BASE_TABLE: Record<string, ItemBaseDefinition> = {
  sword_iron:      { name: '철검',     type: 'weapon',    attack: 12, maxDurability: 80,  weight: 3 },
  axe_iron:        { name: '철도끼',   type: 'weapon',    attack: 10, maxDurability: 90,  weight: 4 },
  bow_wood:        { name: '나무 활',  type: 'weapon',    attack: 8,  maxDurability: 60,  weight: 2 },
  armor_iron:      { name: '철갑옷',   type: 'armor',     defense: 10, maxDurability: 100, weight: 8 },
  helmet_leather:  { name: '가죽 투구', type: 'armor',    defense: 4,  maxDurability: 60,  weight: 2 },
  fishing_rod:     { name: '낚싯대',   type: 'tool',      maxDurability: 50,  weight: 1 },
  pickaxe_iron:    { name: '철 곡괭이', type: 'tool',     attack: 6,  maxDurability: 80,  weight: 3 },
};

let _uuidCounter = 0;
function generateId(): string {
  return `item_${Date.now()}_${++_uuidCounter}`;
}

export function createItem(
  baseId:   string,
  grade:    ItemGrade,
  legendaryId?: string
): ItemData {
  const base = ITEM_BASE_TABLE[baseId];
  if (!base) throw new Error(`Unknown baseId: ${baseId}`);

  const multi  = GRADE_STAT_MULTIPLIER[grade];
  const legend = legendaryId ? LEGENDARY_ITEMS[legendaryId] : undefined;

  // Name
  const prefixes = GRADE_PREFIXES[grade];
  const prefix   = prefixes[Math.floor(Math.random() * prefixes.length)];
  const name     = legend?.name ?? (prefix ? `${prefix} ${base.name}` : base.name);

  // Stats
  const stats: ItemBaseStats = {
    attack:        base.attack  ? Math.round(base.attack  * multi) : undefined,
    defense:       base.defense ? Math.round(base.defense * multi) : undefined,
    durability:    Math.round(base.maxDurability * multi),
    maxDurability: Math.round(base.maxDurability * multi),
    weight:        base.weight,
  };

  const options        = legend?.fixedOptions ?? rollOptions(grade);
  const specialEffects = legend?.specialEffects ?? rollSpecialEffects(grade, base.type);

  return { id: generateId(), baseId, grade, name, stats, options, specialEffects, enhanceLevel: 0 };
}

export function createLegendaryItem(legendaryId: string): ItemData {
  const tpl = LEGENDARY_ITEMS[legendaryId];
  if (!tpl) throw new Error(`Unknown legendary: ${legendaryId}`);
  return createItem(tpl.baseId, 'legendary', legendaryId);
}
