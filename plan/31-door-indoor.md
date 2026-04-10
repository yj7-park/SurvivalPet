# 설계 31 — 문 상호작용 & 실내/실외 시스템

> **전제 조건**: 01~30 단계 완료 상태.
> BuildSystem, SleepSystem(실내 보너스), DurabilitySystem이 구현되어 있다고 가정한다.
> plan 22·23에서 "실내(지붕 아래)" 조건을 참조했으나 감지 알고리즘이 미설계 — 이번에 확정.

---

## 1. 이번 단계 목표

1. **문(Door) 상호작용** — E 키 열기/닫기, 충돌 처리
2. **실내/실외 감지 알고리즘** — 지붕·벽으로 둘러싸인 공간 판정
3. **실내 효과 통합** — 수면 회복 +20%, 내구도 노후화 −50% 연동 확정
4. **문 잠금(선택)** — 멀티플레이에서 본인만 열 수 있는 잠금 기능

---

## 2. 문 상호작용

### 2-1. 열기 / 닫기

```
E 키 입력 시:
  → 플레이어 주변 48px 내 문 탐색
  → 가장 가까운 문 대상으로 토글 (열림 ↔ 닫힘)
  → 여러 문이 범위 내일 경우: 가장 가까운 것 우선

마우스 클릭으로도 동일하게 토글 가능
```

### 2-2. 문 상태

```typescript
interface DoorState {
  buildingId: string;
  open: boolean;
  lockedBy: string | null;   // playerId, null이면 잠금 없음
}
```

| 상태 | 충돌 | 시각 |
|------|------|------|
| 닫힘 | 이동 차단 (벽과 동일) | 수직 직사각형 스프라이트 |
| 열림 | 통과 가능 | 90° 회전한 스프라이트 (문틀에 붙은 모양) |

### 2-3. 문 스프라이트

SpriteGenerator 목재/석재 문 2종:
```typescript
// 닫힌 문: 32×32, 나무결 또는 석재 질감의 직사각형
// 열린 문: 32×32, 문틀만 남기고 문짝이 옆으로 접힌 모양
// Depth: 벽과 동일 레이어
```

### 2-4. E 키 범위 내 문 없을 시

아무 반응 없음 (오류 없이 조용히 무시).  
범위 내 상호작용 가능한 문이 있을 때만 HUD에 힌트 표시:
```
[E] 문 열기   (화면 하단 중앙, 12px, 0.5초 페이드인)
```

---

## 3. 실내/실외 감지 알고리즘

plan 22(내구도 감소), plan 23(수면 효율), plan 28(의자 회복)에서 참조하는 `isIndoor(tileX, tileY)` 구현.

### 3-1. 판정 기준

**실내 조건**: 해당 타일이 지붕 타일로 덮여 있을 것.

```typescript
function isIndoor(tileX: number, tileY: number, mapX: number, mapY: number): boolean {
  // 지붕(roof) 건설물이 해당 타일을 커버하는지 확인
  return buildingSystem.getRoofAt(tileX, tileY, mapX, mapY) !== null;
}
```

### 3-2. 지붕 커버리지

지붕 건설물은 **중심 타일 기준 3×3 영역**을 커버:

```typescript
// 지붕 건설 시 커버 영역 등록
function onRoofBuilt(roof: Building): void {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      roofCoverage.add(`${roof.tileX + dx},${roof.tileY + dy}`);
    }
  }
}

function onRoofRemoved(roof: Building): void {
  // 해당 지붕이 커버하던 타일 제거
  // (다른 지붕이 중복 커버하는 경우 유지)
  rebuildRoofCoverage();
}
```

### 3-3. 실내 공간 조건 (벽 + 지붕)

지붕만으로 실내 판정 (벽 없어도 지붕 아래면 실내).  
이유: 간단한 구현, 벽 연결성 검사(flood fill) 대비 성능 우수.

```typescript
// RoofSystem: 지붕 커버 타일 집합 관리
export class RoofSystem {
  private covered: Set<string> = new Set();  // "tileX,tileY"

  isCovered(tileX: number, tileY: number): boolean {
    return this.covered.has(`${tileX},${tileY}`);
  }

  addRoof(cx: number, cy: number): void      // 3×3 등록
  removeRoof(cx: number, cy: number): void   // 3×3 해제 (중복 체크)
  getRoofAt(tx: number, ty: number): boolean
}
```

### 3-4. 플레이어 실내 여부 갱신 주기

매 프레임이 아닌 **이동 시에만** 재계산 (타일 단위로 변화):

```typescript
let lastTileX = -1, lastTileY = -1;

function updateIndoorStatus(px: number, py: number): void {
  const tileX = Math.floor(px / TILE_SIZE);
  const tileY = Math.floor(py / TILE_SIZE);
  if (tileX === lastTileX && tileY === lastTileY) return;   // 타일 변화 없으면 스킵
  lastTileX = tileX; lastTileY = tileY;
  player.isIndoor = roofSystem.isCovered(tileX, tileY);
}
```

---

## 4. 실내 효과 통합 확정

다음 시스템들이 `player.isIndoor` 를 참조:

| 시스템 | 실내 효과 | plan 참조 |
|--------|---------|---------|
| SleepSystem | 침대 회복량 ×1.2 | plan 23 |
| DurabilitySystem | 노후화 속도 ×0.5 | plan 22 |
| SitSystem | 의자 회복량 ×1.1 (소규모 보너스) | plan 28 신규 추가 |
| WeatherSystem | 비·눈 효과 차단 | plan 08 연동 |

날씨 차단 효과 (plan 08 연동):
```typescript
// 비/눈이 내릴 때 실내이면 패널티 없음
if (weatherSystem.isRaining() && !player.isIndoor) {
  // 이동속도 -10%, 시야 감소 등 (추후 날씨 패널티 설계 시 연동)
}
```

---

## 5. 문 잠금 (멀티플레이 선택 기능)

### 5-1. 잠금 UI

문 우클릭 → 컨텍스트 메뉴:
```
[E] 열기/닫기
[🔒] 잠금 설정 / 해제
```

### 5-2. 잠금 규칙

```typescript
function tryOpenDoor(door: DoorState, playerId: string): boolean {
  if (door.lockedBy === null) return true;           // 잠금 없음 → 누구나 가능
  if (door.lockedBy === playerId) return true;       // 본인 잠금 → 가능
  // 타인 잠금 → 불가
  notifySystem.show('잠긴 문입니다', 'warning');
  return false;
}
```

잠금 상태 스프라이트: 문 중앙에 자물쇠 아이콘 (8×8) 오버레이.

### 5-3. Firebase 동기화

문 상태(열림/잠금)는 건설물 데이터와 함께 저장:
```typescript
// Firebase /rooms/{seed}/world/buildings/{id}
{ ...buildingData, doorOpen: false, lockedBy: null }
```

문 열기 이벤트 → Firebase 즉시 업데이트 → 다른 플레이어 실시간 반영.

---

## 6. DoorSystem 클래스

```typescript
export class DoorSystem {
  private doors: Map<string, DoorState>;   // buildingId → DoorState

  // E 키 또는 클릭
  interact(buildingId: string, playerId: string): void

  // 잠금 토글
  toggleLock(buildingId: string, playerId: string): void

  // 충돌 여부 조회 (TileMap 충돌 업데이트용)
  isBlocking(buildingId: string): boolean

  // 문 등록/해제
  registerDoor(building: Building): void
  unregisterDoor(buildingId: string): void

  // E 키 범위 내 가장 가까운 문
  getNearestDoor(px: number, py: number, range: number): DoorState | null
}
```

---

## 7. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/DoorSystem.ts` | 신규: 문 열기·잠금·충돌 관리 |
| `src/systems/RoofSystem.ts` | 신규: 지붕 커버리지 집합 관리 |
| `src/systems/BuildSystem.ts` | 지붕 건설/철거 시 RoofSystem 연동 |
| `src/scenes/GameScene.ts` | DoorSystem·RoofSystem 통합, E 키 핸들러, 실내 여부 갱신 |
| `src/systems/SleepSystem.ts` | `player.isIndoor` 참조 (기존 TODO → 실제 연동) |
| `src/systems/DurabilitySystem.ts` | `roofSystem.isCovered()` 참조 연동 |
| `src/systems/SitSystem.ts` | 실내 앉기 보너스 ×1.1 추가 |
| `src/world/SpriteGenerator.ts` | 목재·석재 문 스프라이트 2종 (열림/닫힘) |
| `src/systems/MultiplayerSystem.ts` | 문 상태 Firebase 즉시 업로드 |
| `src/ui/HUD.ts` | E 키 힌트 텍스트 (문 근처 시) |

---

## 8. 확정 규칙

- 지붕만 있으면 실내 — 사방이 벽으로 막히지 않아도 지붕 아래면 효과 적용
- 열린 문은 이동 가능, 닫힌 문은 벽과 동일하게 이동 차단
- 문 내구도는 벽과 동일한 방식으로 감소 (plan 22)
- 적은 닫힌 목재 문 공격 가능 (석재 문은 공격 안 함 — plan 22 규칙 확장)
- 잠금은 싱글플레이에서는 의미 없음 (표시는 하되 효과 없음)
- 문이 파괴되면 잠금 해제 상태로 재건설 가능
- 맵 전환 시 문 상태(열림/닫힘) 저장 — `BuildingSaveEntry`에 `doorOpen` 필드 추가
