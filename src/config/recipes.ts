export interface Recipe {
  id: string;
  label: string;
  category: 'weapon' | 'material' | 'tool' | 'cooking' | 'armor';
  inputs: { itemId: string; amount: number }[];
  output: { itemId: string; amount: number };
  timeMultiplier: number; // applied to cookTime or craftTime
  unlock: {
    proficiencyLevel: number; // required cooking (for cooking) or crafting (for crafting) level
    researchId?: string;      // OR research completion unlocks this
  };
}

// ── 요리 레시피 (cookTime 기준)
export const COOKING_RECIPES: Recipe[] = [
  {
    id: 'cook_fish_1',
    label: '🐟 생선 굽기',
    category: 'cooking',
    inputs: [{ itemId: 'item_fish', amount: 1 }],
    output: { itemId: 'item_cooked_fish', amount: 1 },
    timeMultiplier: 1,
    unlock: { proficiencyLevel: 1 },
  },
  {
    id: 'cook_meat_1',
    label: '🥩 고기 굽기',
    category: 'cooking',
    inputs: [{ itemId: 'item_raw_meat', amount: 1 }],
    output: { itemId: 'item_cooked_meat', amount: 1 },
    timeMultiplier: 1.25,
    unlock: { proficiencyLevel: 1 },
  },
  {
    id: 'cook_fish_2',
    label: '🐟🐟 생선 ×2 굽기',
    category: 'cooking',
    inputs: [{ itemId: 'item_fish', amount: 2 }],
    output: { itemId: 'item_cooked_fish', amount: 2 },
    timeMultiplier: 1.5,
    unlock: { proficiencyLevel: 3 },
  },
  {
    id: 'cook_meat_2',
    label: '🥩🥩 고기 ×2 굽기',
    category: 'cooking',
    inputs: [{ itemId: 'item_raw_meat', amount: 2 }],
    output: { itemId: 'item_cooked_meat', amount: 2 },
    timeMultiplier: 1.875,
    unlock: { proficiencyLevel: 3 },
  },
];

// ── 제작 레시피 (craftTime 기준)
export const CRAFTING_RECIPES: Recipe[] = [
  {
    id: 'craft_torch',
    label: '🔥 횃불',
    category: 'tool',
    inputs: [{ itemId: 'item_wood', amount: 2 }],
    output: { itemId: 'item_torch', amount: 1 },
    timeMultiplier: 0.333,
    unlock: { proficiencyLevel: 1 },
  },
  {
    id: 'craft_fishing_rod',
    label: '🎣 낚싯대',
    category: 'tool',
    inputs: [{ itemId: 'item_wood', amount: 3 }],
    output: { itemId: 'item_fishing_rod', amount: 1 },
    timeMultiplier: 0.667,
    unlock: { proficiencyLevel: 1 },
  },
  {
    id: 'craft_processed_stone',
    label: '🧱 가공석 ×5',
    category: 'material',
    inputs: [{ itemId: 'item_stone', amount: 10 }],
    output: { itemId: 'item_processed_stone', amount: 5 },
    timeMultiplier: 1,
    unlock: { proficiencyLevel: 4 },
  },
  // ── 방어구
  {
    id: 'craft_armor_hide',
    label: '🦺 가죽 갑옷',
    category: 'armor',
    inputs: [{ itemId: 'item_hide', amount: 4 }],
    output: { itemId: 'item_armor_hide', amount: 1 },
    timeMultiplier: 1.5,
    unlock: { proficiencyLevel: 2 },
  },
  {
    id: 'craft_armor_wood',
    label: '🪵 목재 갑옷',
    category: 'armor',
    inputs: [{ itemId: 'item_wood', amount: 8 }],
    output: { itemId: 'item_armor_wood', amount: 1 },
    timeMultiplier: 2,
    unlock: { proficiencyLevel: 3 },
  },
  {
    id: 'craft_armor_stone',
    label: '🧱 석재 갑옷',
    category: 'armor',
    inputs: [
      { itemId: 'item_processed_stone', amount: 6 },
      { itemId: 'item_hide', amount: 2 },
    ],
    output: { itemId: 'item_armor_stone', amount: 1 },
    timeMultiplier: 3,
    unlock: { proficiencyLevel: 5 },
  },
  // ── 방패
  {
    id: 'craft_shield_wood',
    label: '🛡 목재 방패',
    category: 'armor',
    inputs: [{ itemId: 'item_wood', amount: 5 }],
    output: { itemId: 'item_shield_wood', amount: 1 },
    timeMultiplier: 1.5,
    unlock: { proficiencyLevel: 2 },
  },
  {
    id: 'craft_shield_stone',
    label: '🛡 석재 방패',
    category: 'armor',
    inputs: [
      { itemId: 'item_processed_stone', amount: 4 },
      { itemId: 'item_wood', amount: 2 },
    ],
    output: { itemId: 'item_shield_stone', amount: 1 },
    timeMultiplier: 2.5,
    unlock: { proficiencyLevel: 4 },
  },
];
