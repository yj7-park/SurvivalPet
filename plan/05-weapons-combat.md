# 설계 05 — 무기 · 전투 시스템

> **전제 조건**: 04 단계 완료 상태.
> 동물 AI (사슴/호랑이), 기초 전투 (클릭 공격, HP바, 드롭) 가 구현되어 있다고 가정한다.

---

## 1. 이번 단계 목표

1. 작업대 제작 목록에 무기 추가 (활, 나무 칼, 석재 칼)
2. 무기 장착 슬롯 및 아이콘 HUD 구현
3. 근접 / 원거리 자동 연속 공격 시스템 구현
4. 이동 중 공격 허용
5. 스탯 기반 공격력 / 공격속도 / 회피 시스템 구현
6. 화살 투사체 시스템 구현 (활 전용)

---

## 2. 무기 목록

| 무기 | 종류 | 제작 재료 | 기본 데미지 | 기본 공속 | 사거리 |
|------|------|-----------|-------------|-----------|--------|
| **활** | 원거리 | 목재 ×8 | 8 | 2.0초 | 8타일 |
| **나무 칼** | 근접 | 목재 ×6 | 14 | 1.5초 | 1.5타일 |
| **석재 칼** | 근접 | 목재 ×4 + 석재 ×4 | 22 | 1.5초 | 1.5타일 |

- 맨손 공격도 가능 (무기 없음): 데미지 5, 공속 2.0초, 사거리 1타일
- 한 번에 하나의 무기만 장착 가능

---

## 3. 무기 제작 (작업대)

기존 `02-building-system.md`의 작업대 제작 UI에 무기 탭 추가.

```
[작업대 제작 패널]
  탭: [재료 가공] [무기]

  [무기 탭]
  ┌──────────────────────────────┐
  │ 🏹 활                       │
  │ 목재 ×8        보유: ×12   │
  │                [제작]        │
  ├──────────────────────────────┤
  │ 🗡 나무 칼                  │
  │ 목재 ×6        보유: ×12   │
  │                [제작]        │
  ├──────────────────────────────┤
  │ 🗡 석재 칼                  │
  │ 목재 ×4 + 석재 ×4          │
  │ 보유: 목재 ×12 / 석재 ×2  │
  │ 석재 부족       [제작 불가]  │
  └──────────────────────────────┘
```

제작 소요 시간:
```
craft_weapon_time = base - (STR - 5) * 0.3  (최소 2초)

  활:     base 6초
  나무 칼: base 5초
  석재 칼: base 8초
```

---

## 4. 무기 장착 HUD

화면 우측 하단 (건설 패널 위) 에 무기 슬롯 1개 표시.

```
┌───────────────────────┐
│  [무기 아이콘]        │  ← 현재 장착 무기 (없으면 주먹 아이콘)
│  나무 칼              │
│  DMG 14  SPD 1.5s    │
└───────────────────────┘
```

- 인벤토리에서 무기 아이템 클릭 → 장착
- 장착된 무기 슬롯 클릭 → 해제 (빈손으로)

---

## 5. 자동 연속 공격 시스템

### 5-1. 공격 시작

- 대상(동물 또는 추후 적 플레이어) 클릭 → **공격 대상 고정 (Lock-on)**
- Lock-on 상태 표시: 대상 주변에 빨간 원형 테두리

### 5-2. 공격 루프

```
[Lock-on 상태]
    │
    ├── 대상이 사거리 내
    │       → 쿨다운마다 자동 공격 실행
    │       → 이동 중이어도 공격 실행 (이동 멈추지 않음)
    │
    └── 대상이 사거리 밖
            → 대상을 향해 자동 이동 (A* 경로탐색)
            → 사거리 내 진입 시 즉시 공격 시작
```

### 5-3. Lock-on 해제 조건

| 조건 | 동작 |
|------|------|
| 대상 사망 | 자동 해제 |
| 우클릭 | 수동 해제 |
| 다른 대상 클릭 | 새 대상으로 교체 |
| 자원 채집 클릭 (나무, 암반 등) | 해제 후 채집 시작 |
| `ESC` 키 | 해제 |

### 5-4. 근접 vs 원거리 처리

**근접 (나무 칼 / 석재 칼 / 맨손)**
- 사거리 내 → 즉시 피해 적용 + 타격 이펙트 표시
- 칼 휘두르는 짧은 애니메이션 (0.2초 arc 이펙트)

**원거리 (활)**
- 사거리 내 → 화살 투사체 생성 → 대상까지 날아가서 피해 적용
- 이동 중에도 발사 가능
- 화살 이동 속도: 300px/s
- 화살이 날아가는 동안 대상이 이동하면 → 화살은 발사 시점의 방향으로 직진 (유도 없음)
- 장애물(암반, 벽 구조물) 에 맞으면 화살 소멸

---

## 6. 스탯 기반 전투 공식

### 6-1. 실제 공격 데미지

```
final_damage = (weapon_base_dmg + STR * 2) * hit_multiplier

hit_multiplier = 1.0 (일반)
               = 1.5 (추후: 치명타)

예시 (나무 칼, STR 5):
  14 + 5*2 = 24 데미지

예시 (석재 칼, STR 10):
  22 + 10*2 = 42 데미지
```

### 6-2. 실제 공격 속도 (쿨다운)

```
actual_cooldown = weapon_base_cooldown - (AGI - 5) * 0.1  (최소 0.6초)

예시 (나무 칼 base 1.5초):
  AGI 2  → 1.5 + 0.3 = 1.8초
  AGI 5  → 1.5초
  AGI 10 → 1.5 - 0.5 = 1.0초

예시 (활 base 2.0초):
  AGI 2  → 2.3초
  AGI 5  → 2.0초
  AGI 10 → 1.5초
```

### 6-3. 회피 (Dodge)

- 공격을 받을 때마다 회피 판정 1회
- 회피 성공 시: 피해 0, 회피 이펙트 표시 ("DODGE!")
- 회피 실패 시: 정상 피해 적용

```
dodge_chance = AGI * 4%  (최대 40% 고정)

AGI 2  → 8%
AGI 5  → 20%
AGI 10 → 40%
```

---

## 7. 피해 적용 흐름

```
[공격 발생]
    │
    ▼
회피 판정 (dodge_chance 기반 랜덤)
    ├── 성공 → "DODGE!" 텍스트 팝업, 피해 없음
    └── 실패
            │
            ▼
        최종 피해 = final_damage
        (추후 방어구 구현 시: final_damage - defense)
            │
            ▼
        대상 HP 감소
        HP 피해량 팝업 (빨간 숫자 위로 떠오름)
            │
            ├── HP > 0 → 피격 상태 유지
            └── HP ≤ 0 → 사망 처리
```

---

## 8. 전투 이펙트 (시각 피드백)

| 상황 | 이펙트 |
|------|--------|
| 근접 타격 | 타격 지점에 흰 섬광 0.15초 |
| 원거리 타격 | 화살 명중 시 작은 폭발 이펙트 |
| 피해 수치 | 빨간 숫자 팝업, 위로 1초간 이동 후 페이드 아웃 |
| 회피 | 하늘색 "DODGE!" 텍스트 팝업 |
| 내가 피해 받음 | 화면 테두리 0.3초간 빨간 플래시 |
| 대상 사망 | 0.5초 페이드 아웃 |

---

## 9. 신규 스프라이트 목록

`sprite-generator.html`에 추가:

| Phaser 키 | 함수 | 크기 | 설명 |
|-----------|------|------|------|
| `item_bow` | `drawBow()` | 32×32 | 활 아이콘 |
| `item_sword_wood` | `drawSword('wood')` | 32×32 | 나무 칼 아이콘 |
| `item_sword_stone` | `drawSword('stone')` | 32×32 | 석재 칼 아이콘 |
| `projectile_arrow` | `drawArrow()` | 16×6 | 화살 투사체 |

---

## 10. 구현 구조 (TypeScript)

### WeaponConfig

```typescript
// src/config/weapons.ts

export type WeaponType = 'melee' | 'ranged';

export interface WeaponConfig {
  id: string;
  name: string;
  type: WeaponType;
  baseDamage: number;
  baseCooldown: number;  // 초
  range: number;         // 타일
  projectileSpeed?: number;  // px/s, ranged만 해당
  recipe: { itemId: string; amount: number }[];
  craftTime: number;     // 초 (STR 5 기준)
}

export const WEAPONS: WeaponConfig[] = [
  {
    id: 'fists',
    name: '맨손',
    type: 'melee',
    baseDamage: 5,
    baseCooldown: 2.0,
    range: 1,
    recipe: [],
    craftTime: 0,
  },
  {
    id: 'bow',
    name: '활',
    type: 'ranged',
    baseDamage: 8,
    baseCooldown: 2.0,
    range: 8,
    projectileSpeed: 300,
    recipe: [{ itemId: 'item_wood', amount: 8 }],
    craftTime: 6,
  },
  {
    id: 'sword_wood',
    name: '나무 칼',
    type: 'melee',
    baseDamage: 14,
    baseCooldown: 1.5,
    range: 1.5,
    recipe: [{ itemId: 'item_wood', amount: 6 }],
    craftTime: 5,
  },
  {
    id: 'sword_stone',
    name: '석재 칼',
    type: 'melee',
    baseDamage: 22,
    baseCooldown: 1.5,
    range: 1.5,
    recipe: [
      { itemId: 'item_wood', amount: 4 },
      { itemId: 'item_processed_stone', amount: 4 },
    ],
    craftTime: 8,
  },
];
```

### CombatSystem

```typescript
// src/systems/CombatSystem.ts

class CombatSystem {
  private lockedTarget: Animal | null = null;
  private attackTimer: number = 0;

  // 대상 클릭 시 호출
  lockOn(target: Animal) {
    this.lockedTarget = target;
    this.attackTimer = 0; // 즉시 첫 공격
  }

  unlock() { this.lockedTarget = null; }

  update(delta: number, player: Player) {
    if (!this.lockedTarget || this.lockedTarget.isDead) {
      this.unlock(); return;
    }

    const dist = distanceTiles(player, this.lockedTarget);
    const weapon = player.equippedWeapon;
    const range = weapon?.range ?? 1;
    const cooldown = calcCooldown(weapon, player.stats.AGI);

    if (dist <= range) {
      // 이동 중이어도 공격 실행
      this.attackTimer += delta;
      if (this.attackTimer >= cooldown) {
        this.attackTimer = 0;
        this.executeAttack(player, this.lockedTarget);
      }
    } else {
      // 사거리 밖 → 자동 이동
      player.moveToward(this.lockedTarget.position);
    }
  }

  private executeAttack(player: Player, target: Animal) {
    const weapon = player.equippedWeapon;
    if (weapon?.type === 'ranged') {
      this.spawnArrow(player, target);
    } else {
      this.applyDamage(player, target);
    }
  }

  private applyDamage(attacker: Player, target: Animal) {
    // 회피 판정
    const dodgeChance = target instanceof Player
      ? target.stats.AGI * 0.04
      : 0;  // 동물은 회피 없음

    if (Math.random() < dodgeChance) {
      showDodgeEffect(target); return;
    }

    const dmg = calcDamage(attacker.equippedWeapon, attacker.stats.STR);
    target.takeDamage(dmg);
    showDamageNumber(target.position, dmg);
  }
}
```

### 공식 유틸

```typescript
// src/systems/CombatFormulas.ts

export function calcDamage(weapon: WeaponConfig | null, STR: number): number {
  const base = weapon?.baseDamage ?? 5;
  return base + STR * 2;
}

export function calcCooldown(weapon: WeaponConfig | null, AGI: number): number {
  const base = weapon?.baseCooldown ?? 2.0;
  return Math.max(0.6, base - (AGI - 5) * 0.1);
}

export function calcDodgeChance(AGI: number): number {
  return Math.min(0.4, AGI * 0.04);  // 최대 40%
}
```

---

## 11. Firebase 동기화 범위

- 플레이어가 다른 플레이어를 공격하는 전투는 추후 설계
- 이번 단계는 플레이어 ↔ 동물 전투만 구현
- 동물 HP는 Firebase 동기화 없음 (각 클라이언트 독립)
- 동물 사망만 기록 (`/rooms/{seed}/maps/{mapX}_{mapY}/animals/{id}/dead: true`)
