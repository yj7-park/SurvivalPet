# 설계 25 — HP 회복 & 전투 피격 피드백

> **전제 조건**: 01~24 단계 완료 상태.
> CombatSystem, CharacterStats, HungerSystem, SleepSystem, HUD가 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. **HP 자연 회복** — 조건부 시간 경과 회복
2. **HP 회복 수단 확정** — 음식(스튜), 수면, 자연 회복
3. **피격 피드백** — 데미지 숫자 팝업, 화면 플래시, 히트스톱
4. **사망 처리** — HP 0 도달 시 처리 흐름
5. **HP 바 표시** 완성 — 적·플레이어 HP 바 통일

---

## 2. HP 자연 회복

### 2-1. 회복 조건

HP 자연 회복은 **전투 외** 상태에서만 발동:

```typescript
const OUT_OF_COMBAT_DELAY = 10_000; // 마지막 피격 후 10초 경과
const canRegenerate = timeSinceLastHit >= OUT_OF_COMBAT_DELAY;
```

### 2-2. 회복량

```typescript
// CON 기반 자연 회복 (게임 내 1일 기준)
const regenPerDay = stats.con * 2;
// CON 2 → 4/일  |  CON 5 → 10/일  |  CON 10 → 20/일

// 실시간 회복 (delta: ms), 전투 외 조건 충족 시
hp += (regenPerDay / 1_800_000) * delta;
hp = Math.min(hp, effectiveMaxHp);
```

### 2-3. 회복 불가 조건

| 조건 | HP 회복 차단 |
|------|-----------|
| 전투 중 (최근 10초 내 피격) | ✅ 차단 |
| 허기 20 이하 | ✅ 차단 |
| 식중독 상태 | ✅ 차단 |
| 광란 모드 | ✅ 차단 |

---

## 3. HP 회복 수단 정리

### 3-1. 전체 회복 수단

| 수단 | 회복량 | 조건 |
|------|--------|------|
| 자연 회복 | CON×2 / 게임일 | 전투 외, 허기 20 초과 |
| 구운 생선 섭취 | 0 | 허기만 회복 |
| 구운 고기 섭취 | 0 | 허기만 회복 |
| 생선 스튜 섭취 | +30 즉시 | 레시피 해금 필요 |
| 고기 스튜 섭취 | +20 즉시 | 레시피 해금 필요 |
| 수면 완료 | +CON×3 즉시 | 침대 기상 시 |
| 식탁 근처 스튜 섭취 | +30×1.3 = +39 | 식탁 보너스 |

### 3-2. 수면 기상 HP 회복

```typescript
// 기상 시 1회 즉시 회복
function onWakeUp(stats: CharacterStats): void {
  const healAmount = stats.con * 3;
  // CON 2 → +6  |  CON 5 → +15  |  CON 10 → +30
  stats.hp = Math.min(stats.hp + healAmount, stats.effectiveMaxHp);
}
```

---

## 4. 피격 피드백

### 4-1. 데미지 숫자 팝업

피격 시 캐릭터 위치 +y 방향으로 숫자 팝업:

```typescript
interface DamagePopup {
  value: number;
  x: number; y: number;
  color: string;
  scale: number;
  lifetime: number;   // ms, 총 800ms
}

// 팝업 애니메이션:
// 0~200ms: 위로 20px 이동 + 스케일 1.0→1.3
// 200~600ms: 스케일 1.3 유지, 계속 위 이동
// 600~800ms: 알파 1.0→0.0 페이드아웃
```

색상 규칙:
| 피격 대상 | 색상 |
|---------|------|
| 플레이어 피격 | `#ff4444` (빨강) |
| 적 피격 | `#ffffff` (흰색) |
| 막기(Block) 성공 | `#00aaff` "막기!" 텍스트 |
| 치명타 (추후) | `#ffd700` (금색) + 1.5× 스케일 |

### 4-2. 화면 피격 플래시

플레이어가 피격될 때:
```typescript
// 화면 가장자리 빨간 비네팅 (0.3초)
// Phaser Camera flash 대신 직접 Graphics 오버레이 사용
function triggerHitFlash(intensity: number): void {
  // intensity: 0.0~1.0 (데미지/최대HP 비율)
  const alpha = Math.min(0.6, 0.15 + intensity * 0.45);
  hitVignette.setAlpha(alpha);    // 빨간 테두리 Graphics
  // 0.3초 페이드아웃
  scene.tweens.add({ targets: hitVignette, alpha: 0, duration: 300 });
}
```

### 4-3. 히트스톱 (Hit Stop)

타격감을 위한 프레임 정지:

```typescript
function triggerHitStop(durationMs: number): void {
  // 게임 루프 delta를 일시적으로 0으로 강제
  scene.physics.pause();
  scene.time.delayedCall(durationMs, () => scene.physics.resume());
}

// 피격 히트스톱: 60ms
// 적 처치 히트스톱: 120ms
// 강타(10 이상 데미지): 80ms
```

### 4-4. 캐릭터 피격 틴트

피격 시 스프라이트 0.15초간 흰색 플래시:
```typescript
sprite.setTintFill(0xffffff);
scene.time.delayedCall(150, () => sprite.clearTint());
```

적 피격 시 동일하게 적용.

---

## 5. 사망 처리

### 5-1. 사망 조건

```
HP ≤ 0
  → CombatSystem.onDeath() 호출
```

### 5-2. 사망 흐름

```
HP = 0
  → 히트스톱 120ms
  → 캐릭터 스프라이트 회색 틴트 + 0.5초 페이드아웃
  → 사망 연출:
      화면 전체 검정 페이드 (1초)
      화면 중앙: "💀 사망했습니다"
                 생존 시간: X일 X시간
                 [타이틀로 돌아가기]
```

### 5-3. 사망 시 처리 규칙

| 항목 | 처리 |
|------|------|
| 인벤토리 | **전부 지면 드랍** (현재 위치) |
| 저장 슬롯 | 해당 슬롯 **삭제** |
| 멀티플레이 | Firebase에서 플레이어 제거 |
| 재시작 | 타이틀 → 새 게임 또는 다른 슬롯 불러오기 |

인벤토리 드랍:
```typescript
function dropAllOnDeath(player: Player): void {
  for (const slot of player.inventory.slots) {
    if (slot) {
      groundItemSystem.spawn(player.x, player.y, slot.itemId, slot.amount);
    }
  }
  player.inventory.clear();
}
```

### 5-4. 사망 화면 UI

```
┌──────────────────────────────────────────┐
│                                          │
│              💀 사망했습니다              │
│                                          │
│         생존: 3일 14시간 27분            │
│         처치한 적: 12마리                │
│         건설한 구조물: 8개               │
│                                          │
│         [타이틀로 돌아가기]              │
│                                          │
└──────────────────────────────────────────┘
```

통계는 `GameStats` 객체로 플레이 중 누적:
```typescript
interface GameStats {
  enemiesKilled: number;
  buildingsBuilt: number;
  itemsCrafted: number;
  distanceTraveled: number;   // 타일 단위
}
```

---

## 6. HP 바 표시 통일

### 6-1. 플레이어 HP 바 (HUD)

기존 HUD 게이지와 동일:
```
❤ HP  [████████░░]  80 / 100   (effectiveMaxHp 기준)
```

허기 debuff로 최대 HP 감소 시:
```
❤ HP  [████████░░]  80 / 90 (↓10)   (감소량 표시)
```

### 6-2. 적 HP 바 (인게임)

적 스프라이트 위 체력바:
```
[████░░]   (폭 28px, 높이 4px, 스프라이트 상단 +4px)
색상: 초록(>50%) → 노랑(30~50%) → 빨강(<30%)
HP 100% 시 바 숨김, 피격 시 표시 후 3초 뒤 숨김
```

### 6-3. 원격 플레이어 HP 바 (멀티플레이)

이름표 아래 얇은 HP 바:
```
[생존자]
[████░░░]   (폭 32px, 높이 3px)
```

---

## 7. HPSystem 클래스 통합

기존 `CharacterStats`의 HP 관련 로직을 `HPSystem`으로 분리:

```typescript
export class HPSystem {
  private hp: number;
  private timeSinceLastHit: number = 0;

  // 매 프레임
  update(delta: number, stats: CharacterStats, hungerSystem: HungerSystem): void

  // 피해 적용 (CombatSystem에서 호출)
  takeDamage(amount: number): TakeDamageResult

  // 회복
  heal(amount: number): number   // 실제 회복량 반환

  // 기상 회복
  onWakeUp(con: number): void

  // 상태 조회
  getHP(): number
  isDead(): boolean
  canRegenerate(): boolean

  // 저장용
  serialize(): { hp: number }
}

interface TakeDamageResult {
  finalDamage: number;
  blocked: boolean;
  dead: boolean;
}
```

---

## 8. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/HPSystem.ts` | 신규: HP 자연 회복, 피해, 사망 처리 |
| `src/ui/DamagePopup.ts` | 신규: 데미지 숫자 팝업 렌더링 |
| `src/ui/HitVignette.ts` | 신규: 피격 화면 빨간 비네팅 |
| `src/ui/DeathScreen.ts` | 신규: 사망 화면 + 통계 표시 |
| `src/systems/CombatSystem.ts` | HPSystem 연동, 히트스톱 트리거 |
| `src/systems/SleepSystem.ts` | 기상 시 `HPSystem.onWakeUp()` 호출 |
| `src/ui/HUD.ts` | effectiveMaxHp 기준 HP 바, debuff 감소량 표시 |
| `src/scenes/GameScene.ts` | HPSystem 인스턴스, GameStats 누적 |
| `src/systems/SaveSystem.ts` | `hp`, `gameStats` 직렬화 추가 |

---

## 9. 확정 규칙

- 사망 시 저장 슬롯 삭제 — **부활·패널티 없는 퍼마데스** 방식
- 멀티플레이에서 다른 플레이어가 광란으로 내 HP를 0으로 만들어도 동일하게 사망 처리
- 히트스톱 중 입력은 무시하지 않고 큐에 보존 (plan 10 CommandQueue 활용)
- 자연 회복 중 HUD에 작은 초록 `+` 아이콘 표시 (0.5초 주기 깜빡임)
- effectiveMaxHp = `stats.maxHp - hungerSystem.getMaxHpDebuff()` — CharacterStats에서 계산
- 데미지 팝업은 최대 화면에 6개 동시 표시, 초과 시 가장 오래된 것 제거
