export type StatKey = 'STR' | 'AGI' | 'CON' | 'INT' | 'LUK';

export interface CharacterStats {
  STR: number;
  AGI: number;
  CON: number;
  INT: number;
  LUK: number;

  // Derived
  maxHp:       number;
  moveSpeed:   number;
  attackPower: number;
  critChance:  number;
  craftSpeed:  number;
  dropBonus:   number;
}

export const BASE_STATS: CharacterStats = {
  STR: 1, AGI: 1, CON: 1, INT: 1, LUK: 1,
  maxHp: 90, moveSpeed: 123, attackPower: 7,
  critChance: 0.035, craftSpeed: 1.04, dropBonus: 0.01,
};

export const STAT_CAP = 30;

export const DERIVED_CAPS = {
  moveSpeed:  240,
  critChance: 0.50,
  craftSpeed: 2.20,
};

export const STARTER_BUILDS: Record<string, Partial<Record<StatKey, number>>> = {
  warrior:  { STR: 3, CON: 2 },
  scout:    { AGI: 3, LUK: 2 },
  builder:  { INT: 3, CON: 2 },
  survivor: { CON: 3, INT: 2 },
  balanced: { STR: 1, AGI: 1, CON: 1, INT: 1, LUK: 1 },
};

export function calcDerivedStats(base: Pick<CharacterStats, StatKey>): CharacterStats {
  return {
    ...base,
    maxHp:       80 + base.CON * 10,
    moveSpeed:   Math.min(DERIVED_CAPS.moveSpeed, 120 + base.AGI * 3),
    attackPower: 5  + base.STR * 2,
    critChance:  Math.min(DERIVED_CAPS.critChance, 0.03 + base.LUK * 0.005),
    craftSpeed:  Math.min(DERIVED_CAPS.craftSpeed, 1.0  + base.INT * 0.04),
    dropBonus:   base.LUK * 0.01,
  };
}

export function clampStat(value: number): number {
  return Math.max(1, Math.min(STAT_CAP, value));
}
