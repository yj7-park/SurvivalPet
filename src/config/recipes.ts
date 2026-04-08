export interface Recipe {
  id: string;
  label: string;
  category: 'weapon' | 'material' | 'tool' | 'cooking';
  inputs: { itemId: string; amount: number }[];
  output: { itemId: string; amount: number };
  timeMultiplier: number; // applied to cookTime or craftTime
}

// ── 요리 레시피 (cookTime 기준)
// 배율: ×1, ×1.25, ×1.5, ×1.875
export const COOKING_RECIPES: Recipe[] = [
  {
    id: 'cook_fish_1',
    label: '🐟 생선 굽기',
    category: 'cooking',
    inputs: [{ itemId: 'item_fish', amount: 1 }],
    output: { itemId: 'item_cooked_fish', amount: 1 },
    timeMultiplier: 1,
  },
  {
    id: 'cook_meat_1',
    label: '🥩 고기 굽기',
    category: 'cooking',
    inputs: [{ itemId: 'item_raw_meat', amount: 1 }],
    output: { itemId: 'item_cooked_meat', amount: 1 },
    timeMultiplier: 1.25,
  },
  {
    id: 'cook_fish_2',
    label: '🐟🐟 생선 ×2 굽기',
    category: 'cooking',
    inputs: [{ itemId: 'item_fish', amount: 2 }],
    output: { itemId: 'item_cooked_fish', amount: 2 },
    timeMultiplier: 1.5,
  },
  {
    id: 'cook_meat_2',
    label: '🥩🥩 고기 ×2 굽기',
    category: 'cooking',
    inputs: [{ itemId: 'item_raw_meat', amount: 2 }],
    output: { itemId: 'item_cooked_meat', amount: 2 },
    timeMultiplier: 1.875,
  },
];

// ── 제작 레시피 (craftTime 기준)
// 가공석: 6s base × 1.0, 낚싯대: 4s → ×0.667, 횃불: 2s → ×0.333
export const CRAFTING_RECIPES: Recipe[] = [
  {
    id: 'craft_processed_stone',
    label: '🧱 가공석 ×5',
    category: 'material',
    inputs: [{ itemId: 'item_stone', amount: 10 }],
    output: { itemId: 'item_processed_stone', amount: 5 },
    timeMultiplier: 1,
  },
  {
    id: 'craft_fishing_rod',
    label: '🎣 낚싯대',
    category: 'tool',
    inputs: [{ itemId: 'item_wood', amount: 3 }],
    output: { itemId: 'item_fishing_rod', amount: 1 },
    timeMultiplier: 0.667,
  },
  {
    id: 'craft_torch',
    label: '🔥 횃불',
    category: 'tool',
    inputs: [{ itemId: 'item_wood', amount: 2 }],
    output: { itemId: 'item_torch', amount: 1 },
    timeMultiplier: 0.333,
  },
];
