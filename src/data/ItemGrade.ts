export type ItemGrade = 'normal' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const GRADE_COLORS: Record<ItemGrade, { hex: string; glow: number }> = {
  normal:    { hex: '#a0a0a0', glow: 0xa0a0a0 },
  uncommon:  { hex: '#40c040', glow: 0x40c040 },
  rare:      { hex: '#4080ff', glow: 0x4080ff },
  epic:      { hex: '#d060ff', glow: 0xd060ff },
  legendary: { hex: '#ffc030', glow: 0xffc030 },
};

export const GRADE_LABELS: Record<ItemGrade, string> = {
  normal:    '일반',
  uncommon:  '고급',
  rare:      '희귀',
  epic:      '영웅',
  legendary: '전설',
};

export const GRADE_PREFIXES: Record<ItemGrade, string[]> = {
  normal:    [''],
  uncommon:  ['낡은', '단단한', '예리한', '견고한'],
  rare:      ['정제된', '강화된', '날카로운', '내구의'],
  epic:      ['고대의', '신성한', '저주받은', '불꽃의'],
  legendary: ['전설의', '신화의', '운명의', '용사의'],
};

export const GRADE_STAT_MULTIPLIER: Record<ItemGrade, number> = {
  normal:    1.00,
  uncommon:  1.15,
  rare:      1.35,
  epic:      1.60,
  legendary: 2.00,
};

export function getGradeLabel(grade: ItemGrade): string {
  return GRADE_LABELS[grade];
}

export function rollItemGrade(
  luckBonus = 0,
  sourceType: 'enemy' | 'chest' | 'boss' = 'enemy'
): ItemGrade {
  const bonusMod = luckBonus * 0.003;
  const tables: Record<string, number[]> = {
    enemy: [0.60, 0.28, 0.09, 0.025, 0.005],
    chest: [0.40, 0.35, 0.17, 0.07,  0.01 ],
    boss:  [0.10, 0.30, 0.35, 0.20,  0.05 ],
  };
  const weights = tables[sourceType].map((w, i) =>
    i === 0
      ? Math.max(0.05, w - bonusMod * 4)
      : w + bonusMod * (i === 1 ? 1 : i === 2 ? 1.5 : 2)
  );

  const roll = Math.random();
  let cum = 0;
  const grades: ItemGrade[] = ['normal', 'uncommon', 'rare', 'epic', 'legendary'];
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (roll < cum) return grades[i];
  }
  return 'normal';
}
