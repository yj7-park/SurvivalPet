import { ItemGrade } from './ItemGrade';
import { SpecialEffect } from './SpecialEffects';
import { ItemOption } from './ItemOptions';

export interface LegendaryTemplate {
  baseId: string;
  name:   string;
  grade:  ItemGrade;
  specialEffects: SpecialEffect[];
  fixedOptions?:  ItemOption[];
}

export const LEGENDARY_ITEMS: Record<string, LegendaryTemplate> = {
  blade_of_dawn: {
    baseId: 'sword_iron',
    name:   '새벽의 검',
    grade:  'legendary',
    specialEffects: [
      { id: 'chain_lightning', tier: 2, description: '공격 시 인접 3적에 연쇄 피해' },
      { id: 'speed_burst',     tier: 2, description: '처치 후 3초간 이속 +30%'       },
    ],
  },
  shield_of_thorns: {
    baseId: 'armor_iron',
    name:   '가시의 갑옷',
    grade:  'legendary',
    specialEffects: [
      { id: 'thorns',        tier: 2, description: '피해 25% 반사'       },
      { id: 'regen_on_kill', tier: 2, description: '처치 시 HP +25 회복' },
    ],
  },
  rod_of_fortune: {
    baseId: 'fishing_rod',
    name:   '행운의 낚싯대',
    grade:  'legendary',
    specialEffects: [
      { id: 'lucky_find', tier: 2, description: '낚시 시 희귀 아이템 +15% 확률' },
      { id: 'xp_aura',    tier: 1, description: '주변 플레이어 XP +10%'          },
    ],
  },
  axe_of_the_ancient: {
    baseId: 'axe_iron',
    name:   '고대의 도끼',
    grade:  'legendary',
    specialEffects: [
      { id: 'gather_bonus',  tier: 2, description: '채집량 +2 (나무·돌)' },
      { id: 'burn_on_hit',   tier: 2, description: '타격 시 화상 30% 확률, 5초' },
    ],
  },
  crown_of_wisdom: {
    baseId: 'helmet_leather',
    name:   '지혜의 왕관',
    grade:  'legendary',
    specialEffects: [
      { id: 'xp_aura',    tier: 2, description: '주변 플레이어 XP +20%' },
      { id: 'auto_repair', tier: 1, description: '내구도 자동 회복 0.2/s' },
    ],
    fixedOptions: [
      { type: 'int_bonus', value: 8, isPercent: false },
      { type: 'luk_bonus', value: 5, isPercent: false },
      { type: 'xp_bonus',  value: 15, isPercent: true },
    ],
  },
};
