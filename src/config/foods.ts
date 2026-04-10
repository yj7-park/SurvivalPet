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
};
