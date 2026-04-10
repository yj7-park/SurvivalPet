# 설계 18 — 행복 수치 & 광란 모드

> **전제 조건**: 01~17 단계 완료 상태.
> CharacterStats, CombatSystem, BuildSystem, 상호작용 시스템이 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **행복 수치(Action)** — 세 번째 생존 지표, 무위 상태에서 감소
2. **행복 수치 회복** — 다양한 활동 수행 시 회복
3. **반복 패널티** — 같은 활동 반복 시 회복량 점감
4. **광란 모드(Frenzy)** — 행복 수치 0 도달 시 30초간 조작 불가·자동 공격
5. **HUD 표시** — 행복 수치 게이지 + 광란 카운트다운

---

## 2. 행복 수치 설계

### 2-1. 기본 수치

| 항목 | 값 |
|------|-----|
| 범위 | 0 ~ 100 |
| 초기값 | 100 |
| 자연 감소 (게임 내 1일 기준) | −20 |
| 현실 시간 감소율 | −20 / 30분 = **약 −0.011/초** |

```typescript
// 실시간 감소 (delta: ms)
action -= (20 / 1_800_000) * delta;
```

### 2-2. 행복 수치 회복량

| 행복 | 기본 회복량 |
|------|-----------|
| 나무 벌목 1회 완료 | +12 |
| 암반 채굴 1회 완료 | +12 |
| 낚시 1회 완료 (성공/실패 무관) | +10 |
| 건설 완료 (구조물 1개) | +15 |
| 구조물 철거 완료 | +8 |
| 적 처치 | +18 |
| 요리 완료 | +8 |
| 제작 완료 | +8 |
| 연구 완료 | +10 |
| 음식 섭취 | +5 |
| 수면 완료 (기상) | +30 |

### 2-3. 반복 패널티 (점감)

같은 행복을 연속 반복하면 회복량 점진적 감소:

```typescript
// 동일 actionType을 연속으로 수행한 횟수 추적
interface ActionCombo {
  type: string;
  count: number;
  lastAt: number;   // 마지막 수행 시각 (Date.now())
}

// 회복량 계산
function getActionRecovery(base: number, combo: ActionCombo): number {
  // 다른 행복을 사이에 끼우면 콤보 리셋 (30초 이상 경과도 리셋)
  const mult = Math.max(0.3, 1.0 - (combo.count - 1) * 0.15);
  return Math.round(base * mult);
}
// count 1 → 100% / count 2 → 85% / count 3 → 70% / count 5 → 40% / count 6+ → 30%
```

콤보 리셋 조건:
- 다른 종류의 행복 1회 수행
- 마지막 동일 행복 이후 **30초** 이상 경과

---

## 3. 광란 모드 (Frenzy Mode)

### 3-1. 진입 조건

```
행복 수치 ≤ 0
  → FrenzyMode 시작
    → 지속 시간: 30초 (현실)
    → 플레이어 조작 완전 차단
    → 자동 공격 루프 시작
```

### 3-2. 광란 중 자동 공격

```typescript
// 광란 모드 자동 공격 로직 (1초마다 실행)
function frenzyTick(player: Player, scene: GameScene): void {
  // 1. 범위 내 타겟 탐색 (우선순위: 적 > 다른 플레이어 > 건설물)
  const targets = scene.getEntitiesInRange(player.x, player.y, FRENZY_RANGE);
  targets.sort(byPriority);                         // 적 우선

  if (targets.length === 0) {
    // 타겟 없으면 랜덤 방향으로 무작위 이동
    player.moveRandom();
    return;
  }

  const target = targets[0];
  // 2. 타겟을 향해 이동 (자동 pathfinding)
  player.moveTo(target.x, target.y);
  // 3. 사정거리 내이면 공격
  if (distanceTo(player, target) <= ATTACK_RANGE) {
    player.attack(target);
  }
}

const FRENZY_RANGE = 128;   // px, 탐색 범위
```

자동 공격 스펙:
- 공격 간격: 1.5초
- 데미지: 장착 무기 기준 (장비 해제 안 함)
- 건설물 피격: 내구도 −15/회

### 3-3. 광란 모드 종료

```
30초 경과
  → 행복 수치 = 25 로 강제 회복 (즉시)
  → 플레이어 조작 재개
  → "광란 상태가 해제되었습니다" 알림 2초
  → 쿨다운 5초 (광란 직후 즉시 재진입 방지)
```

재진입 방지:
- 광란 종료 후 5초 쿨다운 동안 행복 수치가 0이 되어도 광란 미진입
- 쿨다운 중 행복 수치는 계속 자연 감소하나 바닥은 1로 고정

### 3-4. 광란 모드 시각 연출

```
진입 시:
  - 화면 테두리 빨간 맥박 효과 (펄스 0.5초 주기, 투명도 0~0.4)
  - 화면 중앙 대형 텍스트:
      "⚡ 광란 상태!"  (빨간색, 24px bold)
      → 1초 표시 후 사라짐
  - 배경음악 피치 +20% (추후 사운드 설계 시 연동)

지속 중:
  - 캐릭터 스프라이트 위에 빨간 오라 효과 (반투명 원, radius 16px, 펄스)
  - HUD 행복 수치 게이지 빨간색으로 변경 + 깜빡임

종료 시:
  - 테두리 효과 즉시 제거
  - 캐릭터 스프라이트 0.5초간 흰색 플래시 (회복 연출)
```

---

## 4. 행복 수치 경고 단계

| 수치 범위 | 상태 | HUD 색상 | 알림 |
|---------|------|---------|------|
| 100~41 | 정상 | 초록 | 없음 |
| 40~21 | 주의 | 노랑 | 없음 |
| 20~11 | 경고 | 주황 | "⚠ 행복 수치가 낮습니다" (1회) |
| 10~1 | 위험 | 빨강 | "⚠ 곧 광란 상태에 돌입합니다!" (1회) + 게이지 깜빡임 |
| 0 | 광란 진입 | — | 광란 연출 시작 |

경고 알림은 수치가 해당 구간에 처음 진입할 때 **1회만** 표시 (수치 회복 후 재진입 시 재알림).

---

## 5. HUD 게이지 설계

### 5-1. 3개 생존 지표 게이지

기존 허기·피로 게이지와 동일한 스타일로 행복 게이지 추가:

```
┌──────────────────────────────────────┐
│  ❤ HP    [████████░░] 80/100         │
│  🍖 허기  [█████░░░░░] 52/100         │
│  😴 피로  [███░░░░░░░] 31/100         │
│  ⚡ 행복  [██░░░░░░░░] 18/100  ⚠     │  ← 경고 구간
└──────────────────────────────────────┘
```

게이지 위치: 화면 좌하단 (기존 3개 게이지 아래 추가)

### 5-2. 광란 카운트다운 오버레이

광란 모드 진입 시 화면 우상단:
```
⚡ 광란  [00:23]
```
- 폰트: 16px monospace bold, 빨간색
- 배경: 반투명 검정 박스

---

## 6. 행복 수치 및 광란 관련 저장

plan 17 `CharacterSaveData`에 아래 필드 추가:

```typescript
// CharacterSaveData 확장
action: number;                  // 현재 행복 수치
actionCombo: {                   // 반복 패널티 상태
  type: string;
  count: number;
  lastAt: number;
} | null;
```

광란 진행 중 저장:
- 광란 상태는 저장하지 않음 (불러오기 시 행복 수치 = 25로 초기화)

---

## 7. ActionSystem 클래스

```typescript
export class ActionSystem {
  private value: number = 100;
  private combo: ActionCombo | null = null;
  private frenzyActive: boolean = false;
  private frenzyTimeLeft: number = 0;      // ms
  private frenzyCooldown: number = 0;      // ms
  private warnedAt: Set<string> = new Set(); // 경고 발생 구간 추적

  // 매 프레임 호출
  update(delta: number, player: Player, scene: GameScene): void

  // 행복 완료 시 호출
  onActionDone(type: ActionType): void

  // 수치 조회
  getValue(): number
  isFrenzy(): boolean
  getFrenzyTimeLeft(): number   // ms

  // 저장용
  serialize(): { action: number; actionCombo: ActionCombo | null }
  deserialize(data: ReturnType<this['serialize']>): void
}

export type ActionType =
  | 'woodcut' | 'mine' | 'fish'
  | 'build' | 'demolish'
  | 'kill_enemy'
  | 'cook' | 'craft' | 'research'
  | 'eat' | 'sleep';
```

---

## 8. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/ActionSystem.ts` | 신규: 행복 수치·광란 전체 관리 |
| `src/scenes/GameScene.ts` | ActionSystem 인스턴스, 매 프레임 update 호출 |
| `src/systems/CombatSystem.ts` | 적 처치 시 `ActionSystem.onActionDone('kill_enemy')` |
| `src/systems/BuildSystem.ts` | 건설·철거 완료 시 ActionSystem 연동 |
| `src/ui/HUD.ts` | 행복 수치 게이지 추가, 광란 카운트다운 오버레이 |
| `src/systems/SaveSystem.ts` | `action`, `actionCombo` 직렬화 추가 |
| `src/world/SpriteGenerator.ts` | 광란 오라 이펙트 텍스처 추가 |

---

## 9. 확정 규칙

- 광란 중 플레이어 이동·상호작용·장비 변경 입력 완전 차단 (UI 클릭 포함)
- 광란 중 다른 플레이어(멀티플레이) 공격 가능 — PvP 피해는 일반 전투와 동일
- 광란 중 건설물 자동 공격은 **아군 건설물도 포함** (무차별)
- 광란 모드는 수면으로 해제 불가 (조작 불가 상태이므로 침대 클릭 불가)
- 행복 수치는 멀티플레이어 모드에서 로컬 계산 (서버 동기화 안 함 — 클라이언트 전용)
- 수치 상한은 100이며 이미 100인 상태에서 회복 시 조용히 버림 (오버플로 없음)
