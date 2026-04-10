export interface DropEntry {
  itemId: string;
  amountMin: number;
  amountMax: number;
  chance: number; // 0.0 ~ 1.0
}

export interface DropTable {
  enemyType: string;
  drops: DropEntry[];
  guaranteedDrops?: DropEntry[];
}

export const DROP_TABLES: Record<string, DropTable> = {
  tiger: {
    enemyType: 'tiger',
    guaranteedDrops: [
      { itemId: 'item_raw_meat', amountMin: 2, amountMax: 3, chance: 1.0 },
    ],
    drops: [
      { itemId: 'item_hide',           amountMin: 1, amountMax: 2, chance: 0.70 },
      { itemId: 'item_recipe_meat_stew', amountMin: 1, amountMax: 1, chance: 0.15 },
    ],
  },
  enemy_raider: {
    enemyType: 'enemy_raider',
    drops: [
      { itemId: 'item_wood',                   amountMin: 3, amountMax: 5, chance: 0.50 },
      { itemId: 'item_blueprint_iron_sword',   amountMin: 1, amountMax: 1, chance: 0.05 },
      { itemId: 'item_seed_wheat',             amountMin: 1, amountMax: 2, chance: 0.05 },
    ],
  },
  enemy_raider_boss: {
    enemyType: 'enemy_raider_boss',
    drops: [
      { itemId: 'item_processed_stone',        amountMin: 3, amountMax: 5, chance: 0.70 },
      { itemId: 'item_blueprint_armor',        amountMin: 1, amountMax: 1, chance: 0.20 },
      { itemId: 'item_recipe_fish_stew',       amountMin: 1, amountMax: 1, chance: 0.25 },
    ],
  },
};
