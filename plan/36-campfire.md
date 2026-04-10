# 설계 36 — 모닥불 시스템

> **전제 조건**: 01~35 단계 완료 상태.
> BuildSystem, LightSystem(plan 32), WeatherEffectSystem(plan 35),
> CookingSystem(plan 13), SpriteGenerator가 구현되어 있다고 가정한다.
> plan 32에서 모닥불 광원(반경 200px)을 "추후" 로 예약했음.

---

## 1. 이번 단계 목표

1. **모닥불 설치** — 건설 시스템과 독립된 간이 설치
2. **연료 시스템** — 목재 소모로 불 유지, 소진 시 꺼짐
3. **광원 제공** — 가장 큰 광원(200px), plan 32 연동
4. **방한 효과** — 겨울 날씨 패널티 부분 상쇄
5. **간이 요리** — 조리대 없이 기본 요리 가능
6. **비·눈에 의한 소화** — 날씨 연동

---

## 2. 모닥불 설치

### 2-1. 설치 방법

건설 패널(B 키) **[기타]** 탭에 추가 (작업대·조리대와 별도):

```
[기타]
  🔥 모닥불   목재 ×3   즉시 설치
```

- 건설 시간 없음 (즉시)
- 흙 타일에만 설치 가능
- 실내(지붕 아래)에도 설치 가능 — 단 연기 경고 없음 (게임 단순화)
- 한 맵에 최대 10개 제한 (성능 고려)

### 2-2. 초기 연료

설치 시 사용한 목재 ×3이 초기 연료로 자동 투입:
```typescript
const INITIAL_FUEL = 3;   // 목재 3개 = 설치 즉시 켜짐
```

---

## 3. 연료 시스템

### 3-1. 연료 소모 속도

```typescript
// 목재 1개당 지속 시간
const FUEL_DURATION_PER_WOOD_MS = 3 * 60 * 1000;   // 현실 3분

// 날씨별 연료 소모 배율 (비/눈/블리자드에서 더 빨리 소모)
const FUEL_CONSUMPTION: Record<WeatherType, number> = {
  clear:     1.0,
  cloudy:    1.0,
  rain:      2.0,   // 비: 2배 빠르게 소모
  fog:       1.0,
  snow:      1.5,
  storm:     3.0,   // 폭풍: 3배
  blizzard:  4.0,   // 블리자드: 4배 → 목재 3개 = 약 45초
  leaves:    1.0,
};

// 실내 설치 시 날씨 영향 없음
const effectiveConsumption = isIndoor ? 1.0 : FUEL_CONSUMPTION[weather];
```

### 3-2. 연료 투입

```
모닥불 클릭 (48px 이내)
  → 컨텍스트 메뉴:
      [🪵 연료 투입]  목재 ×1~5 선택
      [🍖 요리하기]
      [💨 끄기]

[연료 투입] 선택:
  → 슬라이더 또는 ±버튼으로 수량 선택 (보유 목재 내)
  → 즉시 투입 → 남은 연소 시간 증가
```

### 3-3. 연료 상태 표시

모닥불 호버 시:
```
🔥 모닥불
연료: ████████░░  잔여 6:42
[🪵 연료 투입]  [🍖 요리하기]
```

남은 시간에 따른 불꽃 크기:
| 잔여 비율 | 불꽃 크기 | 광원 반경 |
|---------|---------|---------|
| 80%~ | 크게 (×1.0) | 200px |
| 50~79% | 보통 (×0.85) | 170px |
| 20~49% | 작게 (×0.65) | 140px |
| ~19% | 깜빡임 | 100px |
| 0% | 꺼짐 (잔불) | 0px |

---

## 4. 날씨에 의한 소화

### 4-1. 소화 조건

```typescript
// 매 프레임 체크
function checkExtinguish(campfire: Campfire, weather: WeatherType, isIndoor: boolean): void {
  if (isIndoor) return;   // 실내는 소화 없음

  const extinguishChance: Partial<Record<WeatherType, number>> = {
    rain:      0.0005,   // 프레임당 0.05% → 약 33초에 한 번 꺼짐 시도
    storm:     0.002,    // 프레임당 0.2% → 약 8초
    blizzard:  0.005,    // 프레임당 0.5% → 약 3초
  };

  const chance = extinguishChance[weather] ?? 0;
  if (Math.random() < chance * (delta / 16.67)) {
    extinguishCampfire(campfire);
  }
}
```

소화 시 연출:
```
불꽃 파티클 → 연기 파티클 급증 (흰색, 위로 퍼짐)
"빗물에 모닥불이 꺼졌습니다" 알림
잔불 스프라이트 표시 (회색 재 더미)
```

잔불 상태: 재점화 가능 (목재 ×1 투입 → 즉시 재점화)

### 4-2. 실내 설치 시 날씨 보호

지붕 아래 모닥불: 소화 없음 + 연료 소모 배율 1.0 고정

---

## 5. 방한 효과

### 5-1. 범위 내 방한

```typescript
const WARMTH_RADIUS = 96;   // px, 모닥불 방한 효과 범위

// 플레이어가 범위 내에 있으면 겨울 패널티 부분 감소
function getWarmthMultiplier(distToCampfire: number): number {
  if (distToCampfire > WARMTH_RADIUS) return 1.0;   // 범위 밖: 효과 없음
  const t = 1 - (distToCampfire / WARMTH_RADIUS);   // 0~1 (가까울수록 1)
  return lerp(1.0, 0.5, t);   // 패널티 최대 50% 감소
}
// 예: 허기 감소 겨울 패널티 ×1.5 → 모닥불 바로 옆 ×0.75 (50% 감소)
```

### 5-2. 방한 적용 대상

| 패널티 항목 | 방한 효과 |
|-----------|---------|
| 허기 감소 배율 | ✅ 감소 |
| 피로 감소 배율 | ✅ 감소 |
| 이동속도 패널티 | ❌ 없음 (눈길은 불가 어쩔 수 없음) |
| 횃불 수명 소모 | ❌ 없음 |

### 5-3. 방한 HUD 표시

플레이어가 모닥불 96px 이내 진입 시:
```
🔥 따뜻합니다  (주황색, 8px, 우하단, 3초 표시 후 사라짐)
```

---

## 6. 간이 요리 (모닥불 요리)

### 6-1. 가능한 요리

조리대 전체 레시피가 아닌 **기본 요리만** 가능:

| 레시피 | 재료 | 산출 | 소요 시간 | 조건 |
|--------|------|------|---------|------|
| 생선 굽기 | 날생선 ×1 | 구운 생선 ×1 | 기본 10초 | 항상 가능 |
| 고기 굽기 | 날고기 ×1 | 구운 고기 ×1 | 기본 10초 | 항상 가능 |

- 스튜 등 고급 요리는 **조리대 전용** (모닥불 불가)
- 요리 중 모닥불이 꺼지면 요리 즉시 취소 (재료 반환)

### 6-2. 요리 UI (간이)

```
┌─────────────────────────────────┐
│  🔥 모닥불 요리             [✕] │
├─────────────────────────────────┤
│  [🐟 생선 굽기]   날생선 ×1    │
│     보유: 3개   [요리하기]      │
│                                 │
│  [🥩 고기 굽기]   날고기 ×1    │
│     보유: 0개   [재료 없음]     │
└─────────────────────────────────┘
```

조리대 패널(plan 13)과 동일한 구조, 레시피 목록만 제한.

### 6-3. 요리 숙련도 연동

모닥불 요리도 `cooking` 숙련도 XP 지급 (plan 14와 동일):
- 생선/고기 굽기 ×1 → `cooking +12`

---

## 7. 멀티플레이 연동

### 7-1. Firebase 저장

모닥불은 건설물이 아닌 **별도 컬렉션**으로 저장:
```
/rooms/{seed}/campfires/{campfireId}/
  ├── mapX, mapY, tileX, tileY
  ├── fuelMs: number        // 남은 연소 시간 (ms)
  ├── lit: boolean          // 켜짐 여부
  ├── placedAt: number      // Date.now()
  └── placedBy: string      // playerId
```

- 연료 투입·소모는 **투입 이벤트만 Firebase 동기화** (소모는 로컬 계산)
- 소화 이벤트는 즉시 Firebase 업데이트

### 7-2. 연료 동기화

```typescript
// 연료 투입 시
await update(ref(db, `rooms/${seed}/campfires/${id}`), {
  fuelMs: newFuelMs,
});
// 다른 플레이어가 수신 → 로컬 fuelMs 갱신 → 남은 시간 재계산
```

---

## 8. Campfire 스프라이트

SpriteGenerator에 추가:

| 키 | 크기 | 설명 |
|----|------|------|
| `campfire_large` | 32×32 | 큰 불꽃 (연료 80%+) |
| `campfire_medium` | 32×32 | 보통 불꽃 |
| `campfire_small` | 32×32 | 작은 불꽃 (20% 이하, 깜빡임) |
| `campfire_ash` | 32×32 | 잔불/꺼진 상태 (회색 재) |

불꽃 애니메이션: 3프레임 루프 (large/medium/small 각 3프레임 스프라이트시트)

---

## 9. CampfireSystem 클래스

```typescript
export class CampfireSystem {
  private campfires: Map<string, Campfire>;

  // 설치
  place(tileX: number, tileY: number, mapX: number, mapY: number): Campfire

  // 연료 투입
  addFuel(id: string, woodCount: number, inventory: Inventory): void

  // 꺼짐 (날씨 소화 또는 연료 소진)
  extinguish(id: string): void

  // 재점화
  relight(id: string, inventory: Inventory): void

  // 방한 효과 조회
  getWarmthMultiplier(px: number, py: number): number

  // 매 프레임
  update(delta: number, weather: WeatherType): void

  // 요리 가능 여부 (켜져 있고 범위 내)
  canCookAt(id: string, px: number, py: number): boolean

  // LightSystem에 광원 목록 제공
  getLightSources(): LightSource[]
}

interface Campfire {
  id: string;
  tileX: number; tileY: number;
  mapX: number;  mapY: number;
  fuelMs: number;
  lit: boolean;
  isIndoor: boolean;
}
```

---

## 10. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/CampfireSystem.ts` | 신규: 모닥불 전체 관리 |
| `src/ui/CampfirePanel.ts` | 신규: 연료 투입·간이 요리 UI |
| `src/scenes/GameScene.ts` | CampfireSystem 통합, 방한 효과 연동 |
| `src/systems/LightSystem.ts` | `CampfireSystem.getLightSources()` 통합 |
| `src/systems/WeatherEffectSystem.ts` | 방한 배율 × 날씨 배율 곱셈 처리 |
| `src/systems/BuildSystem.ts` | 건설 패널 [기타] 탭에 모닥불 추가 |
| `src/systems/MultiplayerSystem.ts` | campfires 컬렉션 리스너 등록 |
| `src/world/SpriteGenerator.ts` | 모닥불 스프라이트시트 4종 추가 |
| `src/systems/SaveSystem.ts` | `campfires` 저장 (멀티는 Firebase, 싱글은 localStorage) |

---

## 11. 확정 규칙

- 모닥불은 건설물(`BuildingSaveEntry`) 아님 — 별도 `CampfireSaveEntry` 로 저장
- 연료 0 → 잔불 상태 유지 (타일 차지), 수동 철거 가능
- 철거 시 목재 회수 없음 (연료는 이미 소모됨)
- 모닥불 위를 플레이어가 통과 가능 (이동 차단 없음)
- 적은 모닥불을 공격하지 않음 (파괴 불가)
- 싱글플레이에서도 동일하게 작동 (Firebase 없이 로컬 CampfireSystem)
