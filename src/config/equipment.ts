export interface ArmorDef {
  itemId: string;
  label: string;
  defense: number;
}

export interface ShieldDef {
  itemId: string;
  label: string;
  defense: number;
  blockChance: number; // 0.0 ~ 1.0
}

export const ARMOR_DEFS: Record<string, ArmorDef> = {
  item_armor_hide:  { itemId: 'item_armor_hide',  label: '가죽 갑옷',  defense: 3  },
  item_armor_wood:  { itemId: 'item_armor_wood',  label: '목재 갑옷',  defense: 5  },
  item_armor_stone: { itemId: 'item_armor_stone', label: '석재 갑옷',  defense: 9  },
  item_armor_iron:  { itemId: 'item_armor_iron',  label: '철제 갑옷',  defense: 14 },
};

export const SHIELD_DEFS: Record<string, ShieldDef> = {
  item_shield_wood:  { itemId: 'item_shield_wood',  label: '목재 방패', defense: 2, blockChance: 0.15 },
  item_shield_stone: { itemId: 'item_shield_stone', label: '석재 방패', defense: 4, blockChance: 0.25 },
};

// Raw weapon IDs (as used in CombatSystem / InventoryUI) that prevent shield use
export const TWO_HANDED_WEAPONS = new Set(['bow']);

export interface EquipmentSlots {
  armor: string | null;
  shield: string | null;
}
