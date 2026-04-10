# 설계 24 — 허기 & 음식 효과 시스템

> **전제 조건**: 01~23 단계 완료 상태.
> CharacterStats, Inventory, CookingSystem(plan 13), HUD, SaveSystem이 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **허기 수치 감소 로직** 확정 — 시간·활동별 감소, STR 보정
2. **음식 섭취** — 인벤토리에서 음식 클릭 → 허기 회복
3. **음식별 효과** — 회복량·부가 효과(HP, 버프) 정의
4. **허기 0 페널티** — 최대 HP 감소 debuff 누적·해제
5. **식탁 보너스** — 식탁 근처 섭취 시 회복 효율 증가

---

## 2. 허기 수치 설계

### 2-1. 기본 수치 (plan 00 확정값)

| 항목 | 값 |
|------|-----|
| 범위 | 0 ~ 100 |
| 초기값 | 100 |
| 자연 감소 (게임 내 1일 기준) | −40 |
| 현실 시간 감소율 | −40 / 1800초 = **약 −0.0222/초** |

```typescript
// 실시간 감소 (delta: ms)
hunger -= (40 / 1_800_000) * delta;
```

### 2-2. STR 보정 (plan 00 확정값)

```typescript
// STR 높을수록 허기 소모 빠름 (근육량 비례)
hunger_decay_per_day = 40 - (stats.str - 5) * 2;
// STR 2 → 46/일  |  STR 5 → 40/일  |  STR 10 → 30/일
```

### 2-3. 활동별 추가 허기 감소

| 활동 | 추가 감소량 |
|------|-----------|
| 벌목 1회 완료 | −3 |
| 채굴 1회 완료 | −4 |
| 전투 공격 1회 | −1 |
| 건설 완료 1회 | −3 |
| 달리기 (미래) | −예약 |

---

## 3. 음식 목록 및 효과

### 3-1. 음식 아이템 정의

| 아이템 ID | 이름 | 허기 회복 | HP 회복 | 부가 효과 | 획득 방법 |
|----------|------|---------|--------|---------|---------|
| `item_fish_raw` | 날생선 | +10 | −5 | 식중독 20% 확률 | 낚시 |
| `item_fish_cooked` | 구운 생선 | +25 | 0 | 없음 | 조리대 요리 |
| `item_meat_raw` | 날고기 | +12 | −8 | 식중독 35% 확률 | 적 드랍 |
| `item_meat_cooked` | 구운 고기 | +30 | 0 | 없음 | 조리대 요리 |
| `item_fish_stew` | 생선 스튜 | +40 | +30 | 없음 | 레시피 해금 후 |
| `item_meat_stew` | 고기 스튜 | +50 | +20 | 없음 | 레시피 해금 후 |

### 3-2. 식중독 효과

날것 섭취 시 확률적 식중독:
```typescript
interface FoodPoisoning {
  active: boolean;
  timeLeft: number;   // ms, 현실 2분
}

// 식중독 진행 중:
// - 허기 감소 속도 1.5× 배가
// - 매 10초마다 HP −3
// - HUD 상태이상 아이콘: 🤢
// - 해제: 시간 경과(2분) 또는 수면
```

---

## 4. 음식 섭취 흐름

### 4-1. 인벤토리 클릭

```
인벤토리에서 음식 아이템 클릭
  → 컨텍스트 메뉴:
      [🍽 먹기]  허기 +25  HP ±0
      [버리기]
  → [먹기] 선택:
      허기가 이미 90 이상이면:
        "배가 부릅니다" 안내 (섭취 가능하나 낭비 경고)
      날것이면: 식중독 확률 판정
      수치 즉시 적용
      인벤토리에서 1개 소모
      행동 수치 +5 (plan 18)
```

### 4-2. 식탁 보너스

식탁(dining table) 48px 이내에서 섭취 시:
```typescript
const diningBonus = diningTableNear ? 1.3 : 1.0;
hungerRecovered = Math.round(food.hungerRecovery * diningBonus);
// 구운 생선: 보통 +25 → 식탁 근처 +32
```

식탁 보너스 알림: "+식탁 보너스 +7" 팝업 (파란색, 0.8초)

---

## 5. 허기 0 페널티 — 최대 HP Debuff

### 5-1. Debuff 누적 규칙 (plan 00 기준)

```
허기 = 0 진입
  → 매 게임 내 1시간(현실 75초)마다 최대 HP −5 debuff 누적
  → 허기 > 0 이 되면 debuff 점진적 회복 시작
     (허기 수치가 높을수록 회복 빠름)
```

```typescript
// 허기 0 지속 중 (delta: ms)
if (hunger <= 0) {
  maxHpDebuffTimer += delta;
  if (maxHpDebuffTimer >= 75_000) {   // 75초마다
    maxHpDebuff += 5;
    maxHpDebuffTimer = 0;
    notifySystem.show('굶주림으로 최대 체력이 감소했습니다', 'danger');
  }
}

// 최대 HP 적용
const effectiveMaxHp = Math.max(10, stats.maxHp - maxHpDebuff);
// 현재 HP가 최대치 초과 시 즉시 감소
if (stats.hp > effectiveMaxHp) stats.hp = effectiveMaxHp;
```

### 5-2. Debuff 회복

```typescript
// 허기 > 0 이면 매 프레임 debuff 감소
if (hunger > 0 && maxHpDebuff > 0) {
  // 허기 수치가 높을수록 빠르게 회복
  const recoveryRate = 2 + (hunger / 100) * 8;   // 2~10 / 게임일
  maxHpDebuff -= recoveryRate / 1_800_000 * delta;
  maxHpDebuff = Math.max(0, maxHpDebuff);
}
// 허기 100 → 10/일 회복  |  허기 50 → 6/일  |  허기 1 → 2/일
```

### 5-3. Debuff 한도

최대 누적 debuff 상한: `stats.maxHp - 10` (최소 HP 10 보장)

---

## 6. 허기 경고 단계

| 수치 범위 | 상태 | HUD 색상 | 알림 |
|---------|------|---------|------|
| 100~41 | 정상 | 초록 | 없음 |
| 40~21 | 배고픔 | 노랑 | "🍖 배가 고픕니다" (1회) |
| 20~11 | 허기 | 주황 | "🍖 매우 배가 고픕니다!" (1회) |
| 10~1 | 굶주림 | 빨강 | "🍖 굶주리고 있습니다!" (1회) + 게이지 깜빡임 |
| 0 | 기아 | 빨강 깜빡임 | "💀 굶주림으로 최대 체력이 줄어들고 있습니다" |

허기 20 이하 이동 속도 디버프 (피로와 별개):
```typescript
const hungerSpdMult = stats.hunger <= 20 ? 0.9 : 1.0;
// 허기 + 피로 동시 악화 시 중첩 적용 (0.9 × 0.8 = 0.72×)
```

---

## 7. HungerSystem 클래스

```typescript
export class HungerSystem {
  private maxHpDebuff: number = 0;
  private maxHpDebuffTimer: number = 0;
  private poisoning: FoodPoisoning = { active: false, timeLeft: 0 };

  // 매 프레임
  update(delta: number, stats: CharacterStats): void

  // 음식 섭취
  eat(food: FoodDef, stats: CharacterStats, nearDiningTable: boolean): EatResult

  // 최대 HP debuff 조회 (CharacterStats.effectiveMaxHp 계산용)
  getMaxHpDebuff(): number

  // 식중독 상태
  isPoisoned(): boolean

  // 저장용
  serialize(): { hunger: number; maxHpDebuff: number; poisoning: FoodPoisoning }
  deserialize(data: ReturnType<this['serialize']>): void
}

interface EatResult {
  hungerRecovered: number;
  hpChanged: number;
  poisoned: boolean;
  diningBonus: boolean;
}
```

---

## 8. 음식 아이템 스프라이트

SpriteGenerator에 추가:

| 키 | 크기 | 표현 |
|----|------|------|
| `item_fish_raw` | 16×16 | 파란빛 생선 실루엣 |
| `item_fish_cooked` | 16×16 | 갈색·노란 구운 생선 |
| `item_meat_raw` | 16×16 | 붉은 날고기 덩어리 |
| `item_meat_cooked` | 16×16 | 갈색 구운 고기 |
| `item_fish_stew` | 16×16 | 파란 그릇 + 김 표현 |
| `item_meat_stew` | 16×16 | 갈색 그릇 + 김 표현 |

---

## 9. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/HungerSystem.ts` | 신규: 허기·debuff·식중독 전체 관리 |
| `src/systems/CharacterStats.ts` | `effectiveMaxHp` 프로퍼티 추가 (debuff 반영) |
| `src/ui/InventoryUI.ts` | 음식 아이템 먹기 컨텍스트 메뉴 |
| `src/ui/HUD.ts` | 허기 경고 단계 색상, 🤢 식중독 아이콘 |
| `src/scenes/GameScene.ts` | HungerSystem 인스턴스, 식탁 근접 체크 |
| `src/systems/SaveSystem.ts` | `hunger`, `maxHpDebuff`, `poisoning` 직렬화 추가 |
| `src/world/SpriteGenerator.ts` | 음식 아이템 스프라이트 6종 추가 |
| `src/config/foods.ts` | 신규: 음식 아이템 정의 (FoodDef 목록) |

---

## 10. 확정 규칙

- 날것 섭취는 가능하나 식중독 위험 고지 (컨텍스트 메뉴에 ⚠ 표시)
- 허기가 이미 100일 때 섭취 → 허기 수치 변화 없음, 아이템 소모됨 (낭비)
- HP 회복 음식(스튜)은 현재 HP가 최대치여도 섭취 가능 (낭비되지만 막지 않음)
- 음식 섭취는 수면 중에도 가능 (인벤토리 UI는 수면 오버레이에서도 접근 가능)
- 식중독 상태에서 수면 → 기상 시 식중독 해제
- maxHpDebuff는 저장 데이터에 포함 — 불러오기 후에도 기아 페널티 유지
