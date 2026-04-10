export interface FoodDef {
  id: string;
  name: string;
  hungerRecovery: number;
  hpChange: number;
  poisonChance: number; // 0~1
}

export const FOOD_DEFS: Record<string, FoodDef> = {
  item_fish: {
    id: 'item_fish',
    name: '물고기',
    hungerRecovery: 10,
    hpChange: -5,
    poisonChance: 0.20,
  },
  item_cooked_fish: {
    id: 'item_cooked_fish',
    name: '구운 생선',
    hungerRecovery: 25,
    hpChange: 0,
    poisonChance: 0,
  },
  item_raw_meat: {
    id: 'item_raw_meat',
    name: '날고기',
    hungerRecovery: 12,
    hpChange: -8,
    poisonChance: 0.35,
  },
  item_cooked_meat: {
    id: 'item_cooked_meat',
    name: '구운 고기',
    hungerRecovery: 30,
    hpChange: 0,
    poisonChance: 0,
  },
  item_fish_stew: {
    id: 'item_fish_stew',
    name: '생선 스튜',
    hungerRecovery: 40,
    hpChange: 30,
    poisonChance: 0,
  },
  item_meat_stew: {
    id: 'item_meat_stew',
    name: '고기 스튜',
    hungerRecovery: 50,
    hpChange: 20,
    poisonChance: 0,
  },
  // ── 작물 식재료 (날 것)
  item_wheat: { id: 'item_wheat', name: '밀', hungerRecovery: 5, hpChange: 0, poisonChance: 0 },
  item_potato: { id: 'item_potato', name: '감자', hungerRecovery: 8, hpChange: 0, poisonChance: 0 },
  item_carrot: { id: 'item_carrot', name: '당근', hungerRecovery: 8, hpChange: 0, poisonChance: 0 },
  item_pumpkin: { id: 'item_pumpkin', name: '호박', hungerRecovery: 10, hpChange: 0, poisonChance: 0 },
  // ── 조리 작물
  item_bread: { id: 'item_bread', name: '밀빵', hungerRecovery: 35, hpChange: 0, poisonChance: 0 },
  item_potato_soup: { id: 'item_potato_soup', name: '감자 스프', hungerRecovery: 45, hpChange: 15, poisonChance: 0 },
  item_carrot_stew: { id: 'item_carrot_stew', name: '당근 스튜', hungerRecovery: 50, hpChange: 25, poisonChance: 0 },
  item_pumpkin_porridge: { id: 'item_pumpkin_porridge', name: '호박죽', hungerRecovery: 30, hpChange: 10, poisonChance: 0 },
  item_baked_potato: { id: 'item_baked_potato', name: '구운 감자', hungerRecovery: 20, hpChange: 0, poisonChance: 0 },
};
