# 설계 22 — 내구도 & 수리 시스템

> **전제 조건**: 01~21 단계 완료 상태.
> BuildSystem, CombatSystem, ActionSystem(광란), SaveSystem이 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **건설물 내구도** — 모든 구조물에 내구도 수치 부여, 시간 경과로 감소
2. **피해 감소** — 전투·광란 자동 공격으로 내구도 감소
3. **파괴** — 내구도 0 도달 시 구조물 제거 + 재료 일부 회수
4. **수리 상호작용** — 클릭 → 재료 소모 → 내구도 회복
5. **내구도 HUD** — 구조물 호버 시 내구도 표시

---

## 2. 내구도 기본 수치

### 2-1. 재료별 최대 내구도

plan 00 설계 기준:

| 재료 | 최대 내구도 |
|------|-----------|
| 목재 | 100 |
| 석재 | 300 |

### 2-2. 건설물 종류별 내구도

| 건설물 | 목재 최대 | 석재 최대 |
|--------|---------|---------|
| 벽 | 100 | 300 |
| 문 | 80 | 240 |
| 지붕 | 120 | 360 |
| 침대 | 60 | 180 |
| 식탁 | 60 | 180 |
| 의자 | 40 | 120 |
| 작업대 | 80 | 240 |
| 조리대 | 80 | 240 |

---

## 3. 내구도 감소 원인

### 3-1. 시간 경과 (자연 노후화)

```typescript
// 게임 내 1일(현실 30분)마다 감소
const DECAY_PER_DAY: Record<Material, number> = {
  wood:  5,   // 목재: 하루 5 감소 → 20일(현실 10시간) 방치 시 파괴
  stone: 2,   // 석재: 하루 2 감소 → 150일(현실 75시간) 방치 시 파괴
};

// 실시간 감소 (delta: ms)
durability -= DECAY_PER_DAY[material] / 1_800_000 * delta;
```

지붕 아래(실내) 구조물은 노후화 속도 **50% 감소**:
```typescript
const isIndoor = roofSystem.isCovered(tileX, tileY);
const decayMult = isIndoor ? 0.5 : 1.0;
```

### 3-2. 전투 피해

| 가해자 | 피해량/회 |
|--------|---------|
| 적(일반) | 8 |
| 적(대장) | 20 |
| 플레이어 광란 자동 공격 | 15 |
| 원격 플레이어 광란 | 15 |

적이 벽을 공격하는 조건:
- 벽이 이동 경로를 막고 있을 때 → A* 우회 불가 판정 시 벽 공격으로 전환
- 공격 간격: 2초/회

### 3-3. 내구도 0 도달 → 파괴

```typescript
function destroyBuilding(building: Building): void {
  // 1. 재료 일부 회수 (50%)
  const recovered = Math.floor(building.buildCost * 0.5);
  groundItemSystem.spawn(building.x, building.y, building.materialItem, recovered);

  // 2. 타일 해제 (이동 가능 복원)
  tileMap.clearBuilding(building.tileX, building.tileY);

  // 3. 렌더링 제거
  building.sprite.destroy();

  // 4. SaveData에서 제거
  buildingSystem.remove(building.id);

  // 5. 알림
  notifySystem.show(`${building.label}이(가) 무너졌습니다`, 'warning');
}
```

파괴 연출:
```
0.3초간 스프라이트 빨간 틴트 → 흔들림(shake, ±2px, 0.1초) → 소멸 파티클(먼지 4~6개) → 제거
```

---

## 4. 수리 상호작용

### 4-1. 호버 시 표시

구조물에 마우스 오버:
```
[목재 벽]
내구도: ██████░░░░  62/100
🔨 수리하기  (목재 ×2 필요)
```

내구도 비율에 따른 게이지 색상:
| 비율 | 색상 |
|------|------|
| 70%~ | 초록 |
| 40~69% | 노랑 |
| 20~39% | 주황 |
| ~19% | 빨강 + 깜빡임 |

### 4-2. 수리 클릭 흐름

```
구조물 클릭 → 컨텍스트 메뉴:
  [🔨 수리하기]   목재 ×2 (현재 보유: 5개)
  [🔧 완전 수리]  목재 ×8 (현재 보유: 5개)  ← 재료 부족 시 회색
  [철거하기]

→ [수리하기] 선택:
    재료 확인 → 부족 시 "재료가 부족합니다" 알림
    충분 시 → 프로그레스 바 (5초) → 완료
      → 내구도 회복, 재료 소모
      → building 숙련도 +8 XP
```

### 4-3. 수리량 및 재료 소모

**부분 수리** (수리하기):
- 소모 재료: 건설 비용의 **20%** (최소 1개)
- 회복량: 최대 내구도의 **30%**

**완전 수리** (완전 수리):
- 소모 재료: 건설 비용의 **80%**
- 회복량: **최대 내구도까지 전부 회복**

```typescript
function calcRepairCost(building: Building, full: boolean): number {
  const ratio = full ? 0.8 : 0.2;
  return Math.max(1, Math.floor(building.buildCost * ratio));
}

function calcRepairAmount(building: Building, full: boolean): number {
  return full
    ? building.maxDurability - building.durability
    : Math.floor(building.maxDurability * 0.3);
}
```

### 4-4. 수리 소요 시간

| 수리 종류 | 기본 시간 | STR 보정 |
|---------|---------|---------|
| 부분 수리 | 5초 | `max(2, 5 - (STR-5)*0.3)` |
| 완전 수리 | 20초 | `max(8, 20 - (STR-5)*1.2)` |

수리 중 이동/다른 입력 시 즉시 취소 (재료 소모 안 됨).

---

## 5. 내구도 시각 표시

### 5-1. 구조물 스프라이트 상태

내구도 비율에 따라 스프라이트에 균열 오버레이:

| 비율 | 균열 표현 |
|------|---------|
| 100~70% | 균열 없음 |
| 69~40% | 균열 1단계 (얇은 선 1~2개) |
| 39~20% | 균열 2단계 (굵은 선 3~4개) |
| 19~1% | 균열 3단계 (전면 균열 + 빨간 틴트) |

균열은 SpriteGenerator에서 Canvas API로 오버레이 텍스처 생성:
```typescript
// 균열 레벨 0~3
function drawCrackOverlay(ctx: CanvasRenderingContext2D, level: 0|1|2|3): void
```

### 5-2. 체력바 (근접 시)

플레이어가 구조물 32px 이내 접근 시 스프라이트 위에 얇은 내구도 바 표시:
```
[████░░] 62%  (폭 28px, 높이 3px, 스프라이트 상단 +2px)
```

---

## 6. DurabilitySystem 클래스

```typescript
export class DurabilitySystem {
  // 시간 경과 처리 (매 프레임)
  update(delta: number, buildings: Building[], roofSystem: RoofSystem): void

  // 피해 적용
  applyDamage(buildingId: string, amount: number): DamageResult

  // 수리 실행
  repair(buildingId: string, full: boolean, inventory: Inventory): RepairResult

  // 내구도 비율 조회
  getRatio(buildingId: string): number   // 0.0 ~ 1.0

  // 균열 레벨 조회
  getCrackLevel(buildingId: string): 0 | 1 | 2 | 3
}

type DamageResult =
  | { alive: true; durability: number }
  | { alive: false };   // 파괴됨

type RepairResult =
  | { ok: true; recovered: number; cost: number }
  | { ok: false; reason: 'insufficient_materials' | 'already_full' | 'not_found' };
```

---

## 7. SaveData 연동

plan 17 `BuildingSaveEntry` 에 내구도 필드 이미 포함:
```typescript
durability: number;   // 저장 시 현재 내구도 그대로 보존
```

추가로 plan 21 `WorldSaveData` 에 파괴 기록 추가:
```typescript
// 파괴된 건설물은 SaveData에서 제거되므로 별도 기록 불필요
// killedEnemies와 동일한 패턴으로 처리
```

---

## 8. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/DurabilitySystem.ts` | 신규: 내구도 전체 관리 |
| `src/systems/BuildSystem.ts` | DurabilitySystem 연동, 파괴 처리 |
| `src/systems/CombatSystem.ts` | 적이 벽 공격 시 `applyDamage()` 호출 |
| `src/systems/ActionSystem.ts` | 광란 자동 공격 시 건설물 `applyDamage()` 호출 |
| `src/world/SpriteGenerator.ts` | 균열 오버레이 텍스처 3단계 추가 |
| `src/ui/HoverTooltip.ts` | 구조물 내구도 바 + 수리 컨텍스트 메뉴 |
| `src/scenes/GameScene.ts` | DurabilitySystem 인스턴스, 매 프레임 update |
| `src/systems/SaveSystem.ts` | 변경 없음 (BuildingSaveEntry에 이미 durability 포함) |

---

## 9. 확정 규칙

- 내구도가 **최대치일 때** 수리 시도 → "이미 완전한 상태입니다" 안내
- 수리는 상호작용 범위(48px) 이내에서만 가능
- 멀티플레이에서 수리 완료 시 Firebase `buildings/{id}/durability` 즉시 업로드
- 적의 벽 공격은 **목재 벽만 대상** — 석재 벽은 적이 공격하지 않음 (우회 불가 시 경로 포기)
- 지붕·바닥은 시간 노후화만 받음 (전투 피해 없음)
- 내구도 저장 주기: 자동 저장 주기(5분)와 동일, 수동 저장 시 즉시 반영
