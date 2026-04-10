# 설계 16 — 드랍 & 루팅 시스템

> **전제 조건**: 06 단계(적 침략), 14 단계(숙련도·연구), 15 단계(방어구·방패) 완료 상태.
> CombatSystem, Inventory, ProficiencySystem, EquipmentSystem이 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **드랍 아이템** — 적 처치 시 지면에 아이템 생성
2. **지면 아이템 렌더링** — 타일 위 아이템 시각화
3. **줍기 상호작용** — 클릭 또는 근접 시 자동/수동 획득
4. **레시피·도면 아이템** — plan 14 section 6에서 미뤘던 해금 아이템 구현
5. **드랍 테이블** — 적 종류별 드랍 정의

---

## 2. 지면 아이템(Ground Item)

### 2-1. 데이터 구조

```typescript
export interface GroundItem {
  id: string;            // uuid
  itemId: string;        // 아이템 종류
  amount: number;        // 수량 (자원 아이템은 여러 개 묶음)
  x: number;             // 월드 픽셀 좌표
  y: number;
  droppedAt: number;     // Date.now() — 일정 시간 후 소멸
  glowing: boolean;      // 레시피/도면 등 희귀 아이템은 글로우 효과
}
```

### 2-2. 소멸 타이머

| 아이템 종류 | 소멸까지 |
|-----------|---------|
| 자원 아이템 (목재, 석재 등) | 3분 (실시간) |
| 음식 아이템 | 2분 |
| 레시피·도면 아이템 | **소멸 없음** |
| 무기·방어구 아이템 | 5분 |

소멸 10초 전: 깜빡임 애니메이션 (알파값 1.0 ↔ 0.3 토글, 0.5초 주기)

---

## 3. 드랍 테이블

### 3-1. 정의 구조

```typescript
export interface DropEntry {
  itemId: string;
  amountMin: number;
  amountMax: number;
  chance: number;       // 0.0 ~ 1.0
}

export interface DropTable {
  enemyType: string;
  drops: DropEntry[];
  guaranteedDrops?: DropEntry[];  // 100% 드랍
}
```

### 3-2. 적 종류별 드랍

| 적 종류 | 드랍 아이템 | 수량 | 확률 |
|--------|-----------|------|------|
| 늑대 (`enemy_wolf`) | 날고기 | 1~2 | 80% |
| 늑대 | 가죽 | 1 | 60% |
| 호랑이 (`enemy_tiger`) | 날고기 | 2~3 | 100% |
| 호랑이 | 가죽 | 1~2 | 70% |
| 호랑이 | 레시피: 고기 스튜 | 1 | 15% |
| 침략자 일반 (`enemy_raider`) | 목재 | 3~5 | 50% |
| 침략자 일반 | 도면: 철제칼 | 1 | 5% |
| 침략자 대장 (`enemy_raider_boss`) | 가공석 | 3~5 | 70% |
| 침략자 대장 | 도면: 갑옷 | 1 | 20% |
| 침략자 대장 | 레시피: 생선 스튜 | 1 | 25% |

### 3-3. 드랍 실행 로직

```typescript
function rollDrops(table: DropTable, seed: number): DropEntry[] {
  const results: DropEntry[] = [];
  const rng = new SeededRandom(seed);

  // 확정 드랍
  for (const entry of table.guaranteedDrops ?? []) {
    results.push({ ...entry, amount: randInt(rng, entry.amountMin, entry.amountMax) });
  }

  // 확률 드랍
  for (const entry of table.drops) {
    if (rng.next() < entry.chance) {
      results.push({ ...entry, amount: randInt(rng, entry.amountMin, entry.amountMax) });
    }
  }
  return results;
}
```

드랍 위치: 처치된 적의 좌표를 중심으로 반경 8px 내 랜덤 분산 (아이템이 겹치지 않도록)

---

## 4. 레시피·도면 아이템 (plan 14 section 6 구현)

### 4-1. 아이템 정의

| 아이템 ID | 이름 | 타입 | 해금 내용 |
|----------|------|------|---------|
| `item_recipe_fish_stew` | 생선 스튜 레시피 | recipe | 생선 스튜 요리 해금 |
| `item_recipe_meat_stew` | 고기 스튜 레시피 | recipe | 고기 스튜 요리 해금 |
| `item_blueprint_iron_sword` | 철제칼 도면 | blueprint | 철제칼 제작 해금 |
| `item_blueprint_armor` | 갑옷 도면 | blueprint | 갑옷 제작 해금 |

### 4-2. 레시피 아이템이 해금하는 내용

**생선 스튜** (요리 숙련도 Lv.4 필요):
- 재료: 물고기 ×2, 석재 솥 (소모 없음)
- 산출: 생선 스튜 ×1 (HP 회복 +30, 허기 +40)
- 조리 시간: 기본 20초

**고기 스튜** (요리 숙련도 Lv.4 필요):
- 재료: 날고기 ×2, 석재 솥 (소모 없음)
- 산출: 고기 스튜 ×1 (HP 회복 +20, 허기 +50)
- 조리 시간: 기본 20초

**철제칼** (제작 숙련도 Lv.6 필요):
- 재료: 가공석 ×8, 목재 ×3
- 산출: 철제칼 ×1 (공격력 18, 공격 속도 1.0×)
- 제작 시간: 기본 30초

**갑옷 도면** → `item_armor_iron` (제작 숙련도 Lv.7 필요):
- 재료: 가공석 ×10, 가죽 ×3
- 산출: 철제 갑옷 ×1 (방어도 14)
- 제작 시간: 기본 40초

### 4-3. 레시피/도면 아이템 사용 방법

```
인벤토리에서 레시피/도면 아이템 클릭
  → 확인 팝업: "[생선 스튜 레시피]를 학습하시겠습니까?"
    → [확인]: ProficiencySystem.unlockByItem(unlocksId) 호출
              아이템은 인벤토리에 유지 (소멸 안 함)
              "✅ [생선 스튜] 요리법을 습득했습니다!" 팝업
    → [취소]: 아무 변화 없음
```

이미 해금된 경우:
- 클릭 시: "이미 알고 있는 레시피입니다" 툴팁 표시 (팝업 없음)

### 4-4. 레시피/도면 숙련도 요구치 미충족

```
[확인] 클릭 시 숙련도 미충족이면:
  → "요리 숙련도 Lv.4 이상이 필요합니다 (현재 Lv.2)" 경고창
  → 아이템은 유지됨 (나중에 숙련도 올리면 재시도 가능)
```

---

## 5. 줍기(Pickup) 시스템

### 5-1. 수동 픽업 (클릭)

```
지면 아이템 클릭
  → 인벤토리 공간 확인
    → 공간 있음: 인벤토리 추가 + 지면 아이템 제거
    → 공간 없음: "인벤토리가 가득 찼습니다" 경고 (아이템 유지)
  → 상호작용 가능 거리(48px) 초과 시:
    → 자동 이동 → 거리 내 도달 시 자동 픽업
```

### 5-2. 자동 픽업 (근접)

기본값: **비활성** (플레이어가 설정에서 켤 수 있음)

```typescript
// 자원 아이템만 자동 픽업 옵션 제공
// 레시피/도면 아이템은 자동 픽업 안 함 (실수 방지)
const AUTO_PICKUP_TYPES = ['wood', 'stone', 'fish', 'raw_meat', 'leather', 'processed_stone'];
```

### 5-3. 호버 툴팁

```
[아이템 이름 × 수량]
클릭하여 줍기
(48px 밖이면: "이동 후 획득")
```

---

## 6. 지면 아이템 렌더링

### 6-1. 일반 아이템

- 아이템 스프라이트 (16×16) + 수량 텍스트 (우하단 8px bold)
- 아이템 중심: 약 +4px 위아래 사인파 애니메이션 (부유 효과, 주기 2초)

### 6-2. 레시피·도면 아이템 (희귀)

```
부유 효과 + 글로우 링:
  - 외곽에 반투명 원형 빛 (radius 12px, 색상: #ffd700 for recipe / #00bfff for blueprint)
  - 펄스 애니메이션 (반경 10→14px 2초 주기)
  - 아이템명 상단 표시 (10px, 흰색 그림자)
```

### 6-3. Depth 레이어

지면 아이템의 Phaser depth: `tile.y + 0.5` (타일 위, 캐릭터 아래)

---

## 7. 데이터 구조 요약

### DropSystem.ts (신규)

```typescript
export class DropSystem {
  private groundItems: Map<string, GroundItem>;

  // 적 처치 시 드랍 생성
  spawnDrops(enemyType: string, x: number, y: number, seed: number): void

  // 지면 아이템 조회 (범위 내)
  getItemsNear(x: number, y: number, radius: number): GroundItem[]

  // 픽업 처리
  pickup(itemId: string, inventory: Inventory): PickupResult

  // 소멸 타이머 업데이트
  update(delta: number): void

  // 렌더링용 전체 목록
  getAllItems(): GroundItem[]
}

type PickupResult = 
  | { ok: true; item: GroundItem }
  | { ok: false; reason: 'inventory_full' | 'not_found' | 'too_far' };
```

### config/dropTables.ts (신규)

```typescript
export const DROP_TABLES: Record<string, DropTable> = {
  enemy_wolf: { ... },
  enemy_tiger: { ... },
  enemy_raider: { ... },
  enemy_raider_boss: { ... },
};
```

### config/recipeItems.ts (신규)

```typescript
export interface RecipeItemDef {
  itemId: string;
  label: string;
  type: 'recipe' | 'blueprint';
  unlocksId: string;
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
  // ...
};
```

---

## 8. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/DropSystem.ts` | 신규: 드랍 생성·픽업·소멸 관리 |
| `src/config/dropTables.ts` | 신규: 적별 드랍 테이블 |
| `src/config/recipeItems.ts` | 신규: 레시피/도면 아이템 정의 |
| `src/config/recipes.ts` | 스튜 레시피, 철제칼, 철제 갑옷 추가 |
| `src/systems/ProficiencySystem.ts` | `unlockByItem()` 연동 확인 |
| `src/systems/CombatSystem.ts` | 적 처치 시 `DropSystem.spawnDrops()` 호출 |
| `src/ui/InventoryUI.ts` | 레시피/도면 아이템 클릭 → 학습 팝업 |
| `src/world/SpriteGenerator.ts` | 레시피·도면 아이템 스프라이트 추가 |
| `src/scenes/GameScene.ts` | DropSystem 인스턴스, 지면 아이템 렌더링 |

---

## 9. 확정 규칙

- 지면 아이템은 타일 이동 불가 (물 위에 드랍되면 인접 흙 타일로 밀림)
- 같은 종류·수량의 아이템이 16px 이내에 있으면 **스택** 표시 (ex: `×5`)
- 레시피/도면 아이템은 인벤토리 보관 후 다른 플레이어에게 전달 가능 (미래 멀티플레이 고려)
- 드랍 아이템에는 무기·방어구는 포함하지 않음 (제작으로만 획득 — 밸런스)
- 자동 픽업은 기본 비활성이며 설정 패널에서 켤 수 있음
