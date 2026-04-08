# 설계 04 — 전투 시스템 · 중립 동물 (사슴 / 호랑이)

> **전제 조건**: 01~03 단계 완료 상태.
> 맵 렌더링, 캐릭터 이동, 기본 상호작용(프로그레스 바), 스프라이트 시스템이 구현되어 있다고 가정한다.
> 건설 시스템(02~03)은 이번 단계와 독립적이므로 병행 구현 가능하다.

---

## 1. 이번 단계 목표

1. 중립 동물 AI 시스템 구현 (사슴, 호랑이)
2. 동물 스프라이트 생성 (`sprite-generator.html` 추가)
3. 플레이어 ↔ 동물 전투 기초 구현
4. 동물 드롭 아이템 처리

---

## 2. 중립 동물 개요

동물은 **중립(Neutral)** 상태로 맵에 존재한다.
- 플레이어가 공격하기 전까지는 적대적이지 않음
- 공격 받으면 동물 종류에 따라 다르게 반응

### 맵당 스폰 수 (기준)

| 동물 | 맵당 스폰 수 | 스폰 조건 |
|------|-------------|-----------|
| 사슴 | 3~6마리 | 흙 타일, 나무 인접 선호 |
| 호랑이 | 1~2마리 | 흙 타일, 암반 인접 선호 |

- 스폰 위치는 Seed 기반으로 고정 생성 (같은 Seed = 같은 위치)
- 동물이 죽으면 해당 게임 세션 내에서는 재스폰 없음

---

## 3. AI 상태 머신

모든 동물은 아래 상태를 공유하며, 동물별로 전이 조건이 다르다.

```
        ┌─────────────────────────────────────┐
        ▼                                     │
     [IDLE]  ──시간 경과──▶  [WANDER]         │
        ▲                       │             │
        │      목적지 도달       │             │
        └───────────────────────┘             │
                                              │
공격 받음 (사슴)                              │공격 받음 (호랑이)
        │                                     │
        ▼                                     ▼
     [FLEE]                             [AGGRESSIVE]
   일정 거리 후                         플레이어 추격 + 공격
   IDLE로 복귀                          사거리 벗어나면 WANDER 복귀
```

### 상태별 정의

| 상태 | 설명 |
|------|------|
| `IDLE` | 제자리에 정지. 2~5초 유지 후 WANDER로 전이 |
| `WANDER` | 홈 포인트 반경 내 랜덤 목적지로 이동. 도착 시 IDLE로 전이 |
| `FLEE` | 공격자 반대 방향으로 빠르게 이동. 목표 거리 도달 시 IDLE 복귀 |
| `AGGRESSIVE` | 플레이어를 추격하며 근접 시 공격. 추격 포기 거리 초과 시 WANDER 복귀 |

---

## 4. 사슴 (Deer)

### 기본 스탯

| 항목 | 값 |
|------|----|
| HP | 40 |
| 이동 속도 (WANDER) | 60 px/s |
| 이동 속도 (FLEE) | 140 px/s |
| 공격력 | 0 (공격 안 함) |
| 홈 반경 | 5타일 |
| 경계 반경 | 없음 (플레이어 감지 안 함) |

### 행동 패턴

- **IDLE**: 2~4초 정지 (귀를 세우는 등 idle 애니메이션)
- **WANDER**: 홈 반경 5타일 내 랜덤 이동, 도착 시 IDLE
- **FLEE 트리거**: 플레이어에게 공격 받으면 즉시 FLEE
  - 공격자 기준 반대 방향으로 **8~12타일** 이동
  - 이동 완료 후 IDLE 복귀 (도망친 위치가 새 홈 포인트가 됨)
  - FLEE 중 추가 공격 받으면 FLEE 거리 리셋 후 재도망

### 드롭 아이템

| 아이템 | 수량 | 확률 |
|--------|------|------|
| 고기 (raw_meat) | 2~4개 | 100% |
| 가죽 (hide) | 1개 | 70% |

---

## 5. 호랑이 (Tiger)

### 기본 스탯

| 항목 | 값 |
|------|----|
| HP | 120 |
| 이동 속도 (WANDER) | 70 px/s |
| 이동 속도 (AGGRESSIVE) | 150 px/s |
| 공격력 | 15 |
| 공격 속도 | 1.5초 간격 |
| 공격 사거리 | 1.5타일 |
| 홈 반경 | 8타일 |
| 경계 반경 | 6타일 (플레이어가 이 안에 들어오면 선제 공격 가능 — 추후 옵션) |
| 추격 포기 거리 | 홈 포인트에서 15타일 초과 시 포기 |

### 행동 패턴

- **IDLE**: 2~5초 정지
- **WANDER**: 홈 반경 8타일 내 랜덤 이동
- **AGGRESSIVE 트리거**: 플레이어에게 공격 받으면 즉시 AGGRESSIVE
  - 플레이어를 향해 추격
  - 공격 사거리(1.5타일) 내 도달 시 공격 실행
  - 공격은 1.5초 간격으로 반복
  - 플레이어가 홈에서 15타일 이상 멀어지면 추격 포기 → WANDER 복귀

### 공격 피해 계산

```
실제 피해 = 호랑이 공격력 - (플레이어 CON * 0.5)
           = 15 - (CON * 0.5)
최소 피해 = 1

// CON 5 → 15 - 2.5 = 12.5 ≈ 12 피해
// CON 10 → 15 - 5 = 10 피해
// CON 2 → 15 - 1 = 14 피해
```

### 드롭 아이템

| 아이템 | 수량 | 확률 |
|--------|------|------|
| 고기 (raw_meat) | 3~5개 | 100% |
| 가죽 (hide) | 2개 | 100% |
| 호랑이 이빨 (tiger_fang) | 1개 | 40% |

---

## 6. 플레이어 공격 시스템

### 공격 방법
- 동물 위에 마우스 호버 → 툴팁에 **"⚔ 공격하기"** 표시
- 클릭 시:
  - 상호작용 거리 내: 즉시 공격 1회 실행
  - 거리 초과: 자동 이동 후 사거리 도달 시 공격 실행

### 플레이어 공격력 계산

```
player_atk = 10 + STR * 2

// STR 2  → 14 피해
// STR 5  → 20 피해
// STR 10 → 30 피해
```

### 공격 쿨다운

```
attack_cooldown = 1.5 - (AGI - 5) * 0.08  (초, 최소 0.8초)

// AGI 2  → 1.74초
// AGI 5  → 1.5초
// AGI 10 → 1.1초
```

### 공격 상호작용 거리
- 기본 상호작용 거리와 동일: **2타일**

---

## 7. 체력바 표시

동물 머리 위에 체력바 표시:
- 피격 시 나타남, 3초 후 미피격 시 사라짐
- 80% 이상: 초록 / 40~80%: 노랑 / 40% 미만: 빨강
- 형태: 동물 너비에 맞춘 가로 바 (배경 회색, 전경 컬러)

플레이어 체력바:
- 화면 좌상단 HUD에 항상 표시

---

## 8. 동물 사망 처리

1. HP 0 도달 → 사망 연출 (0.5초 페이드 아웃)
2. 드롭 아이템 해당 타일에 생성
3. 동물 객체 제거 (해당 세션에서 재스폰 없음)
4. **행동 수치(행동)** 소폭 회복: 사냥 성공 시 +10

---

## 9. 신규 아이템 목록

| 아이템 키 | 이름 | 획득 방법 | 용도 |
|-----------|------|-----------|------|
| `item_raw_meat` | 고기 | 사슴/호랑이 사냥 | 조리대에서 요리 |
| `item_hide` | 가죽 | 사슴/호랑이 사냥 | 추후 장비 제작 |
| `item_tiger_fang` | 호랑이 이빨 | 호랑이 사냥 (40%) | 추후 장비/장식 |

### 조리 레시피 추가

| 요리 결과 | 재료 | 허기 회복량 |
|-----------|------|-------------|
| 구운 고기 (cooked_meat) | 고기 ×1 | +45 |

---

## 10. 스프라이트 추가 목록

`sprite-generator.html`에 아래 함수 추가:

| Phaser 키 | 함수 | 크기 | 설명 |
|-----------|------|------|------|
| `animal_deer_idle` | `drawDeer('idle')` | 32×32 | 사슴 정지 |
| `animal_deer_walk` | `drawDeer('walk')` | 32×32 | 사슴 이동 |
| `animal_tiger_idle` | `drawTiger('idle')` | 32×32 | 호랑이 정지 |
| `animal_tiger_walk` | `drawTiger('walk')` | 32×32 | 호랑이 이동 |
| `animal_tiger_attack` | `drawTiger('attack')` | 32×32 | 호랑이 공격 |
| `item_raw_meat` | `drawRawMeat()` | 32×32 | 고기 아이콘 |
| `item_hide` | `drawHide()` | 32×32 | 가죽 아이콘 |
| `item_tiger_fang` | `drawTigerFang()` | 32×32 | 호랑이 이빨 아이콘 |
| `item_cooked_meat` | `drawCookedMeat()` | 32×32 | 구운 고기 아이콘 |

---

## 11. AI 구현 구조 (TypeScript)

```typescript
// src/entities/Animal.ts

type AnimalState = 'IDLE' | 'WANDER' | 'FLEE' | 'AGGRESSIVE';
type AnimalType = 'deer' | 'tiger';

interface AnimalConfig {
  type: AnimalType;
  hp: number;
  maxHp: number;
  speed: { wander: number; action: number };  // FLEE or AGGRESSIVE
  attackDamage?: number;
  attackCooldown?: number;
  attackRange?: number;
  homeRadius: number;
  giveUpDistance?: number;
  drops: DropConfig[];
}

class Animal {
  state: AnimalState = 'IDLE';
  homePoint: { x: number; y: number };
  target: { x: number; y: number } | null = null;
  stateTimer: number = 0;

  update(delta: number, player: Player) {
    switch (this.state) {
      case 'IDLE':    this.updateIdle(delta); break;
      case 'WANDER':  this.updateWander(delta); break;
      case 'FLEE':    this.updateFlee(delta); break;
      case 'AGGRESSIVE': this.updateAggressive(delta, player); break;
    }
  }

  onHit(attacker: Player) {
    // 사슴: FLEE, 호랑이: AGGRESSIVE
    this.state = this.config.type === 'deer' ? 'FLEE' : 'AGGRESSIVE';
    this.setFleeOrChaseTarget(attacker);
  }
}
```

---

## 12. Firebase 동기화 범위

동물 상태는 **Firebase에 동기화하지 않는다.**
- 동물 위치/상태는 각 클라이언트가 독립 계산
- 단, 동물 사망(HP=0) 이벤트는 Firebase에 기록하여 모든 클라이언트가 공유
  ```
  /rooms/{seed}/maps/{mapX}_{mapY}/animals/{animalId}/dead: true
  ```
- 클라이언트 접속 시 해당 맵의 dead 목록을 읽어 사망한 동물은 스폰 제외
