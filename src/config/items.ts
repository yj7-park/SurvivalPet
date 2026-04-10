export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export const RARITY_BORDER_HEX: Record<ItemRarity, number> = {
  common:   0x3a2a14,
  uncommon: 0x2a6a2a,
  rare:     0x2a3a8a,
  epic:     0x6a2a8a,
};

export const RARITY_BORDER_CSS: Record<ItemRarity, string> = {
  common:   '#3a2a14',
  uncommon: '#2a6a2a',
  rare:     '#2a3a8a',
  epic:     '#6a2a8a',
};

export const ITEM_RARITY: Record<string, ItemRarity> = {
  // Common resources
  item_wood:            'common',
  item_stone:           'common',
  item_processed_stone: 'common',
  item_hide:            'common',
  item_fish:            'common',
  item_raw_meat:        'common',

  // Common food
  item_cooked_fish:     'common',
  item_cooked_meat:     'common',
  item_fish_stew:       'uncommon',
  item_meat_stew:       'uncommon',

  // Common crops
  item_wheat:           'common',
  item_carrot:          'common',
  item_potato:          'common',
  item_pumpkin:         'common',
  item_bread:           'uncommon',
  item_carrot_stew:     'uncommon',
  item_potato_soup:     'uncommon',
  item_pumpkin_porridge:'uncommon',
  item_baked_potato:    'common',

  // Seeds
  item_seed_wheat:      'common',
  item_seed_carrot:     'common',
  item_seed_potato:     'common',
  item_seed_pumpkin:    'common',

  // Tools
  item_hoe:             'common',
  item_watering_can:    'common',
  item_torch:           'common',

  // Weapons
  item_sword_wood:      'common',
  item_sword_stone:     'uncommon',
  item_sword_iron:      'rare',
  item_bow:             'uncommon',

  // Armor
  item_armor_hide:      'common',
  item_armor_wood:      'common',
  item_armor_stone:     'uncommon',
  item_armor_iron:      'rare',

  // Shields
  item_shield_wood:     'common',
  item_shield_stone:    'uncommon',

  // Rare drops
  item_tiger_fang:      'rare',

  // Blueprints / recipes
  item_recipe_fish_stew:       'epic',
  item_recipe_meat_stew:       'epic',
  item_blueprint_iron_sword:   'epic',
  item_blueprint_armor:        'epic',
};

export function getItemRarity(itemId: string): ItemRarity {
  return ITEM_RARITY[itemId] ?? 'common';
}
