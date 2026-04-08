# 설계 15 — 방어구 · 방패 · 막기 시스템

> **전제 조건**: 05 단계(무기·전투) 완료 상태.
> CharacterStats, CombatSystem, Inventory가 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **방어구(Armor)** 슬롯 — 착용 시 방어도(defense) 수치 부여, 데미지 경감
2. **방패(Shield)** 슬롯 — 착용 조건(무기 종류 제한), 막기 확률 부여
3. **막기(Block) 판정** — 피격 시 확률적으로 데미지 완전 차단 또는 대폭 경감
4. **장비 패널 UI** — 무기/방어구/방패 슬롯을 한 화면에서 관리

---

## 2. 장비 슬롯 구조

플레이어는 총 3개의 장비 슬롯을 가진다:

| 슬롯 ID | 이름 | 현재 구현 |
|--------|------|---------|
| `weapon` | 무기 | ✅ 구현됨 |
| `armor` | 방어구 | 신규 |
| `shield` | 방패 | 신규 |

```typescript
interface EquipmentSlots {
  weapon: string | null;   // item ID
  armor: string | null;
  shield: string | null;
}
```

---

## 3. 방어구 목록

### 3-1. 아이템 정의

| 아이템 ID | 이름 | 방어도 | 제작 재료 | 제작 숙련도 |
|----------|------|--------|---------|-----------|
| `item_armor_hide` | 가죽 갑옷 | 3 | 가죽 ×4 | crafting Lv.2 |
| `item_armor_wood` | 목재 갑옷 | 5 | 목재 ×8 | crafting Lv.3 |
| `item_armor_stone` | 석재 갑옷 | 9 | 가공석 ×6, 가죽 ×2 | crafting Lv.5 |

> 추후 단계에서 금속 방어구 등 도면으로 해금되는 방어구 추가 예정.

### 3-2. 방어도 적용 공식

```typescript
// CombatSystem 피격 처리
function applyDamage(rawDamage: number, defense: number): number {
  // 방어도로 고정 수치 경감, 최소 1 데미지 보장
  return Math.max(1, rawDamage - defense);
}
```

예시:
| 공격 데미지 | 방어도 | 최종 데미지 |
|-----------|--------|-----------|
| 10 | 0 | 10 |
| 10 | 3 | 7 |
| 10 | 9 | 1 |
| 4 | 9 | 1 (최소 1 보장) |

### 3-3. CharacterStats 방어도 프로퍼티

```typescript
// CharacterStats에 추가
get totalDefense(): number {
  const armorDef = ARMOR_DEFS[this.equipment.armor ?? '']?.defense ?? 0;
  const shieldDef = SHIELD_DEFS[this.equipment.shield ?? '']?.defense ?? 0;
  return armorDef + shieldDef;
}
```

방패도 소량의 방어도를 제공한다 (막기 외 추가 효과).

---

## 4. 방패 목록

### 4-1. 아이템 정의

| 아이템 ID | 이름 | 방어도 | 막기 확률 | 제작 재료 | 제작 숙련도 |
|----------|------|--------|---------|---------|-----------|
| `item_shield_wood` | 목재 방패 | 2 | 15% | 목재 ×5 | crafting Lv.2 |
| `item_shield_stone` | 석재 방패 | 4 | 25% | 가공석 ×4, 목재 ×2 | crafting Lv.4 |

### 4-2. 방패 착용 제한

무기 슬롯에 장착된 무기 종류에 따라 방패 착용 가능 여부가 결정된다:

| 무기 | 방패 착용 가능 |
|------|-------------|
| 없음 (맨손) | ✅ 가능 |
| 나무칼 (`item_sword_wood`) | ✅ 가능 |
| 석재칼 (`item_sword_stone`) | ✅ 가능 |
| 활 (`item_bow`) | ❌ **불가** (양손 무기) |

```typescript
function canEquipShield(weaponId: string | null): boolean {
  const twoHandedWeapons = new Set(['item_bow']);
  return !twoHandedWeapons.has(weaponId ?? '');
}
```

착용 시도 시 제한에 걸리면:
- 장비 슬롯에 빨간 테두리 깜빡임
- 툴팁: "활은 양손 무기입니다 — 방패를 착용할 수 없습니다"

---

## 5. 막기(Block) 시스템

### 5-1. 막기 판정 흐름

```
적이 플레이어 공격
  → 방패 착용 여부 확인
    → 착용 중: 막기 확률(%) 판정
      → 막기 성공: 데미지 × 0.0 (완전 차단)
      → 막기 실패: 일반 데미지 계산 (방어도 적용)
    → 미착용: 일반 데미지 계산
```

```typescript
function resolveAttack(rawDamage: number, stats: CharacterStats): AttackResult {
  // 1. 막기 판정
  if (stats.equipment.shield !== null) {
    const blockChance = SHIELD_DEFS[stats.equipment.shield].blockChance;
    if (Math.random() < blockChance) {
      return { blocked: true, finalDamage: 0 };
    }
  }
  // 2. 방어도 적용
  const finalDamage = Math.max(1, rawDamage - stats.totalDefense);
  return { blocked: false, finalDamage };
}
```

### 5-2. 막기 연출

막기 성공 시:
```
플레이어 위치에 텍스트 팝업:
  "🛡 막기!" 
  → 흰색, 14px bold, 0.8초 위로 올라가며 페이드아웃

방패 아이콘 0.2초 스케일 업 (1.0 → 1.3 → 1.0) 애니메이션
```

막기 실패 시 일반 피격 연출 유지 (빨간 데미지 숫자 팝업).

### 5-3. 전투 숙련도와 막기

전투 숙련도 레벨에 따라 막기 확률에 보정 추가:

```typescript
get totalBlockChance(): number {
  const baseBlock = SHIELD_DEFS[this.equipment.shield ?? '']?.blockChance ?? 0;
  const combatBonus = (proficiency.getLevel('combat') - 1) * 0.01; // 레벨당 +1%
  return Math.min(0.75, baseBlock + combatBonus); // 최대 75%
}
```

| 전투 Lv. | 목재 방패 막기 확률 | 석재 방패 막기 확률 |
|---------|-----------------|-----------------|
| 1 | 15% | 25% |
| 5 | 19% | 29% |
| 10 | 24% | 34% |

---

## 6. 장비 패널 UI

### 6-1. 패널 구조

`E` 키로 장비 패널 열기/닫기 (기존 인벤토리 `V`와 별도).

```
┌─────────────────────────────────────┐
│ ⚔ 장비                         [✕]  │
├─────────────────────────────────────┤
│                                     │
│   [무기 슬롯]    [방어구 슬롯]       │
│   🏹 활          🦺 가죽 갑옷       │
│                                     │
│   [방패 슬롯]                       │
│   🛡 목재 방패                      │
│   ❌ 방패 착용 불가 (활 장착 중)    │  ← 활 착용 시 표시
│                                     │
├─────────────────────────────────────┤
│  방어도: 5   막기: 0% (방패 없음)   │
│  ※ 활은 방패 착용 불가              │
└─────────────────────────────────────┘
```

### 6-2. 슬롯 상호작용

| 동작 | 결과 |
|------|------|
| 빈 슬롯 클릭 | 인벤토리에서 해당 타입 아이템 선택 팝업 |
| 장착된 아이템 클릭 | 해제 (인벤토리로 이동) |
| 장착 불가 아이템 드래그 | 빨간 테두리 + 이유 툴팁 |

### 6-3. 인벤토리 연동

인벤토리(V키) 패널에서도 방어구/방패 아이콘에 **우클릭 → 장착** 컨텍스트 메뉴 추가:

```
[우클릭 컨텍스트]
  ✅ 장착
  — 또는 —
  ❌ 방패 착용 불가 (활 장착 중) [회색, 비활성]
```

---

## 7. 제작 시스템 연동

작업대 [도구] 탭에 방어구·방패 제작 추가 (기존 도구 탭 → **[도구/방어구]** 탭으로 확장):

| 카테고리 | 제작물 | 재료 | 숙련도 |
|---------|-------|------|--------|
| 방어구 | 가죽 갑옷 | 가죽 ×4 | crafting Lv.2 |
| 방어구 | 목재 갑옷 | 목재 ×8 | crafting Lv.3 |
| 방어구 | 석재 갑옷 | 가공석 ×6, 가죽 ×2 | crafting Lv.5 |
| 방패 | 목재 방패 | 목재 ×5 | crafting Lv.2 |
| 방패 | 석재 방패 | 가공석 ×4, 목재 ×2 | crafting Lv.4 |

---

## 8. 데이터 구조

### config/equipment.ts (신규)

```typescript
export interface ArmorDef {
  itemId: string;
  label: string;
  defense: number;
}

export interface ShieldDef {
  itemId: string;
  label: string;
  defense: number;
  blockChance: number;  // 0.0 ~ 1.0
}

export const ARMOR_DEFS: Record<string, ArmorDef> = {
  item_armor_hide:  { itemId: 'item_armor_hide',  label: '가죽 갑옷', defense: 3 },
  item_armor_wood:  { itemId: 'item_armor_wood',  label: '목재 갑옷', defense: 5 },
  item_armor_stone: { itemId: 'item_armor_stone', label: '석재 갑옷', defense: 9 },
};

export const SHIELD_DEFS: Record<string, ShieldDef> = {
  item_shield_wood:  { itemId: 'item_shield_wood',  label: '목재 방패', defense: 2, blockChance: 0.15 },
  item_shield_stone: { itemId: 'item_shield_stone', label: '석재 방패', defense: 4, blockChance: 0.25 },
};

export const TWO_HANDED_WEAPONS = new Set(['item_bow']);
```

### EquipmentSystem.ts (신규)

```typescript
export class EquipmentSystem {
  private slots: EquipmentSlots = { weapon: null, armor: null, shield: null };

  equip(slot: keyof EquipmentSlots, itemId: string): EquipResult
  unequip(slot: keyof EquipmentSlots): string | null  // 반환: 해제된 itemId
  canEquip(slot: keyof EquipmentSlots, itemId: string): { ok: boolean; reason?: string }
  getSlots(): Readonly<EquipmentSlots>
}

type EquipResult = { ok: true } | { ok: false; reason: string };
```

---

## 9. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/config/equipment.ts` | 신규: 방어구·방패 정의 |
| `src/systems/EquipmentSystem.ts` | 신규: 장착/해제 로직 |
| `src/systems/CharacterStats.ts` | `totalDefense`, `totalBlockChance` 프로퍼티 추가 |
| `src/systems/CombatSystem.ts` | 피격 처리에 방어도·막기 판정 추가 |
| `src/ui/EquipmentPanel.ts` | 신규: E키 장비 패널 HTML UI |
| `src/ui/InventoryUI.ts` | 방어구/방패 우클릭 → 장착 컨텍스트 메뉴 |
| `src/config/recipes.ts` | 방어구·방패 제작 레시피 추가 |
| `src/world/SpriteGenerator.ts` | 방어구·방패 아이템 스프라이트 추가 |

---

## 10. 확정 규칙

- 방어구·방패는 인벤토리 슬롯을 차지함 (장착 시 슬롯에서 제거)
- 장착 해제 시 인벤토리가 가득 차면 해제 불가 + 경고
- 활 착용 상태에서 방패 장착 시도 시 → 즉시 거부 (자동 해제 없음)
- 반대로 방패 착용 상태에서 활 장착 시 → 방패 자동 해제 후 활 장착 (인벤토리로 반환)
- 막기는 플레이어가 피격될 때만 판정 (플레이어→적 공격에는 적용 안 됨)
- 적에게도 방어도·막기 개념 추후 추가 가능 (설계 여지 확보)
