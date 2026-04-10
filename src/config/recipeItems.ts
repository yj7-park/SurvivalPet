import type { ProficiencyType } from '../systems/ProficiencySystem';

export interface RecipeItemDef {
  itemId: string;
  label: string;
  type: 'recipe' | 'blueprint';
  unlocksId: string;       // key passed to ProficiencySystem.unlockByItem()
  requiredProficiency?: { type: ProficiencyType; level: number };
}

export const RECIPE_ITEMS: Record<string, RecipeItemDef> = {
  item_recipe_fish_stew: {
    itemId: 'item_recipe_fish_stew',
    label: '생선 스튜 레시피',
    type: 'recipe',
    unlocksId: 'recipe_fish_stew',
    requiredProficiency: { type: 'cooking', level: 4 },
  },
  item_recipe_meat_stew: {
    itemId: 'item_recipe_meat_stew',
    label: '고기 스튜 레시피',
    type: 'recipe',
    unlocksId: 'recipe_meat_stew',
    requiredProficiency: { type: 'cooking', level: 4 },
  },
  item_blueprint_iron_sword: {
    itemId: 'item_blueprint_iron_sword',
    label: '철제칼 도면',
    type: 'blueprint',
    unlocksId: 'blueprint_iron_sword',
    requiredProficiency: { type: 'crafting', level: 6 },
  },
  item_blueprint_armor: {
    itemId: 'item_blueprint_armor',
    label: '갑옷 도면',
    type: 'blueprint',
    unlocksId: 'blueprint_armor',
    requiredProficiency: { type: 'crafting', level: 7 },
  },
};

export const RECIPE_ITEM_IDS = new Set(Object.keys(RECIPE_ITEMS));
