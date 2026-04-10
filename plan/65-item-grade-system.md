# Plan 65 — 아이템 등급 & 특수 효과 시스템

## 개요

기존 plan 07·15·16의 아이템 구조에 **5단계 등급 체계**를 도입한다.  
동일한 베이스 아이템도 등급에 따라 추가 옵션·특수 효과가 붙고,  
등급별로 아이콘 글로우·이름 색상·접두어가 달라진다.  
장착 시 파생 스탯에 영향을 주어 캐릭터 성장의 핵심 축이 된다.

---

## 1. 등급 체계

```typescript
export type ItemGrade =
  | 'normal'     // ■ 회색   — 기본 능력치만
  | 'uncommon'   // ■ 초록   — 옵션 1개 추가
  | 'rare'       // ■ 파랑   — 옵션 2개 + 약한 특수효과 1개
  | 'epic'       // ■ 보라   — 옵션 3개 + 특수효과 1개(강)
  | 'legendary'  // ■ 황금   — 옵션 3개 + 특수효과 2개 + 고유 이름

export const GRADE_COLORS: Record<ItemGrade, { hex: string; glow: number }> = {
  normal:    { hex: '#a0a0a0', glow: 0xa0a0a0 },
  uncommon:  { hex: '#40c040', glow: 0x40c040 },
  rare:      { hex: '#4080ff', glow: 0x4080ff },
  epic:      { hex: '#d060ff', glow: 0xd060ff },
  legendary: { hex: '#ffc030', glow: 0xffc030 },
};

export const GRADE_PREFIXES: Record<ItemGrade, string[]> = {
  normal:    [''],
  uncommon:  ['낡은', '단단한', '예리한', '견고한'],
  rare:      ['정제된', '강화된', '날카로운', '내구의'],
  epic:      ['고대의', '신성한', '저주받은', '불꽃의'],
  legendary: ['전설의', '신화의', '운명의', '용사의'],
};
```

---

## 2. 아이템 데이터 구조 확장

```typescript
// 기존 ItemData (plan 07) 확장
export interface ItemData {
  id:       string;
  baseId:   string;      // 'sword_iron' 등 베이스 아이템 ID
  grade:    ItemGrade;
  name:     string;      // 접두어 + 베이스 이름 = "강화된 철검"

  // 기본 스탯 (베이스 아이템 정의값 × 등급 배율)
  stats: ItemBaseStats;

  // 등급 옵션 (랜덤 롤)
  options: ItemOption[];

  // 특수 효과 (rare 이상)
  specialEffects: SpecialEffect[];

  // 강화 단계 (plan 68에서 확장)
  enhanceLevel: number;  // 0~10
}

export interface ItemBaseStats {
  attack?:    number;
  defense?:   number;
  speed?:     number;    // 무기 공격속도
  durability: number;
  maxDurability: number;
  weight:     number;
}

// 등급별 기본 스탯 배율
export const GRADE_STAT_MULTIPLIER: Record<ItemGrade, number> = {
  normal:    1.00,
  uncommon:  1.15,
  rare:      1.35,
  epic:      1.60,
  legendary: 2.00,
};
```

---

## 3. 옵션 시스템 (`ItemOption`)

```typescript
export type OptionType =
  | 'str_bonus'    | 'agi_bonus'    | 'con_bonus'
  | 'int_bonus'    | 'luk_bonus'
  | 'hp_bonus'     | 'speed_bonus'
  | 'attack_bonus' | 'defense_bonus'
  | 'crit_bonus'   | 'crit_dmg_bonus'
  | 'durability_bonus' | 'xp_bonus';

export interface ItemOption {
  type:  OptionType;
  value: number;     // 절대값 또는 %
  isPercent: boolean;
}

// 등급별 옵션 개수
const OPTION_COUNT: Record<ItemGrade, number> = {
  normal: 0, uncommon: 1, rare: 2, epic: 3, legendary: 3
};

// 옵션 값 범위 (등급 × 베이스 범위)
const OPTION_RANGES: Record<OptionType, [number, number]> = {
  str_bonus:       [1, 4],
  agi_bonus:       [1, 4],
  con_bonus:       [1, 4],
  int_bonus:       [1, 4],
  luk_bonus:       [1, 4],
  hp_bonus:        [10, 40],
  speed_bonus:     [2, 8],    // %
  attack_bonus:    [3, 12],   // %
  defense_bonus:   [3, 12],   // %
  crit_bonus:      [1, 4],    // %
  crit_dmg_bonus:  [5, 20],   // %
  durability_bonus:[10, 40],
  xp_bonus:        [3, 10],   // %
};

function rollOption(grade: ItemGrade, exclude: OptionType[] = []): ItemOption {
  const pool = Object.keys(OPTION_RANGES).filter(k => !exclude.includes(k as OptionType));
  const type = pool[Math.floor(Math.random() * pool.length)] as OptionType;
  const [min, max] = OPTION_RANGES[type];
  const gradeMultiplier = { normal:1, uncommon:1.2, rare:1.5, epic:2.0, legendary:2.8 }[grade];
  const value = Math.round((min + Math.random() * (max - min)) * gradeMultiplier);
  const isPercent = ['speed_bonus','attack_bonus','defense_bonus','crit_bonus','crit_dmg_bonus','xp_bonus'].includes(type);
  return { type, value, isPercent };
}

function rollOptions(grade: ItemGrade): ItemOption[] {
  const count = OPTION_COUNT[grade];
  const options: ItemOption[] = [];
  const usedTypes: OptionType[] = [];
  for (let i = 0; i < count; i++) {
    const opt = rollOption(grade, usedTypes);
    options.push(opt);
    usedTypes.push(opt.type);
  }
  return options;
}
```

---

## 4. 특수 효과 (`SpecialEffect`)

```typescript
export type SpecialEffectId =
  // 공격 특수
  | 'burn_on_hit'        // 타격 시 화상 (15% 확률, 3초)
  | 'poison_on_hit'      // 타격 시 중독 (10% 확률, 5초)
  | 'stun_on_hit'        // 타격 시 기절 (8% 확률, 1.5초)
  | 'lifesteal'          // 타격 시 HP 회복 (피해의 8%)
  | 'chain_lightning'    // 타격 시 인접 적 연쇄 피해 (3타, 50% 감쇠)
  // 방어 특수
  | 'thorns'             // 피격 시 공격자에게 피해 반사 (15%)
  | 'damage_reduction'   // 피해 감소 (5~10%)
  | 'block_chance'       // 피해 완전 차단 (5% 확률)
  | 'regen_on_kill'      // 적 처치 시 HP 회복 (15)
  // 패시브 특수
  | 'gather_bonus'       // 채집량 +1 (나무·돌·어류)
  | 'speed_burst'        // 전투 후 3초간 이속 +20%
  | 'xp_aura'            // 주변 플레이어 XP +10% (멀티)
  | 'lucky_find'         // 채집·전투 추가 드롭 +5%
  | 'auto_repair'        // 내구도 자동 회복 (0.1/s)
  // Legendary 전용
  | 'soulbound'          // 장착자 사망 시 내구도 소모 없음
  | 'set_master'         // 세트 효과 추가 발동 (plan 67)

export interface SpecialEffect {
  id:          SpecialEffectId;
  tier:        1 | 2;    // tier 1: rare/epic, tier 2: epic/legendary (강력)
  description: string;   // 툴팁 표시용
}

// 등급별 특수효과 개수 및 티어
const SPECIAL_EFFECT_CONFIG: Record<ItemGrade, { count: number; maxTier: 1|2 }> = {
  normal:    { count: 0, maxTier: 1 },
  uncommon:  { count: 0, maxTier: 1 },
  rare:      { count: 1, maxTier: 1 },
  epic:      { count: 1, maxTier: 2 },
  legendary: { count: 2, maxTier: 2 },
};
```

---

## 5. 아이템 생성 함수 (`createItem`)

```typescript
function createItem(
  baseId: string,
  grade: ItemGrade,
  seedOverride?: number   // 재현 가능 아이템 생성용
): ItemData {
  const rng = seedOverride !== undefined
    ? seededRandom(seedOverride)
    : Math.random;

  const base = ITEM_BASE_TABLE[baseId];
  const multi = GRADE_STAT_MULTIPLIER[grade];

  // 이름 생성
  const prefixes = GRADE_PREFIXES[grade];
  const prefix = prefixes[Math.floor(rng() * prefixes.length)];
  const name = prefix ? `${prefix} ${base.name}` : base.name;

  // 기본 스탯 적용
  const stats: ItemBaseStats = {
    attack:       base.attack    ? Math.round(base.attack    * multi) : undefined,
    defense:      base.defense   ? Math.round(base.defense   * multi) : undefined,
    durability:   Math.round(base.maxDurability * multi),
    maxDurability: Math.round(base.maxDurability * multi),
    weight:       base.weight,
  };

  // 옵션 롤
  const options = rollOptions(grade);

  // 특수 효과 롤
  const { count, maxTier } = SPECIAL_EFFECT_CONFIG[grade];
  const specialEffects: SpecialEffect[] = [];
  const effectPool = getEffectPoolForItemType(base.type);
  for (let i = 0; i < count; i++) {
    const effect = pickSpecialEffect(effectPool, maxTier, specialEffects.map(e => e.id));
    if (effect) specialEffects.push(effect);
  }

  return {
    id:         generateUUID(),
    baseId,
    grade,
    name,
    stats,
    options,
    specialEffects,
    enhanceLevel: 0,
  };
}
```

---

## 6. 등급별 드롭 확률

```typescript
// 적 처치 또는 상자 오픈 시 등급 결정
function rollItemGrade(
  baseLuckBonus: number = 0,   // 플레이어 LUK 기반 보너스
  sourceType: 'enemy' | 'chest' | 'boss' = 'enemy'
): ItemGrade {
  const bonusMod = baseLuckBonus * 0.003;   // LUK 10 = +3%

  const table: Record<typeof sourceType, number[]> = {
    //           normal  uncommon  rare    epic    legendary
    enemy:  [0.60,    0.28,    0.09,   0.025,  0.005],
    chest:  [0.40,    0.35,    0.17,   0.07,   0.01],
    boss:   [0.10,    0.30,    0.35,   0.20,   0.05],
  };

  const weights = table[sourceType].map((w, i) =>
    i === 0 ? Math.max(0.05, w - bonusMod * 4)  // normal 비율 감소
    : w + bonusMod * (i === 1 ? 1 : i === 2 ? 1.5 : 2)
  );

  const roll = Math.random();
  let cum = 0;
  const grades: ItemGrade[] = ['normal','uncommon','rare','epic','legendary'];
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (roll < cum) return grades[i];
  }
  return 'normal';
}
```

---

## 7. 아이템 툴팁 (plan 43·55 연계)

```typescript
function renderItemTooltip(
  ctx: CanvasRenderingContext2D,
  item: ItemData,
  x: number, y: number
): void {
  const W = 220;
  const gradeColor = GRADE_COLORS[item.grade].hex;

  // 등급 색상 테두리
  ctx.strokeStyle = gradeColor; ctx.lineWidth = 2;
  roundRect(ctx, x, y, W, calcTooltipHeight(item), 4); ctx.stroke();

  // 배경
  ctx.fillStyle = 'rgba(12,9,6,0.96)';
  roundRect(ctx, x, y, W, calcTooltipHeight(item), 4); ctx.fill();

  // 왼쪽 등급 accent bar
  ctx.fillStyle = gradeColor;
  ctx.fillRect(x, y + 4, 3, calcTooltipHeight(item) - 8);

  let oy = y + 12;

  // 아이템 이름 (등급 색상)
  ctx.fillStyle = gradeColor;
  ctx.font = 'bold 11px Courier New';
  ctx.fillText(item.name, x + 10, oy); oy += 16;

  // 등급 태그
  ctx.fillStyle = gradeColor;
  ctx.font = '9px Courier New';
  ctx.fillText(`[${getGradeLabel(item.grade)}]`, x + 10, oy); oy += 14;

  // 구분선
  ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x+8, oy); ctx.lineTo(x+W-8, oy); ctx.stroke(); oy += 8;

  // 기본 스탯
  if (item.stats.attack) {
    ctx.fillStyle = '#e8d8b0'; ctx.font = '10px Courier New';
    ctx.fillText(`공격력: ${item.stats.attack}`, x + 10, oy); oy += 14;
  }
  if (item.stats.defense) {
    ctx.fillText(`방어력: ${item.stats.defense}`, x + 10, oy); oy += 14;
  }
  ctx.fillText(`내구도: ${item.stats.durability}/${item.stats.maxDurability}`, x + 10, oy); oy += 16;

  // 옵션 (초록)
  if (item.options.length > 0) {
    ctx.strokeStyle = '#3a2a14';
    ctx.beginPath(); ctx.moveTo(x+8, oy); ctx.lineTo(x+W-8, oy); ctx.stroke(); oy += 8;
    item.options.forEach(opt => {
      ctx.fillStyle = '#40e060';
      ctx.font = '9px Courier New';
      const sign = opt.value >= 0 ? '+' : '';
      const suffix = opt.isPercent ? '%' : '';
      ctx.fillText(`${sign}${opt.value}${suffix} ${getOptionLabel(opt.type)}`, x + 10, oy); oy += 13;
    });
  }

  // 특수 효과 (등급 색상)
  if (item.specialEffects.length > 0) {
    oy += 4;
    ctx.strokeStyle = '#3a2a14';
    ctx.beginPath(); ctx.moveTo(x+8, oy); ctx.lineTo(x+W-8, oy); ctx.stroke(); oy += 8;
    item.specialEffects.forEach(fx => {
      ctx.fillStyle = gradeColor;
      ctx.font = 'italic 9px Courier New';
      ctx.fillText(`✦ ${fx.description}`, x + 10, oy); oy += 13;
    });
  }
}
```

---

## 8. Legendary 고유 아이템 목록 (예시)

```typescript
export const LEGENDARY_ITEMS: Record<string, Partial<ItemData>> = {
  'blade_of_dawn': {
    baseId:  'sword_iron',
    name:    '새벽의 검',
    specialEffects: [
      { id: 'chain_lightning', tier: 2, description: '공격 시 인접 3적에 연쇄 피해' },
      { id: 'speed_burst',     tier: 2, description: '처치 후 3초간 이속 +30%'       },
    ],
  },
  'shield_of_thorns': {
    baseId:  'armor_iron',
    name:    '가시의 갑옷',
    specialEffects: [
      { id: 'thorns',           tier: 2, description: '피해 25% 반사'          },
      { id: 'regen_on_kill',    tier: 2, description: '처치 시 HP +25 회복'     },
    ],
  },
  'rod_of_fortune': {
    baseId:  'fishing_rod',
    name:    '행운의 낚싯대',
    specialEffects: [
      { id: 'lucky_find',  tier: 2, description: '낚시 시 희귀 아이템 +15% 확률' },
      { id: 'xp_aura',     tier: 1, description: '주변 플레이어 XP +10%'         },
    ],
  },
};
```

---

## 9. Firebase 저장 구조

```
/rooms/{seed}/players/{playerId}/inventory/{slotIndex}/
  ├── id:              string    // uuid
  ├── baseId:          string
  ├── grade:           string
  ├── name:            string
  ├── stats:           { attack, defense, durability, maxDurability, weight }
  ├── options:         [ { type, value, isPercent }, ... ]
  ├── specialEffects:  [ { id, tier, description }, ... ]
  └── enhanceLevel:    number
```

---

## 10. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/data/ItemGrade.ts` | 등급 정의, 색상, 배율, 접두어 |
| `src/data/ItemOptions.ts` | 옵션 타입, 범위, 롤 함수 |
| `src/data/SpecialEffects.ts` | 특수효과 정의, 발동 조건 |
| `src/data/LegendaryItems.ts` | 고유 아이템 테이블 |
| `src/systems/ItemFactory.ts` | createItem, rollItemGrade |
| `src/ui/ItemTooltip.ts` | 등급별 툴팁 렌더링 |
| `src/systems/SpecialEffectHandler.ts` | 특수효과 발동 처리 |

---

## 11. 버전

`v0.65.0`
