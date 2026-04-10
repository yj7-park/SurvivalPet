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
    id: 'cook_fish_stew',
    label: '🍲 생선 스튜',
    category: 'cooking',
    inputs: [{ itemId: 'item_fish', amount: 2 }],
    output: { itemId: 'item_fish_stew', amount: 1 },
    timeMultiplier: 2,
    unlock: { proficiencyLevel: 4, researchId: 'recipe_fish_stew' },
  },
  {
    id: 'cook_meat_stew',
    label: '🍲 고기 스튜',
    category: 'cooking',
    inputs: [{ itemId: 'item_raw_meat', amount: 2 }],
    output: { itemId: 'item_meat_stew', amount: 1 },
    timeMultiplier: 2,
    unlock: { proficiencyLevel: 4, researchId: 'recipe_meat_stew' },
  },
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
  // ── 작물 요리 레시피
  {
    id: 'cook_bread',
    label: '🍞 밀빵',
    category: 'cooking',
    inputs: [{ itemId: 'item_wheat', amount: 3 }],
    output: { itemId: 'item_bread', amount: 1 },
    timeMultiplier: 1.5,
    unlock: { proficiencyLevel: 1 },
  },
  {
    id: 'cook_potato_soup',
    label: '🥣 감자 스프',
    category: 'cooking',
    inputs: [{ itemId: 'item_potato', amount: 2 }, { itemId: 'item_fish', amount: 1 }],
    output: { itemId: 'item_potato_soup', amount: 1 },
    timeMultiplier: 2,
    unlock: { proficiencyLevel: 1 },
  },
  {
    id: 'cook_carrot_stew',
    label: '🥘 당근 스튜',
    category: 'cooking',
    inputs: [{ itemId: 'item_carrot', amount: 3 }, { itemId: 'item_raw_meat', amount: 1 }],
    output: { itemId: 'item_carrot_stew', amount: 1 },
    timeMultiplier: 2,
    unlock: { proficiencyLevel: 1 },
  },
  {
    id: 'cook_pumpkin_porridge',
    label: '🎃 호박죽',
    category: 'cooking',
    inputs: [{ itemId: 'item_pumpkin', amount: 1 }],
    output: { itemId: 'item_pumpkin_porridge', amount: 2 },
    timeMultiplier: 1.5,
    unlock: { proficiencyLevel: 1 },
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
    id: 'craft_hoe',
    label: '⛏ 괭이',
    category: 'tool',
    inputs: [{ itemId: 'item_wood', amount: 3 }],
    output: { itemId: 'item_hoe', amount: 1 },
    timeMultiplier: 0.5,
    unlock: { proficiencyLevel: 1 },
  },
  {
    id: 'craft_watering_can',
    label: '🪣 물뿌리개',
    category: 'tool',
    inputs: [{ itemId: 'item_wood', amount: 4 }],
    output: { itemId: 'item_watering_can', amount: 1 },
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
  // ── 도면 해금 제작물
  {
    id: 'craft_sword_iron',
    label: '⚔ 철제 칼',
    category: 'armor',
    inputs: [
      { itemId: 'item_processed_stone', amount: 8 },
      { itemId: 'item_wood', amount: 3 },
    ],
    output: { itemId: 'item_sword_iron', amount: 1 },
    timeMultiplier: 5,
    unlock: { proficiencyLevel: 6, researchId: 'blueprint_iron_sword' },
  },
  {
    id: 'craft_armor_iron',
    label: '🛡 철제 갑옷',
    category: 'armor',
    inputs: [
      { itemId: 'item_processed_stone', amount: 10 },
      { itemId: 'item_hide', amount: 3 },
    ],
    output: { itemId: 'item_armor_iron', amount: 1 },
    timeMultiplier: 6.67,
    unlock: { proficiencyLevel: 7, researchId: 'blueprint_armor' },
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
