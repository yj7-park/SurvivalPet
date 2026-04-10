export type Direction = 'down' | 'up' | 'left' | 'right';

export const WEAPON_OFFSETS: Record<Direction, { x: number; y: number; angle: number }> = {
  down:  { x: +10, y: +4,  angle: 0   },
  up:    { x: -10, y: -4,  angle: 180 },
  left:  { x: -8,  y: +2,  angle: -90 },
  right: { x: +8,  y: +2,  angle: 90  },
};

export const SHIELD_OFFSETS: Record<Direction, { x: number; y: number }> = {
  down:  { x: -8, y: +2  },
  up:    { x: +8, y: -2  },
  left:  { x: -6, y: +2  },
  right: { x: +6, y: +2  },
};

export function getWeaponOverlayKey(weaponId: string | null): string | null {
  if (!weaponId) return null;
  const map: Record<string, string> = {
    item_sword_wood:  'overlay_sword_wood',
    item_sword_stone: 'overlay_sword_stone',
    item_sword_iron:  'overlay_sword_iron',
    item_bow:         'overlay_bow',
  };
  return map[weaponId] ?? null;
}

export function getArmorOverlayKey(armorId: string | null): string | null {
  if (!armorId) return null;
  const map: Record<string, string> = {
    item_armor_hide:  'overlay_armor_leather',
    item_armor_wood:  'overlay_armor_wood',
    item_armor_stone: 'overlay_armor_stone',
    item_armor_iron:  'overlay_armor_iron',
  };
  return map[armorId] ?? null;
}

export function getShieldOverlayKey(shieldId: string | null): string | null {
  if (!shieldId) return null;
  const map: Record<string, string> = {
    item_shield_wood:  'overlay_shield_wood',
    item_shield_stone: 'overlay_shield_stone',
  };
  return map[shieldId] ?? null;
}
