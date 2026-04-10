import { ItemGrade } from './ItemGrade';

export type SpecialEffectId =
  | 'burn_on_hit' | 'poison_on_hit' | 'stun_on_hit'
  | 'lifesteal'   | 'chain_lightning'
  | 'thorns'      | 'damage_reduction' | 'block_chance'
  | 'regen_on_kill'
  | 'gather_bonus' | 'speed_burst' | 'xp_aura'
  | 'lucky_find'   | 'auto_repair'
  | 'soulbound'    | 'set_master';

export interface SpecialEffect {
  id:          SpecialEffectId;
  tier:        1 | 2;
  description: string;
}

export const SPECIAL_EFFECT_DESCRIPTIONS: Record<SpecialEffectId, string> = {
  burn_on_hit:      '타격 시 화상 (15% 확률, 3초)',
  poison_on_hit:    '타격 시 중독 (10% 확률, 5초)',
  stun_on_hit:      '타격 시 기절 (8% 확률, 1.5초)',
  lifesteal:        '타격 시 피해의 8% HP 흡수',
  chain_lightning:  '인접 3적에 연쇄 피해 (50% 감쇠)',
  thorns:           '피격 시 피해 15% 반사',
  damage_reduction: '받는 피해 5~10% 감소',
  block_chance:     '5% 확률로 피해 완전 차단',
  regen_on_kill:    '적 처치 시 HP +15 회복',
  gather_bonus:     '채집량 +1 (나무·돌·어류)',
  speed_burst:      '전투 후 3초간 이속 +20%',
  xp_aura:          '주변 플레이어 XP +10%',
  lucky_find:       '채집·전투 추가 드롭 +5%',
  auto_repair:      '내구도 자동 회복 (0.1/s)',
  soulbound:        '사망 시 내구도 소모 없음',
  set_master:       '세트 효과 추가 발동',
};

const ATTACK_EFFECTS: SpecialEffectId[] = [
  'burn_on_hit', 'poison_on_hit', 'stun_on_hit', 'lifesteal', 'chain_lightning'
];
const DEFENSE_EFFECTS: SpecialEffectId[] = [
  'thorns', 'damage_reduction', 'block_chance', 'regen_on_kill'
];
const PASSIVE_EFFECTS: SpecialEffectId[] = [
  'gather_bonus', 'speed_burst', 'xp_aura', 'lucky_find', 'auto_repair'
];
const LEGENDARY_ONLY: SpecialEffectId[] = ['soulbound', 'set_master'];

export type ItemType = 'weapon' | 'armor' | 'tool' | 'accessory';

export function getEffectPoolForItemType(type: ItemType): SpecialEffectId[] {
  switch (type) {
    case 'weapon':    return [...ATTACK_EFFECTS, ...PASSIVE_EFFECTS];
    case 'armor':     return [...DEFENSE_EFFECTS, ...PASSIVE_EFFECTS];
    case 'tool':      return [...PASSIVE_EFFECTS];
    case 'accessory': return [...PASSIVE_EFFECTS, ...ATTACK_EFFECTS, ...DEFENSE_EFFECTS];
    default:          return [...PASSIVE_EFFECTS];
  }
}

const SPECIAL_CONFIG: Record<ItemGrade, { count: number; maxTier: 1 | 2 }> = {
  normal:    { count: 0, maxTier: 1 },
  uncommon:  { count: 0, maxTier: 1 },
  rare:      { count: 1, maxTier: 1 },
  epic:      { count: 1, maxTier: 2 },
  legendary: { count: 2, maxTier: 2 },
};

export function rollSpecialEffects(grade: ItemGrade, itemType: ItemType): SpecialEffect[] {
  const { count, maxTier } = SPECIAL_CONFIG[grade];
  const pool = getEffectPoolForItemType(itemType);
  if (grade === 'legendary') pool.push(...LEGENDARY_ONLY);

  const results: SpecialEffect[] = [];
  const used: SpecialEffectId[] = [];

  for (let i = 0; i < count; i++) {
    const available = pool.filter(id => !used.includes(id));
    if (!available.length) break;
    const id = available[Math.floor(Math.random() * available.length)];
    const tier = (maxTier === 2 && Math.random() < 0.5) ? 2 : 1;
    results.push({ id, tier, description: SPECIAL_EFFECT_DESCRIPTIONS[id] });
    used.push(id);
  }
  return results;
}
