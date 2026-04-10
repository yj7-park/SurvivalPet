import type { Season } from '../systems/GameTime';

export type CropType = 'wheat' | 'potato' | 'carrot' | 'pumpkin';

export const CROP_SEASONS: Record<CropType, Season[]> = {
  wheat:   ['spring', 'summer', 'autumn'],
  potato:  ['spring', 'autumn'],
  carrot:  ['spring', 'summer'],
  pumpkin: ['summer'],
};

/** 하루(1틱) 당 성장 진행도 증가량 (wetMult×weatherMult 적용 전) */
export const CROP_GROW_SPEED: Record<CropType, number> = {
  wheat:   1.0,   // 1일/단계 → 2일 완숙
  potato:  0.667, // ~1.5일/단계 → ~3일 완숙
  carrot:  1.0,   // 1일/단계 → 2일 완숙
  pumpkin: 0.5,   // 2일/단계 → 4일 완숙
};

/** 수확량 [min, max] */
export const CROP_YIELD: Record<CropType, [number, number]> = {
  wheat:   [3, 5],
  potato:  [2, 4],
  carrot:  [2, 3],
  pumpkin: [1, 2],
};

export const CROP_LABELS: Record<CropType, string> = {
  wheat:   '밀',
  potato:  '감자',
  carrot:  '당근',
  pumpkin: '호박',
};

export const CROP_EMOJI: Record<CropType, string> = {
  wheat:   '🌾',
  potato:  '🥔',
  carrot:  '🥕',
  pumpkin: '🎃',
};

export const CROP_SEED_IDS: Record<CropType, string> = {
  wheat:   'item_seed_wheat',
  potato:  'item_seed_potato',
  carrot:  'item_seed_carrot',
  pumpkin: 'item_seed_pumpkin',
};

export const CROP_ITEM_IDS: Record<CropType, string> = {
  wheat:   'item_wheat',
  potato:  'item_potato',
  carrot:  'item_carrot',
  pumpkin: 'item_pumpkin',
};

/** 씨앗 아이템ID → CropType 매핑 */
export const SEED_TO_CROP: Record<string, CropType> = {
  item_seed_wheat:   'wheat',
  item_seed_potato:  'potato',
  item_seed_carrot:  'carrot',
  item_seed_pumpkin: 'pumpkin',
};

export const SEED_ITEM_IDS = new Set(Object.keys(SEED_TO_CROP));
