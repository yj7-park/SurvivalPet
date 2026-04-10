# Plan 64 — 캐릭터 레벨 & 능력치 배분 시스템

## 개요

플레이어 행동에서 경험치를 획득하고 레벨업 시 능력치 포인트를 배분하는  
캐릭터 성장 시스템을 설계한다.  
plan 14(숙련도 XP)와 별개로 **전체 캐릭터 레벨**(1~50)을 도입하고,  
5가지 주요 능력치(STR·AGI·CON·INT·LUK)를 플레이어가 직접 선택 배분한다.

---

## 1. 능력치 (Stats) 정의

```typescript
export interface CharacterStats {
  // 배분 포인트로 올리는 기본 능력치
  STR: number;   // 힘     — 근접 공격력, 벌목·채광 속도
  AGI: number;   // 민첩   — 이동속도, 회피율, 공격속도
  CON: number;   // 체력   — 최대 HP, 피로 회복속도
  INT: number;   // 지력   — 요리·제작 효율, 연구 시간 단축
  LUK: number;   // 행운   — 드롭률, 크리티컬 확률, 낚시 성공률

  // 파생 스탯 (기본 능력치로 계산)
  maxHp:        number;   // 80 + CON × 10
  moveSpeed:    number;   // 120 + AGI × 3  (px/s)
  attackPower:  number;   // 5  + STR × 2
  critChance:   number;   // 0.03 + LUK × 0.005   (0~0.5 cap)
  craftSpeed:   number;   // 1.0 + INT × 0.04      (배율)
  dropBonus:    number;   // 0   + LUK × 0.01      (추가 드롭 확률)
}

export function calcDerivedStats(base: CharacterStats): CharacterStats {
  return {
    ...base,
    maxHp:       80 + base.CON * 10,
    moveSpeed:   120 + base.AGI * 3,
    attackPower: 5   + base.STR * 2,
    critChance:  Math.min(0.5, 0.03 + base.LUK * 0.005),
    craftSpeed:  1.0 + base.INT * 0.04,
    dropBonus:   base.LUK * 0.01,
  };
}
```

---

## 2. 레벨 시스템

### 2-1. 레벨 범위 & XP 곡선

```typescript
const MAX_LEVEL = 50;

// 누적 XP 필요량 (레벨업 공식)
// 레벨 N 달성에 필요한 총 XP
function requiredXpForLevel(level: number): number {
  // 완만한 3차 곡선 — 초반 빠름, 중반~후반 점진적 증가
  return Math.round(100 * Math.pow(level - 1, 1.6));
}

// 예시
// Lv2: 100XP, Lv5: 480XP, Lv10: 1585XP,
// Lv20: 5278XP, Lv30: 10867XP, Lv50: 28032XP
```

### 2-2. XP 획득 원천

plan 14(숙련도 XP)와 별도로 **캐릭터 레벨 XP** 별도 집계:

| 행동 | XP |
|------|----|
| 일반 적 처치 | 20 |
| 보스 처치 | 150 |
| 나무 채취 | 3 |
| 돌 채취 | 3 |
| 물고기 낚기 | 5 |
| 구조물 완공 | 10 |
| 요리 완료 | 8 |
| 제작 완료 | 6 |
| 수면 1회 | 5 |
| 첫 탐험 (새 맵) | 15 |
| 희귀 아이템 획득 | 30 |

---

## 3. 레벨업 처리

### 3-1. 레벨업 시 스탯 포인트

```typescript
interface LevelUpReward {
  statPoints: number;     // 레벨당 2포인트 (5의 배수 레벨: 추가 1)
  hpRestore:  boolean;    // 레벨업 시 HP 전체 회복
}

function getLevelUpReward(newLevel: number): LevelUpReward {
  return {
    statPoints: newLevel % 5 === 0 ? 3 : 2,
    hpRestore:  true,
  };
}
```

### 3-2. 레벨업 시각 연출 (plan 49·56 연계)

```typescript
function onLevelUp(newLevel: number, player: PlayerEntity): void {
  const reward = getLevelUpReward(newLevel);

  // 1. 레벨업 이펙트 (plan 49 playLevelUpEffect 재사용 — 흰색)
  playLevelUpEffect(player.worldX, player.worldY, 0xffffff);

  // 2. HP 전체 회복
  player.hp = player.stats.maxHp;

  // 3. 미배분 포인트 HUD 뱃지 업데이트
  addUnspentPoints(reward.statPoints);
  showStatPointBadge(reward.statPoints);

  // 4. NotifySystem
  NotifySystem.show('info',
    `레벨 ${newLevel} 달성! 스탯 포인트 +${reward.statPoints}`
  );

  // 5. 5레벨 단위 마일스톤 특별 연출
  if (newLevel % 5 === 0) playMilestoneLevelEffect(newLevel);
}
```

### 3-3. 마일스톤 레벨 연출

```typescript
// 10, 20, 30, 40, 50레벨 특별 화면 이펙트
function playMilestoneLevelEffect(level: number): void {
  const title = level === 50 ? '🏆 최강자의 경지!' : `⭐ Lv.${level} 마일스톤!`;
  // plan 44 season card 스타일로 화면 중앙 3초 표시
  showSeasonStyleCard(title, `강해졌습니다!`, getSeasonCardColor(level));
}
```

---

## 4. 능력치 배분 UI (`StatAllocationPanel`)

### 4-1. 패널 레이아웃

```
┌────────────── 능력치 배분 ──────────────────────┐
│  Lv.12   경험치 ████████░░  1250 / 1585 XP      │
│                                                   │
│  미배분 포인트: ③                                 │
│                                                   │
│  ❤  체력  (CON)  ██████████  10  [−][+]          │
│  ⚔  힘    (STR)   ████████░░   8  [−][+]         │
│  💨 민첩  (AGI)   ██████░░░░   6  [−][+]         │
│  🧠 지력  (INT)   ████░░░░░░   4  [−][+]         │
│  🍀 행운  (LUK)   ██░░░░░░░░   2  [−][+]         │
│                                                   │
│  파생 능력치:                                     │
│  HP 180  이속 138  공격 21  크리 5.3%             │
│                                                   │
│              [초기화 (골드 500)]    [닫기]         │
└───────────────────────────────────────────────────┘
```

```typescript
class StatAllocationPanel {
  private tempPoints: Partial<Record<StatKey, number>> = {};
  private unspent = 0;

  open(currentStats: CharacterStats, unspentPoints: number): void {
    this.tempPoints = { ...currentStats };
    this.unspent = unspentPoints;
    // 왼쪽 슬라이드 인 (plan 56 ProficiencyPanel 방식)
    this.container.setVisible(true).setX(-360);
    scene.tweens.add({
      targets: this.container, x: 20, duration: 250, ease: 'Quad.easeOut'
    });
  }

  incrementStat(key: StatKey): void {
    if (this.unspent <= 0) {
      // 포인트 없음 알림
      shakeElement(this.unspentBadge);
      return;
    }
    this.tempPoints[key] = (this.tempPoints[key] ?? 0) + 1;
    this.unspent--;
    this.refresh();
  }

  decrementStat(key: StatKey): void {
    const cur = this.tempPoints[key] ?? 0;
    const base = getBaseStatValue(key);   // 배분 전 기본값
    if (cur <= base) return;              // 기본값 이하 감소 불가
    this.tempPoints[key] = cur - 1;
    this.unspent++;
    this.refresh();
  }

  confirm(): void {
    applyStats(this.tempPoints as CharacterStats);
    saveUnspentPoints(this.unspent);
    this.close();
  }

  reset(gold: number): void {
    const RESET_COST = 500;
    if (gold < RESET_COST) {
      NotifySystem.show('warn', `골드가 부족합니다. (필요: ${RESET_COST})`);
      return;
    }
    deductGold(RESET_COST);
    // 모든 배분 포인트 회수
    const totalSpent = getTotalSpentPoints();
    resetToBaseStats();
    addUnspentPoints(totalSpent);
    this.refresh();
  }

  private refresh(): void {
    const derived = calcDerivedStats(this.tempPoints as CharacterStats);
    redrawPanel(derived, this.unspent);
  }
}
```

### 4-2. 미배분 포인트 HUD 뱃지

```typescript
// plan 43 HUD에 추가 — HP 게이지 좌측
// 미배분 포인트가 있을 때만 표시, 깜빡임
function drawUnspentStatBadge(ctx: CanvasRenderingContext2D, points: number): void {
  if (points <= 0) return;
  const x = HUD_LEFT + 4, y = 4;
  ctx.fillStyle = '#f0c030';
  roundRect(ctx, x, y, 22, 16, 4); ctx.fill();
  ctx.fillStyle = '#1a1008';
  ctx.font = 'bold 9px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(`+${points}`, x + 11, y + 11);
}
```

---

## 5. 능력치 상한 & 균형 설계

```typescript
const STAT_CAP = 30;   // 기본 능력치 최대값 (아이템 보너스는 별도)

// 초기값 (캐릭터 생성 시 plan 19 연계 — 5포인트 선배분 허용)
const BASE_STATS: CharacterStats = {
  STR: 1, AGI: 1, CON: 1, INT: 1, LUK: 1,
  // derived는 calcDerivedStats로 계산
};

// 파생 스탯 상한
const DERIVED_CAPS = {
  moveSpeed:   240,    // 이속 최대 240px/s
  critChance:  0.50,   // 크리 최대 50%
  craftSpeed:  2.20,   // 제작속도 최대 220%
};
```

### 레벨 50 풀배분 시뮬레이션

```
총 스탯 포인트: 2×45 + 3×5(마일스톤) + 5(초기) = 105포인트
STR30 / AGI25 / CON25 / INT15 / LUK10 (예시 올인 빌드)
→ HP 330 / 이속 195 / 공격 65 / 크리 8%
```

---

## 6. Firebase 저장 구조

```
/rooms/{seed}/players/{playerId}/
  ├── level:        number       // 캐릭터 레벨
  ├── xp:           number       // 현재 누적 XP
  ├── unspentPoints: number
  └── stats/
        ├── STR: number
        ├── AGI: number
        ├── CON: number
        ├── INT: number
        └── LUK: number
```

---

## 7. plan 19(캐릭터 생성) 연계

타이틀 캐릭터 생성 화면에 **초기 빌드 선택** 추가:

```typescript
const STARTER_BUILDS: Record<string, Partial<CharacterStats>> = {
  warrior:  { STR: 3, CON: 2 },   // 전사 (근접전 특화)
  scout:    { AGI: 3, LUK: 2 },   // 정찰자 (이동·낚시 특화)
  builder:  { INT: 3, CON: 2 },   // 건축가 (제작·건설 특화)
  survivor: { CON: 3, INT: 2 },   // 생존자 (HP·회복 특화)
  balanced: { STR: 1, AGI: 1, CON: 1, INT: 1, LUK: 1 },  // 균형 (기본)
};
```

---

## 8. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/systems/LevelSystem.ts` | XP 획득, 레벨업 처리, 마일스톤 |
| `src/systems/CharacterStats.ts` | 파생 스탯 계산, 상한 처리 |
| `src/ui/StatAllocationPanel.ts` | 능력치 배분 UI, reset |
| `src/ui/HUDRenderer.ts` | 미배분 포인트 뱃지 추가 |
| `src/scenes/TitleScene.ts` | 초기 빌드 선택 추가 (plan 19 확장) |

---

## 9. 버전

`v0.64.0`
