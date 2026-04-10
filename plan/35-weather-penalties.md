# 설계 35 — 날씨 패널티 & 계절 게임플레이 효과

> **전제 조건**: 01~34 단계 완료 상태.
> plan 08(날씨 시각 이펙트), plan 31(실내/실외 판정), plan 32(조명) 가 구현되어 있다고 가정한다.
> 날씨 시각 효과(파티클·오버레이)는 plan 08에서 완료 — 이번 단계는 게임플레이 수치 효과만 다룬다.

---

## 1. 이번 단계 목표

1. **날씨별 패널티** — 이동속도·허기·피로·횃불 수명에 미치는 영향
2. **실내 차단** — 지붕 아래(plan 31)에서 날씨 패널티 무효화
3. **계절별 자원·적 변화** — 나무 밀도, 적 침략 빈도 계절 보정
4. **겨울 방한 시스템** — 체온 수치 없이 간단하게 처리
5. **HUD 날씨 아이콘** — 현재 날씨 상태 표시

---

## 2. 날씨별 게임플레이 패널티

### 2-1. 패널티 정의표

| 날씨 | 이동속도 | 허기 감소 | 피로 감소 | 횃불 수명 | 시야(광원 반경) |
|------|---------|---------|---------|---------|--------------|
| 맑음 | ×1.0 | ×1.0 | ×1.0 | ×1.0 | ×1.0 |
| 흐림 | ×1.0 | ×1.0 | ×1.0 | ×1.0 | ×0.9 |
| 비 | ×0.9 | ×1.1 | ×1.1 | ×0.6 | ×1.0 |
| 안개 | ×0.95 | ×1.0 | ×1.0 | ×1.0 | ×0.6 |
| 눈 | ×0.75 | ×1.3 | ×1.2 | ×0.5 | ×1.0 |
| 폭풍 | ×0.7 | ×1.2 | ×1.3 | ×0.3 | ×0.8 |
| 블리자드 | ×0.5 | ×1.5 | ×1.5 | ×0.1 | ×0.9 |
| 낙엽 | ×1.0 | ×1.0 | ×1.0 | ×1.0 | ×1.0 |

> 안개의 시야 감소: 광원 반경에 0.6을 곱함 (횃불 160px → 96px)
> 횃불 수명 배율: 예) 블리자드 중 들고 있는 횃불 10분 × 0.1 = 1분만 지속

### 2-2. 패널티 적용 코드

```typescript
export class WeatherEffectSystem {
  // WeatherSystem(plan 08)에서 현재 날씨 수신
  getMultipliers(weather: WeatherType, isIndoor: boolean): WeatherMultipliers {
    if (isIndoor) return NEUTRAL_MULTIPLIERS;   // 실내 → 모든 패널티 무효

    return WEATHER_MULTIPLIERS[weather] ?? NEUTRAL_MULTIPLIERS;
  }
}

interface WeatherMultipliers {
  moveSpeed:      number;   // 이동속도 배율
  hungerDecay:    number;   // 허기 감소 배율
  fatigueDecay:   number;   // 피로 감소 배율
  torchDuration:  number;   // 횃불 수명 배율
  lightRadius:    number;   // 광원 반경 배율 (안개·폭풍)
}

const NEUTRAL_MULTIPLIERS: WeatherMultipliers = {
  moveSpeed: 1.0, hungerDecay: 1.0, fatigueDecay: 1.0,
  torchDuration: 1.0, lightRadius: 1.0,
};
```

### 2-3. 각 시스템 연동 지점

```typescript
// CharacterStats.ts — 이동속도
get effectiveMoveSpeed(): number {
  return this.baseMoveSpeed
    * this.fatigueSpeedMult       // plan 23
    * this.hungerSpeedMult        // plan 24
    * weatherEffects.moveSpeed;   // 이번 단계
}

// HungerSystem.ts — 허기 감소
hunger -= baseDecayRate * weatherEffects.hungerDecay * delta;

// SleepSystem.ts (피로 감소에도 동일 패턴 적용)
fatigue -= baseDecayRate * weatherEffects.fatigueDecay * delta;

// LightSystem.ts — 광원 반경
const effectiveRadius = light.radius * weatherEffects.lightRadius;

// EquipmentSystem.ts (횃불 수명)
torch.remainingMs -= delta * (1 / weatherEffects.torchDuration);
// torchDuration 0.1 → 10배 빠르게 소진
```

---

## 3. 날씨 전환 시 부드러운 패널티 적용

날씨가 즉시 전환될 때 패널티도 즉시 적용 (하루 단위 전환이므로 허용).  
단 폭풍·블리자드는 하루 안에서 시작/끝이 있으므로 **5분에 걸쳐 선형 보간**:

```typescript
// 폭풍 패널티 페이드인
function lerpMultipliers(from: WeatherMultipliers, to: WeatherMultipliers, t: number): WeatherMultipliers {
  return {
    moveSpeed:     lerp(from.moveSpeed,     to.moveSpeed,     t),
    hungerDecay:   lerp(from.hungerDecay,   to.hungerDecay,   t),
    fatigueDecay:  lerp(from.fatigueDecay,  to.fatigueDecay,  t),
    torchDuration: lerp(from.torchDuration, to.torchDuration, t),
    lightRadius:   lerp(from.lightRadius,   to.lightRadius,   t),
  };
}
// t: 0→1, 5분(300초 현실) 동안 증가
```

---

## 4. 계절별 자원·적 변화

### 4-1. 계절별 나무 밀도 보정

맵 생성 시 Poisson Disk Sampling 밀도에 계절 시드 반영:

| 계절 | 나무 밀도 | 설명 |
|------|---------|------|
| 봄 | 흙 타일의 20% | 기준 |
| 여름 | 25% | 울창 |
| 가을 | 18% | 낙엽 일부 빠짐 |
| 겨울 | 12% | 앙상한 나무 |

> 맵은 seed 기반 고정 생성이므로 계절별 나무 밀도는 **재생성 시** 반영 (맵 전환 시 새 맵에 적용).  
> 현재 맵의 나무는 계절 바뀐다고 변하지 않음.

### 4-2. 계절별 적 침략 빈도 보정

plan 06 침략 이벤트 타이머에 계절 배율 적용:

| 계절 | 침략 빈도 배율 | 설명 |
|------|------------|------|
| 봄 | ×1.0 | 기준 |
| 여름 | ×1.2 | 더위로 적 활성화 |
| 가을 | ×1.1 | 겨울 대비 약탈 증가 |
| 겨울 | ×0.7 | 추위로 적도 줄어듦 |

### 4-3. 계절별 낚시 성공률 보정

| 계절 | 낚시 보정 |
|------|---------|
| 봄 | +5% |
| 여름 | +10% |
| 가을 | ±0% |
| 겨울 | −15% (얼음 아래 낚시 — 어렵지만 가능) |

```typescript
const seasonFishBonus: Record<Season, number> = {
  spring: 5, summer: 10, autumn: 0, winter: -15,
};
// CharacterStats.fishSuccessRate에 가산
```

---

## 5. 겨울 방한 처리 (간소화)

체온(Temperature) 수치를 별도로 만들지 않고 **패널티로 대체**:

- 겨울 기본 패널티: 허기 ×1.1 (맑은 날에도)
- 눈/블리자드 추가 패널티 중첩 (위 표와 곱셈)
- 방한 아이템은 이번 단계 미포함 (추후 방한복 도면 추가 가능)

방한 힌트 표시 (겨울 첫 진입 시 1회):
```
❄ 겨울이 왔습니다. 충분한 음식과 실내 공간을 확보하세요.
```

---

## 6. HUD 날씨 아이콘

화면 우상단 시계 옆에 날씨 아이콘 추가:

```
봄 3일  14:22  🌧
```

| 날씨 | 아이콘 |
|------|--------|
| 맑음 | ☀ |
| 흐림 | ☁ |
| 비 | 🌧 |
| 안개 | 🌫 |
| 눈 | 🌨 |
| 폭풍 | ⛈ |
| 블리자드 | ❄ |
| 낙엽 | 🍂 |

날씨 아이콘 호버 시 툴팁:
```
현재 날씨: 비
• 이동속도 −10%
• 허기 소모 +10%
• 횃불 수명 −40%
실내에서는 패널티 없음
```

---

## 7. WeatherEffectSystem 클래스

```typescript
export class WeatherEffectSystem {
  private currentWeather: WeatherType = 'clear';
  private transitionTimer: number = 0;     // 폭풍 페이드인용
  private transitionDuration: number = 0;
  private fromMults: WeatherMultipliers = NEUTRAL_MULTIPLIERS;
  private toMults: WeatherMultipliers = NEUTRAL_MULTIPLIERS;

  // WeatherSystem(plan 08)에서 날씨 변경 알림 수신
  onWeatherChanged(weather: WeatherType, fadeDuration: number): void

  // 매 프레임
  update(delta: number): void

  // 현재 패널티 조회 (실내 여부 자동 적용)
  getMultipliers(isIndoor: boolean): WeatherMultipliers

  // 현재 날씨 조회
  getCurrentWeather(): WeatherType
}
```

---

## 8. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/WeatherEffectSystem.ts` | 신규: 날씨 패널티 배율 관리 |
| `src/systems/CharacterStats.ts` | `effectiveMoveSpeed`에 날씨 배율 연동 |
| `src/systems/HungerSystem.ts` | 허기 감소에 날씨 배율 연동 |
| `src/systems/SleepSystem.ts` | 피로 감소에 날씨 배율 연동 |
| `src/systems/LightSystem.ts` | 광원 반경에 날씨 배율 연동 |
| `src/systems/EquipmentSystem.ts` | 횃불 수명 소진에 날씨 배율 연동 |
| `src/systems/WeatherSystem.ts` | 계절별 낚시 보정, 침략 빈도 배율 제공 |
| `src/world/MapGenerator.ts` | 계절별 나무 밀도 배율 반영 |
| `src/ui/HUD.ts` | 날씨 아이콘 + 호버 툴팁 추가 |

---

## 9. 확정 규칙

- 모든 날씨 패널티는 `isIndoor === true` 이면 **완전 무효** (plan 31 실내 판정 활용)
- 패널티 배율은 모두 **곱셈** 적용 (피로 기본 감소 × 날씨 배율 × CON 보정)
- 계절·날씨는 Firebase seed 기반 결정 → 멀티플레이어 전원 동일
- 폭풍·블리자드 도중 맵 밖에 있으면 패널티 없음 (해당 맵 날씨 기준)
- 날씨 툴팁은 패널티가 있는 날씨에만 표시 (맑음은 툴팁 없음)
- 겨울 방한복 등 장비 아이템은 이번 단계 미포함 — plan 34 밸런스 수치표에 추후 추가
