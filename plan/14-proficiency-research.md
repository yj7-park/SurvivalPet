# 설계 14 — 숙련도 · 연구 · 레시피/도면 시스템

> **전제 조건**: 13 단계 완료 상태.
> 요리 패널, 제작 패널, BuildSystem이 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **숙련도(Proficiency)** 시스템 — 작업 반복 시 경험치 획득, 레벨업
2. **레벨에 따른 해금** — 요리 숙련도 레벨 ↑ → 더 많은 기본 레시피 사용 가능
3. **연구(Research)** 시스템 — 시간·재료 소모로 새 제작 아이템 해금
4. **레시피·도면 아이템** — 드랍 아이템으로 요리/제작 해금 (추후 단계)

---

## 2. 숙련도 시스템

### 2-1. 숙련도 종류

| 숙련도 ID | 한글명 | 관련 작업 |
|----------|--------|---------|
| `cooking` | 요리 | 조리대 요리 |
| `crafting` | 제작 | 작업대 제작 |
| `building` | 건축 | 구조물 건설/철거 |
| `woodcutting` | 벌목 | 나무 채취 |
| `mining` | 채광 | 돌 채취 |
| `fishing` | 낚시 | 물고기 낚기 |
| `combat` | 전투 | 적 처치 |

### 2-2. 레벨 구조

- 레벨 범위: **1 ~ 10**
- 레벨업 필요 경험치:

| 레벨 | 필요 누적 XP |
|------|------------|
| 1→2 | 50 |
| 2→3 | 130 |
| 3→4 | 260 |
| 4→5 | 450 |
| 5→6 | 700 |
| 6→7 | 1,020 |
| 7→8 | 1,420 |
| 8→9 | 1,910 |
| 9→10 | 2,500 |

누적 공식: `requiredXP(level) = Math.round(50 * level * (level + 1) / 2)`

### 2-3. 작업별 경험치 획득량

| 작업 | 획득 XP |
|------|--------|
| 나무 1개 채취 | woodcutting +8 |
| 돌 1개 채취 | mining +8 |
| 물고기 낚기 | fishing +10 |
| 구조물 완공 | building +15 |
| 구조물 철거 | building +8 |
| 요리 완료 (×1) | cooking +12 |
| 요리 완료 (×2) | cooking +20 |
| 제작 완료 | crafting +15 |
| 적 처치 | combat +20 |

### 2-4. 숙련도에 따른 작업 속도 보정

능력치(STR, INT) 외에 숙련도 레벨도 속도에 영향:

```typescript
// 숙련도 속도 보정 배율 (1.0 = 보정 없음)
proficiencySpeedMult(profId: ProficiencyType): number {
  const lvl = this.getLevel(profId);
  return Math.max(0.4, 1.0 - (lvl - 1) * 0.07);
  // 레벨 1: 1.0× / 레벨 5: 0.72× / 레벨 10: 0.4× (60% 단축)
}
```

최종 작업 시간 = `기본시간 × 능력치보정 × 숙련도보정`

적용 대상:
- `cookTime`: `baseCookTime × intMult × cookingProfMult`
- `craftTime`: `baseCraftTime × intMult × craftingProfMult`
- `buildTime`: `baseBuildTime × strMult × buildingProfMult`

---

## 3. 요리 숙련도 레벨별 해금

기본 레시피는 숙련도 레벨에 따라 단계적으로 해금:

| 레벨 | 해금 레시피 |
|------|-----------|
| 1 | 생선 굽기 (물고기 ×1 → 구운 생선 ×1) |
| 1 | 고기 굽기 (날고기 ×1 → 구운 고기 ×1) |
| 3 | 생선 ×2 굽기 (물고기 ×2 → 구운 생선 ×2) |
| 3 | 고기 ×2 굽기 (날고기 ×2 → 구운 고기 ×2) |
| 5 | *(추후 레시피 추가 예정)* |
| 7 | *(추후 레시피 추가 예정)* |

레시피 잠금 표시:
```
[🔒 생선 ×2 굽기]  요리 숙련도 Lv.3 필요  (잠금 상태: 회색, 비활성)
```

### 3-2. 요리 패널 숙련도 표시

```
┌─────────────────────────────────────┐
│ 🍳 조리대                      [✕]  │
│ 요리 숙련도: Lv.2  ████░░░░  68/130 │
├─────────────────────────────────────┤
│ ...레시피 목록...                   │
└─────────────────────────────────────┘
```

---

## 4. 제작 숙련도 레벨별 해금

| 레벨 | 해금 제작물 |
|------|-----------|
| 1 | 횃불 (목재 ×2) |
| 1 | 낚싯대 (목재 ×3) |
| 2 | 활 (목재 ×8) |
| 2 | 나무칼 (목재 ×6) |
| 4 | 가공석 ×5 (석재 ×10) |
| 5 | 석재칼 (목재 ×4, 가공석 ×4) |
| 6 | *(연구·도면으로 추가 예정)* |

---

## 5. 연구 시스템

### 5-1. 개요

- 연구는 **연구대(workbench)** 에서 수행
- 한 번에 1개 연구만 진행 가능
- 완료 시 해당 아이템의 제작 레시피가 영구 해금
- 연구는 재료 소모 + 시간 소요

### 5-2. 연구 목록

| 연구 ID | 연구 이름 | 필요 재료 | 시간 | 해금 내용 | 필요 숙련도 |
|--------|---------|---------|------|---------|-----------|
| `research_stone_wall` | 석재 벽 | 가공석 ×5 | 30초 | 석재 벽 건설 | building Lv.2 |
| `research_stone_floor` | 석재 바닥 | 가공석 ×3 | 20초 | 석재 바닥 건설 | building Lv.2 |
| `research_stone_bed` | 석재 침대 | 가공석 ×6, 목재 ×3 | 40초 | 석재 침대 건설 | building Lv.3 |
| `research_advanced_weapon` | 고급 무기술 | 가공석 ×10 | 60초 | 고급 무기 제작 해금 | crafting Lv.4 |

> 연구 시스템은 향후 확장을 고려해 구조만 정의하고 초기 목록은 최소한으로 유지.

### 5-3. 연구 패널 UI

작업대 패널에 **[연구]** 탭 추가:

```
┌─────────────────────────────────────┐
│ 🔨 작업대                      [✕]  │
│ 제작 숙련도: Lv.3  ██████░░  260/450│
├─────────────────────────────────────┤
│ [무기] [재료] [도구] [연구]          │
├─────────────────────────────────────┤
│ [🔬 석재 벽 연구]                   │
│  재료: 가공석 ×5    보유: 2개        │
│  소요: 30.0s       [---] (재료 부족)│
│                                     │
│ [🔬 고급 무기술]                    │
│  필요: 제작 Lv.4 (현재 Lv.3)        │
│                    [🔒 숙련도 부족]  │
│                                     │
│  ████████░░░  연구 중… 18s          │
└─────────────────────────────────────┘
```

### 5-4. 연구 규칙

- 작업대 범위(48px) 이탈 시 → **연구 중단** (재료 소모됨, 결과 없음)
  - 중단 메시지: "연구가 중단되었습니다"
- 완료 시 `unlockedResearch: Set<string>` 에 ID 추가
- 이미 완료된 연구는 "✅ 완료" 표시, 버튼 비활성화

---

## 6. 레시피·도면 아이템 (추후 단계 설계)

> 이 섹션은 즉시 구현하지 않는다. 추후 적 드랍·탐험 시스템과 함께 구현 예정.

### 6-1. 아이템 정의

| 아이템 ID | 이름 | 타입 | 해금 내용 |
|----------|------|------|---------|
| `item_recipe_fish_stew` | 생선 스튜 레시피 | recipe | 생선 스튜 요리 해금 |
| `item_recipe_meat_stew` | 고기 스튜 레시피 | recipe | 고기 스튜 요리 해금 |
| `item_blueprint_iron_sword` | 철제칼 도면 | blueprint | 철제칼 제작 해금 |
| `item_blueprint_armor` | 갑옷 도면 | blueprint | 갑옷 제작 해금 |

### 6-2. 습득 방법

- 적(enemy) 처치 시 소지품으로 드랍 (드랍률은 적 종류별 설정)
- 아이템은 인벤토리에 보관, 클릭으로 "습득(learn)" 가능
- 습득 후 아이템은 **소멸하지 않음** (다른 캐릭터에게 줄 수 있음)
- `knownRecipes: Set<string>`, `knownBlueprints: Set<string>` 에 ID 추가

### 6-3. 숙련도 제한

레시피·도면에 숙련도 요구치를 설정 가능:

```typescript
interface RecipeItem {
  itemId: string;
  type: 'recipe' | 'blueprint';
  unlocksId: string;       // COOKING_RECIPES 또는 CRAFTING_RECIPES의 ID
  requiredProficiency?: { type: ProficiencyType; level: number };
}
```

예시: 철제칼 도면을 갖고 있어도 제작 숙련도 Lv.6 이상이어야 제작 가능.

### 6-4. 드랍 테이블 (예시)

| 적 종류 | 드랍 아이템 | 드랍 확률 |
|--------|-----------|---------|
| 호랑이 | `item_recipe_meat_stew` | 15% |
| 침략자(일반) | `item_blueprint_iron_sword` | 5% |
| 침략자(대장) | `item_blueprint_armor` | 20% |

---

## 7. 데이터 구조

### ProficiencySystem.ts (신규)

```typescript
export type ProficiencyType =
  | 'cooking' | 'crafting' | 'building'
  | 'woodcutting' | 'mining' | 'fishing' | 'combat';

export interface ProficiencyData {
  type: ProficiencyType;
  level: number;    // 1~10
  xp: number;       // 현재 레벨 내 누적 XP
  totalXp: number;  // 전체 누적 XP
}

export class ProficiencySystem {
  private data: Map<ProficiencyType, ProficiencyData>;

  addXP(type: ProficiencyType, amount: number): { leveledUp: boolean; newLevel: number }
  getLevel(type: ProficiencyType): number
  getXP(type: ProficiencyType): number
  getXPToNextLevel(type: ProficiencyType): number
  getSpeedMultiplier(type: ProficiencyType): number
  // 요리/제작 해금 체크
  isRecipeUnlocked(recipeId: string): boolean
  isCraftUnlocked(craftId: string): boolean
  // 연구 완료 해금
  unlockByResearch(researchId: string): void
  // 레시피/도면 아이템으로 해금
  unlockByItem(unlocksId: string): void
}
```

### ResearchSystem.ts (신규)

```typescript
export interface ResearchDef {
  id: string;
  label: string;
  inputs: { itemId: string; amount: number }[];
  timeMs: number;
  requiredProficiency?: { type: ProficiencyType; level: number };
  unlocks: string;   // crafting recipe ID
}

export class ResearchSystem {
  private currentResearch: { def: ResearchDef; startedAt: number } | null;
  private completed: Set<string>;

  startResearch(def: ResearchDef, inventory: Inventory): boolean
  cancelResearch(): void
  update(delta: number): { completed: ResearchDef } | null
  isCompleted(id: string): boolean
  isUnlocked(id: string): boolean
}
```

### config/recipes.ts 확장

```typescript
export interface Recipe {
  id: string;
  label: string;
  category: 'weapon' | 'material' | 'tool' | 'cooking';
  inputs: { itemId: string; amount: number }[];
  output: { itemId: string; amount: number };
  timeMultiplier: number;
  // 해금 조건 (둘 중 하나 충족 시 사용 가능)
  unlock: {
    proficiencyLevel?: number;      // 해당 숙련도 레벨 (요리: cooking, 제작: crafting)
    researchId?: string;            // 연구 완료 ID
    learnableItemId?: string;       // 레시피/도면 아이템 ID (추후)
  };
}
```

---

## 8. 레벨업 연출

```
레벨업 시:
  화면 중앙에 골드 텍스트 팝업:
  "⬆ 요리 숙련도 Lv.3!" 
  → 1.5초 표시 후 페이드아웃
  → 색상: #ffd700
  → 폰트: 14px monospace bold

  동시에: 해금된 레시피 있으면
  "🔓 [생선 ×2 굽기] 해금!" 추가 팝업 (0.5초 딜레이)
```

---

## 9. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/ProficiencySystem.ts` | 신규: 숙련도 관리 전체 |
| `src/systems/ResearchSystem.ts` | 신규: 연구 진행 관리 |
| `src/config/recipes.ts` | 기존 설계에서 `unlock` 필드 추가 |
| `src/scenes/GameScene.ts` | ProficiencySystem 인스턴스, XP 지급 호출 |
| `src/ui/KitchenPanel.ts` | 요리 숙련도 표시, 잠금 레시피 처리 |
| `src/ui/WorkbenchPanel.ts` | 제작 숙련도 표시, 연구 탭 추가 |
| `src/systems/ShelfUI.ts` | 변경 없음 |

---

## 10. 확정 규칙

- 숙련도는 저장 데이터에 포함 (localStorage 등 추후 설계)
- 레벨 10 달성 후 XP는 계속 누적되지만 레벨은 고정
- 연구 중 게임 종료 시 진행 상태 유실 (재시작 필요)
- 레시피/도면 아이템은 추후 단계(15단계)에서 구현
- 연구가 필요한 제작물은 연구 탭에서만 보임 (일반 제작 탭에 표시 안 함)
