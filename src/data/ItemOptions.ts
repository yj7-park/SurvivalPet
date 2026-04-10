import { ItemGrade } from './ItemGrade';

export type OptionType =
  | 'str_bonus' | 'agi_bonus' | 'con_bonus'
  | 'int_bonus' | 'luk_bonus'
  | 'hp_bonus'  | 'speed_bonus'
  | 'attack_bonus' | 'defense_bonus'
  | 'crit_bonus'   | 'crit_dmg_bonus'
  | 'durability_bonus' | 'xp_bonus';

export interface ItemOption {
  type:      OptionType;
  value:     number;
  isPercent: boolean;
}

const OPTION_LABELS: Record<OptionType, string> = {
  str_bonus:        '힘',
  agi_bonus:        '민첩',
  con_bonus:        '체력',
  int_bonus:        '지력',
  luk_bonus:        '행운',
  hp_bonus:         'HP',
  speed_bonus:      '이동속도',
  attack_bonus:     '공격력',
  defense_bonus:    '방어력',
  crit_bonus:       '크리티컬',
  crit_dmg_bonus:   '크리티컬 피해',
  durability_bonus: '내구도',
  xp_bonus:         'XP 획득',
};

const PERCENT_OPTIONS: OptionType[] = [
  'speed_bonus', 'attack_bonus', 'defense_bonus',
  'crit_bonus', 'crit_dmg_bonus', 'xp_bonus'
];

const OPTION_RANGES: Record<OptionType, [number, number]> = {
  str_bonus:        [1, 4],
  agi_bonus:        [1, 4],
  con_bonus:        [1, 4],
  int_bonus:        [1, 4],
  luk_bonus:        [1, 4],
  hp_bonus:         [10, 40],
  speed_bonus:      [2, 8],
  attack_bonus:     [3, 12],
  defense_bonus:    [3, 12],
  crit_bonus:       [1, 4],
  crit_dmg_bonus:   [5, 20],
  durability_bonus: [10, 40],
  xp_bonus:         [3, 10],
};

const GRADE_OPTION_MULTIPLIER: Record<ItemGrade, number> = {
  normal: 1, uncommon: 1.2, rare: 1.5, epic: 2.0, legendary: 2.8
};

const OPTION_COUNT: Record<ItemGrade, number> = {
  normal: 0, uncommon: 1, rare: 2, epic: 3, legendary: 3
};

function rollOption(grade: ItemGrade, exclude: OptionType[] = []): ItemOption {
  const pool = (Object.keys(OPTION_RANGES) as OptionType[]).filter(k => !exclude.includes(k));
  const type = pool[Math.floor(Math.random() * pool.length)];
  const [min, max] = OPTION_RANGES[type];
  const m = GRADE_OPTION_MULTIPLIER[grade];
  const value = Math.round((min + Math.random() * (max - min)) * m);
  return { type, value, isPercent: PERCENT_OPTIONS.includes(type) };
}

export function rollOptions(grade: ItemGrade): ItemOption[] {
  const count = OPTION_COUNT[grade];
  const options: ItemOption[] = [];
  const used: OptionType[] = [];
  for (let i = 0; i < count; i++) {
    const opt = rollOption(grade, used);
    options.push(opt);
    used.push(opt.type);
  }
  return options;
}

export function getOptionLabel(type: OptionType): string {
  return OPTION_LABELS[type] ?? type;
}
