# 설계 28 — 가구 상호작용 & 자원 재생

> **전제 조건**: 01~27 단계 완료 상태.
> BuildSystem, SleepSystem, HungerSystem, CharacterStats가 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **의자 상호작용** — 앉기로 피로 소폭 회복
2. **식탁 상호작용** — 식탁 근처 섭취 보너스 시각화 및 앉아먹기
3. **작업대·조리대 접근 보정** — 가구 종류별 상호작용 범위 통일
4. **나무 재생성** — 벌목 후 일정 시간 경과 시 재생
5. **자원 고갈 규칙** — 암반(영구 소모) vs 나무(재생) 정책 확정

---

## 2. 의자 상호작용

### 2-1. 앉기 흐름

```
의자 클릭 (48px 이내)
  → 플레이어 이동 후 의자 앞에 정지
  → 앉기 애니메이션 (캐릭터 스프라이트 크기 y축 0.85× 축소)
  → SitSystem.startSitting()
  → 피로 회복 시작

일어서기:
  → 방향키 입력 또는 다른 상호작용 클릭 시 즉시 기립
  → 전투 피격 시 강제 기립
```

### 2-2. 피로 회복량

```typescript
// 의자 종류별 앉기 회복 속도 (피로/게임시간 1시간)
const CHAIR_REGEN: Record<ChairType, number> = {
  chair_wood:  6,   // 목재 의자: 6/시간 (수면 목재침대 60/일 ≈ 2.5/시간과 비교 시 약 2.4배 느림)
  chair_stone: 9,   // 석재 의자
};

// 실시간 (delta: ms)
fatigue += (rate / (1_800_000 / 24)) * delta;
// chair_wood: 현실 1분 ≈ 피로 +0.2 (수면 대비 매우 느림 — 간식 개념)
```

### 2-3. 앉기 조건 및 제한

| 조건 | 처리 |
|------|------|
| 전투 중 | 앉기 불가 — "전투 중에는 앉을 수 없습니다" |
| 광란 모드 | 앉기 불가 (조작 차단) |
| 피로 100 | 앉기 가능 — "이미 충분히 쉬었습니다" 알림만 (회복 없음) |
| 의자 위에 이미 다른 플레이어 | 불가 — "이미 사용 중입니다" (멀티플레이) |

### 2-4. 앉기 HUD 표시

앉기 상태 아이콘 HUD 우하단:
```
🪑 휴식 중  피로 +0.2/분
```
0.5초 주기로 피로 게이지 소폭 증가 애니메이션.

---

## 3. 식탁 상호작용

### 3-1. 식탁 보너스 시각화 (plan 24 보완)

식탁 48px 이내 진입 시 식탁 위에 아이콘 표시:
```
[🍽 +30% 식사 효율]  (10px, 노란색, 식탁 상단)
```
범위 이탈 시 아이콘 사라짐.

### 3-2. 식탁에 앉아 먹기

식탁 클릭 → 컨텍스트 메뉴:
```
[🪑 앉기]
[🍖 인벤토리에서 음식 선택]
```

앉아먹기 시 두 가지 보너스 중첩:
```typescript
// 식탁 보너스(×1.3) + 앉아먹기 보너스(×1.1) = ×1.43
const totalMult = 1.3 * (sitting ? 1.1 : 1.0);
// 구운 생선 25 → 식탁+앉기 = 35.75 → 36 (반올림)
```

---

## 4. 가구 상호작용 범위 통일

모든 가구·설비의 상호작용 거리:

| 가구 | 상호작용 거리 | 비고 |
|------|------------|------|
| 침대 | 48px | 수면 |
| 의자 | 48px | 앉기 |
| 식탁 | 48px | 보너스 범위 |
| 작업대 | 48px | 제작·연구 UI |
| 조리대 | 48px | 요리 UI |
| 건설물 수리 | 48px | 수리 상호작용 |

모두 동일하게 통일 → `INTERACTION_RANGE = 48` 상수 하나로 관리.

---

## 5. 나무 재생성 시스템

### 5-1. 재생 정책

plan 00 기준: "일정 시간 후 나무 재생성"
plan 17에서 `cutTrees` 에 `regrowAt` 타임스탬프 저장.

```typescript
// 벌목 완료 시
const TREE_REGROW_MS = 10 * 60 * 1000;   // 현실 10분
world.cutTrees.push({
  mapX, mapY, tileX, tileY,
  regrowAt: Date.now() + TREE_REGROW_MS,
});
```

### 5-2. 재생 처리

```typescript
// GameScene.update() 또는 맵 로드 시
function processTreeRegrowth(world: WorldSaveData, now: number): void {
  world.cutTrees = world.cutTrees.filter(entry => {
    if (now >= entry.regrowAt) {
      // 해당 타일에 나무 오브젝트 재배치
      objectSystem.spawnTree(entry.mapX, entry.mapY, entry.tileX, entry.tileY);
      return false;   // cutTrees 목록에서 제거
    }
    return true;
  });
}
```

맵 로드 시에도 실행 → 오프라인 중 경과한 재생도 반영.

### 5-3. 재생 연출

나무 재생 시:
```
타일에서 작은 새싹 스프라이트(8×8) 0.5초 표시
  → 스케일 0→1 팝업 애니메이션 (0.3초)
  → 성숙 나무 스프라이트로 교체
```

새싹 스프라이트: SpriteGenerator에 추가 (초록 작은 삼각형).

### 5-4. 멀티플레이 재생 동기화

나무 벌목 이벤트는 Firebase에 `regrowAt` 포함해서 저장 (plan 20):
```typescript
// Firebase /rooms/{seed}/world/cutTrees/{id}
{ mapX, mapY, tileX, tileY, regrowAt }
```
모든 클라이언트가 동일한 `regrowAt`을 참조 → 동시에 재생.

---

## 6. 자원 고갈 규칙 확정

| 자원 | 재생 | 규칙 |
|------|------|------|
| 나무 | ✅ 10분 후 재생 | 세계 지속 가능 자원 |
| 물고기 | ✅ 무한 | 낚시는 항상 가능 |
| 암반(채굴) | ❌ 영구 소모 | 희소 자원, 전략적 채굴 필요 |
| 지면 드랍 아이템 | ❌ 시간 소멸 | plan 16 규칙 |

암반 부족 시 대안:
- 다른 맵으로 이동해 채굴 (plan 21 맵 전환)
- 연구 없이 시작 → 초반 목재 위주 건설 유도

---

## 7. SitSystem 클래스

```typescript
export class SitSystem {
  private sitting: boolean = false;
  private chairRef: Building | null = null;

  startSitting(chair: Building): void
  stopSitting(): void

  // 매 프레임
  update(delta: number, stats: CharacterStats): void

  isSitting(): boolean

  // 멀티플레이 — 의자 점유 상태 (Firebase 동기화 불필요, 클라 전용)
  isChairOccupied(chairId: string): boolean
}
```

---

## 8. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/SitSystem.ts` | 신규: 앉기·피로 회복 관리 |
| `src/systems/BuildSystem.ts` | `INTERACTION_RANGE` 상수 통일, 의자 점유 관리 |
| `src/world/ObjectSystem.ts` | `spawnTree()` 메서드, 재생 연출 |
| `src/world/SpriteGenerator.ts` | 새싹 스프라이트 추가 |
| `src/scenes/GameScene.ts` | SitSystem 통합, `processTreeRegrowth()` 주기 호출 |
| `src/ui/HUD.ts` | 앉기 상태 아이콘 표시 |
| `src/ui/HoverTooltip.ts` | 식탁 보너스 아이콘, 의자 앉기 메뉴 |
| `src/systems/SaveSystem.ts` | `cutTrees` regrowAt 저장 이미 포함 (plan 17) — 변경 없음 |
| `src/systems/MultiplayerSystem.ts` | 나무 재생 Firebase `regrowAt` 업로드 확인 |

---

## 9. 확정 규칙

- 의자 피로 회복은 수면 대비 약 15% 속도 — 짧은 휴식 개념
- 앉기 중 인벤토리·제작 UI 열기 가능 (가구 상호작용 UI는 불가)
- 나무 재생은 **플레이어가 없는 맵**에서도 `regrowAt` 기준으로 진행 (오프라인 포함)
- 암반은 재생 없음 — 게임 후반 자원 고갈이 의도된 난이도 요소
- 의자 위에 건설물 배치 불가 (의자 타일은 점유 상태 유지)
- 식탁 보너스는 식탁 소유자와 무관 — 범위 내 모든 플레이어에게 적용 (멀티플레이)
