export type ProficiencyType =
  | 'cooking' | 'crafting' | 'building'
  | 'woodcutting' | 'mining' | 'fishing' | 'combat';

export const PROF_NAMES: Record<ProficiencyType, string> = {
  cooking: '요리', crafting: '제작', building: '건축',
  woodcutting: '벌목', mining: '채광', fishing: '낚시', combat: '전투',
};

const MAX_LEVEL = 10;

/** 레벨업 누적 XP: Math.round(50 * lvl * (lvl + 1) / 2) */
function requiredXP(level: number): number {
  return Math.round(50 * level * (level + 1) / 2);
}

export interface ProficiencyData {
  level: number;
  xp: number;      // 현재 레벨 내 누적 XP
  totalXp: number; // 전체 누적 XP
}

export class ProficiencySystem {
  private data = new Map<ProficiencyType, ProficiencyData>();
  private unlockedByResearch = new Set<string>();
  private onLevelUp: ((type: ProficiencyType, newLevel: number) => void) | null = null;

  constructor() {
    const types: ProficiencyType[] = ['cooking', 'crafting', 'building', 'woodcutting', 'mining', 'fishing', 'combat'];
    for (const t of types) {
      this.data.set(t, { level: 1, xp: 0, totalXp: 0 });
    }
  }

  setOnLevelUp(cb: (type: ProficiencyType, newLevel: number) => void): void {
    this.onLevelUp = cb;
  }

  addXP(type: ProficiencyType, amount: number): void {
    const d = this.data.get(type)!;
    if (d.level >= MAX_LEVEL) return;

    d.xp += amount;
    d.totalXp += amount;

    while (d.level < MAX_LEVEL) {
      const needed = requiredXP(d.level);
      if (d.xp < needed) break;
      d.xp -= needed;
      d.level++;
      this.onLevelUp?.(type, d.level);
    }
  }

  getLevel(type: ProficiencyType): number {
    return this.data.get(type)!.level;
  }

  getXP(type: ProficiencyType): number {
    return this.data.get(type)!.xp;
  }

  getXPToNextLevel(type: ProficiencyType): number {
    const d = this.data.get(type)!;
    if (d.level >= MAX_LEVEL) return 0;
    return requiredXP(d.level);
  }

  /** 숙련도 속도 보정 배율 (레벨 1: 1.0×, 레벨 10: 0.4×) */
  getSpeedMultiplier(type: ProficiencyType): number {
    const lvl = this.getLevel(type);
    return Math.max(0.4, 1.0 - (lvl - 1) * 0.07);
  }

  isRecipeUnlocked(recipeId: string, requiredLevel: number, profType: ProficiencyType): boolean {
    if (this.unlockedByResearch.has(recipeId)) return true;
    return this.getLevel(profType) >= requiredLevel;
  }

  unlockByResearch(researchId: string): void {
    this.unlockedByResearch.add(researchId);
  }

  isUnlockedByResearch(id: string): boolean {
    return this.unlockedByResearch.has(id);
  }
}
