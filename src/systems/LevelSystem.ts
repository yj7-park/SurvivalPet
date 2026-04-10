import { CharacterStats, StatKey, calcDerivedStats, BASE_STATS } from './CharacterStats';

export const MAX_LEVEL = 50;

export type XpSource =
  | 'kill_normal' | 'kill_boss' | 'harvest_tree' | 'harvest_stone'
  | 'fish' | 'build_complete' | 'cook_complete' | 'craft_complete'
  | 'sleep' | 'explore_new' | 'rare_item';

const XP_TABLE: Record<XpSource, number> = {
  kill_normal:    20,
  kill_boss:     150,
  harvest_tree:    3,
  harvest_stone:   3,
  fish:            5,
  build_complete: 10,
  cook_complete:   8,
  craft_complete:  6,
  sleep:           5,
  explore_new:    15,
  rare_item:      30,
};

export function requiredXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 1.6));
}

export function xpForSource(source: XpSource): number {
  return XP_TABLE[source] ?? 0;
}

export interface LevelUpReward {
  statPoints: number;
  hpRestore:  boolean;
}

export function getLevelUpReward(newLevel: number): LevelUpReward {
  return {
    statPoints: newLevel % 5 === 0 ? 3 : 2,
    hpRestore:  true,
  };
}

export interface PlayerLevelData {
  level:         number;
  xp:            number;
  unspentPoints: number;
  stats:         Pick<CharacterStats, StatKey>;
}

export function createDefaultLevelData(): PlayerLevelData {
  return {
    level:         1,
    xp:            0,
    unspentPoints: 5,
    stats: { STR: 1, AGI: 1, CON: 1, INT: 1, LUK: 1 },
  };
}

export function addXp(
  data: PlayerLevelData,
  source: XpSource,
  onLevelUp?: (newLevel: number, reward: LevelUpReward) => void
): PlayerLevelData {
  if (data.level >= MAX_LEVEL) return data;

  let { xp, level, unspentPoints } = data;
  xp += xpForSource(source);

  while (level < MAX_LEVEL) {
    const needed = requiredXpForLevel(level + 1);
    if (xp < needed) break;
    level++;
    const reward = getLevelUpReward(level);
    unspentPoints += reward.statPoints;
    onLevelUp?.(level, reward);
  }

  return { ...data, xp, level, unspentPoints };
}

export function getXpProgress(data: PlayerLevelData): { current: number; required: number; ratio: number } {
  if (data.level >= MAX_LEVEL) return { current: 0, required: 0, ratio: 1 };
  const prevXp  = requiredXpForLevel(data.level);
  const nextXp  = requiredXpForLevel(data.level + 1);
  const current = data.xp - prevXp;
  const required = nextXp - prevXp;
  return { current, required, ratio: Math.min(1, current / required) };
}

export function getTotalSpentPoints(data: PlayerLevelData): number {
  const base = BASE_STATS;
  return (
    (data.stats.STR - base.STR) +
    (data.stats.AGI - base.AGI) +
    (data.stats.CON - base.CON) +
    (data.stats.INT - base.INT) +
    (data.stats.LUK - base.LUK)
  );
}

export function resetStats(data: PlayerLevelData): PlayerLevelData {
  const spent = getTotalSpentPoints(data);
  return {
    ...data,
    stats: { STR: 1, AGI: 1, CON: 1, INT: 1, LUK: 1 },
    unspentPoints: data.unspentPoints + spent,
  };
}
