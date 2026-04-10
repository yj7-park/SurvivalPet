# 설계 46 — 전투 & 적 비주얼

> **전제 조건**: 01~45 단계 완료 상태.
> plan 04(동물 전투), plan 05(무기 전투), plan 06(침략 이벤트),
> plan 25(피격 피드백), plan 40(캐릭터 오버레이)를 기반으로
> 적 스프라이트와 전투 비주얼 전체를 확정한다.

---

## 1. 이번 단계 목표

1. **적 스프라이트** — 늑대·호랑이·침략자(일반/대장) 4종 스프라이트시트
2. **적 이동 애니메이션** — 4방향 × 보행/공격/사망 프레임
3. **공격 이펙트** — 근접 슬래시, 화살 비행, 범위 공격 연출
4. **피격 이펙트** — 피 파티클, 피격 넘버 팝업, 화면 빈네트
5. **사망 이펙트** — 적 사망 연출 + 드랍 아이템 스폰 연출
6. **침략 이벤트 연출** — 침략 예고 UI + 방향 표시

---

## 2. 적 스프라이트시트

### 2-1. 공통 구조

모든 적 스프라이트시트: 128×96px (프레임 32×32px, 4열×3행)

```
     col0(idle) col1(walk1) col2(walk2) col3(attack)
row0   [↓]        [↓w1]      [↓w2]      [↓atk]     ← 아래 방향
row1   [←]        [←w1]      [←w2]      [←atk]     ← 왼쪽 (우=좌반전)
row2   [사망1]    [사망2]    [사망3]    [사망4]     ← 사망 4프레임
```

> 위쪽 방향(↑)은 아래 방향 좌우반전 + 색조 약간 어둡게 근사

### 2-2. 늑대 (Wolf)

```typescript
function drawWolf(ctx: CanvasRenderingContext2D, frame: WolfFrame): void {
  const pal = {
    body:    '#6a6060',   // 회갈색 몸통
    belly:   '#c0a898',   // 배 (밝음)
    muzzle:  '#d0b8a0',   // 주둥이
    eyes:    '#ffcc00',   // 노란 눈 (야행성)
    outline: '#2a2020',
  };

  // 4발 보행 자세, 낮은 체형 (높이 20px, 너비 28px)
  // 꼬리: 위로 들린 두꺼운 곡선
  // idle: 귀 세움 / walk1: 앞발 들어올림 / walk2: 반대 다리
  // attack: 앞으로 달려드는 자세 + 입 벌림
}
```

Phaser 애니메이션:
```typescript
anims.create({ key: 'wolf_walk',   frames: [{ key:'enemy_wolf', frame:1 }, { key:'enemy_wolf', frame:2 }], frameRate: 7, repeat: -1 });
anims.create({ key: 'wolf_attack', frames: [{ key:'enemy_wolf', frame:3 }], frameRate: 6, repeat: 0 });
anims.create({ key: 'wolf_die',    frames: generateFrameNumbers('enemy_wolf', { start:8, end:11 }), frameRate: 6, repeat: 0 });
```

### 2-3. 호랑이 (Tiger)

```typescript
const tigerPal = {
  body:    '#e08830',   // 주황 몸통
  stripe:  '#2a1a0a',   // 검은 줄무늬 (4~5개)
  belly:   '#f0d0a0',   // 크림 배
  eyes:    '#44ffcc',   // 청록 눈
  outline: '#1a0a00',
};
// 늑대보다 크고 근육질, 어깨 넓음
// 줄무늬: 몸통에 대각선 3~4개 검은 선
// attack 프레임: 앞발 들어 할퀴는 자세
```

### 2-4. 침략자 — 일반 (Raider)

```typescript
const raiderPal = {
  skin:    '#d0a878',
  armor:   '#7a6040',   // 가죽 갑옷 (낡은 갈색)
  weapon:  '#9a9090',   // 녹슨 칼
  cloth:   '#5a4030',   // 거친 천
  hair:    '#3a2810',
  outline: '#1a1008',
};
// 캐릭터(plan 40)와 동일 구조, 더 거칠고 무거운 인상
// idle: 칼 들고 경계 자세
// walk: 앞으로 걸으며 위협적 자세
// attack: 칼 내려치기 모션 (팔 위로 들었다 내림)
```

### 2-5. 침략자 — 대장 (Raider Boss)

```typescript
const bossPal = {
  ...raiderPal,
  armor:   '#4a3828',   // 더 어두운 중갑
  weapon:  '#d0c0a0',   // 큰 도끼 (밝은 금속)
  cape:    '#8a1010',   // 빨간 망토
  crown:   '#c0a030',   // 투구 장식
};
// 일반 침략자보다 1.3× 스케일
// 망토 레이어 추가 (움직임에 따라 살짝 펄럭)
```

---

## 3. 적 이동 & AI 비주얼

### 3-1. 추적 중 시각 표현

```typescript
// 적이 플레이어를 감지했을 때: 느낌표 팝업
function showDetectEmote(enemy: Enemy): void {
  const mark = scene.add.text(enemy.x, enemy.y - 36, '!', {
    fontSize: '18px', fontFamily: 'Courier New',
    color: '#ff4444', stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5);

  scene.tweens.add({
    targets: mark,
    y: mark.y - 12, alpha: 0,
    duration: 900, ease: 'Quad.easeOut',
    onComplete: () => mark.destroy(),
  });
  // 감지 순간 카메라 미진동
  scene.cameras.main.shake(80, 0.004);
}
```

### 3-2. 야간 눈 빛남 (plan 32 연동)

```typescript
// 야간(22:00~06:00) 광원 밖 적에게 적용
// 눈 위치(y: sprite.y - 8)에 2×2 흰 점 추가
const eyeGlow = scene.add.rectangle(
  enemy.x - 3, enemy.y - 8, 2, 2, 0xffffff, 0.9
);
const eyeGlow2 = scene.add.rectangle(
  enemy.x + 3, enemy.y - 8, 2, 2, 0xffffff, 0.9
);
// 0.8초 주기로 alpha 0.5→1.0 yoyo
```

---

## 4. 공격 이펙트

### 4-1. 근접 슬래시

```typescript
// plan 09의 fx_slash 확장: 방향별 호 각도 정확화
const SLASH_ANGLES: Record<Direction, { start: number; end: number }> = {
  down:  { start: 30,  end: 150 },   // 아래 방향 공격: 아래쪽 반원
  up:    { start: 210, end: 330 },
  left:  { start: 120, end: 240 },
  right: { start: -60, end: 60  },
};

// 슬래시 트윈: 0.15초, alpha 0.8→0, scale 0.8→1.3
scene.tweens.add({
  targets: slashSprite,
  alpha: 0, scale: 1.3,
  duration: 150, ease: 'Quad.easeOut',
  onComplete: () => slashSprite.destroy(),
});

// 칼날 잔상: 0.08초 후 같은 위치에 흐린 복사본
scene.time.delayedCall(80, () => {
  const echo = scene.add.image(slashSprite.x, slashSprite.y, 'fx_slash')
    .setAlpha(0.3).setAngle(slashSprite.angle).setScale(1.1);
  scene.tweens.add({ targets: echo, alpha: 0, duration: 100,
    onComplete: () => echo.destroy() });
});
```

### 4-2. 화살 비행

```typescript
// 화살 스프라이트: 8×3px 갈색 직선 (화살촉 어두운 삼각형)
function drawArrow(ctx: CanvasRenderingContext2D): void {
  // 화살대
  ctx.fillStyle = '#a07040'; ctx.fillRect(0, 1, 6, 1);
  // 화살촉
  ctx.fillStyle = '#707070';
  ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(8,1.5); ctx.lineTo(6,3); ctx.fill();
  // 깃털
  ctx.fillStyle = '#d0c0a0';
  ctx.beginPath(); ctx.moveTo(0,1); ctx.lineTo(-2,0); ctx.lineTo(0,2); ctx.fill();
}

// 비행 중 각도를 속도 벡터 방향으로 설정
arrow.setAngle(Phaser.Math.RadToDeg(Math.atan2(velY, velX)));

// 화살 잔상 (plan 09 fx_arrow_trail 재사용, 3px 흰 선)
scene.time.addEvent({
  delay: 30, repeat: 5,
  callback: () => spawnArrowTrail(arrow.x, arrow.y, arrow.angle),
});
```

### 4-3. 범위 공격 (침략자 대장)

```typescript
// 범위 공격 예고: 0.6초 전 빨간 원 표시 (착탄 지점 경고)
const warningCircle = scene.add.graphics();
warningCircle.lineStyle(2, 0xff2222, 0.7);
warningCircle.strokeCircle(targetX, targetY, 48);
// 깜빡임
scene.tweens.add({
  targets: warningCircle, alpha: { from: 0.3, to: 0.9 },
  duration: 200, yoyo: true, repeat: 2,
  onComplete: () => {
    warningCircle.destroy();
    triggerAoeExplosion(targetX, targetY);
  },
});

// 폭발: 주황 원 팽창 (scale 0→1, alpha 0.8→0, 0.3초) + 파편 8개
function triggerAoeExplosion(x: number, y: number): void {
  const burst = scene.add.circle(x, y, 4, 0xff6600, 0.8);
  scene.tweens.add({ targets: burst, scale: 12, alpha: 0, duration: 300,
    ease: 'Quad.easeOut', onComplete: () => burst.destroy() });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    spawnDebris(x, y, Math.cos(angle) * 80, Math.sin(angle) * 80, 0xff8840);
  }
}
```

---

## 5. 피격 이펙트

### 5-1. 데미지 숫자 팝업

```typescript
interface DamagePopup {
  value: number;
  isCrit: boolean;
  isHeal: boolean;
}

function spawnDamagePopup(x: number, y: number, popup: DamagePopup): void {
  const color  = popup.isHeal ? '#44ff88' : popup.isCrit ? '#ffdd00' : '#ffffff';
  const size   = popup.isCrit ? '16px' : popup.isHeal ? '14px' : '13px';
  const prefix = popup.isHeal ? '+' : '-';

  const text = scene.add.text(x + Phaser.Math.Between(-12, 12), y - 20,
    `${prefix}${popup.value}`, {
      fontSize: size, fontFamily: 'Courier New',
      color, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(80);

  scene.tweens.add({
    targets: text,
    y: text.y - (popup.isCrit ? 40 : 28),
    alpha: 0,
    duration: popup.isCrit ? 900 : 700,
    ease: 'Quad.easeOut',
    onComplete: () => text.destroy(),
  });

  // 크리티컬: 숫자 스케일 펄스 (1.0→1.6→1.0, 0.15초)
  if (popup.isCrit) {
    scene.tweens.add({ targets: text, scale: 1.6, duration: 150, yoyo: true });
  }
}
```

### 5-2. 피격 화면 빈네트

```typescript
// 플레이어가 피격될 때: 붉은 빈네트 순간 표시 후 페이드
const hitVignette = scene.add.graphics().setScrollFactor(0).setDepth(90);

function flashHitVignette(intensity: number): void {
  hitVignette.clear();
  // 모서리에서 안쪽으로 붉은 그라디언트 원
  const size = Math.floor(intensity * 60) + 20;  // 피해량 기반 크기
  hitVignette.fillStyle(0xcc0000, 0.55);
  hitVignette.fillRect(0, 0, 800, size);          // 상단
  hitVignette.fillRect(0, 600 - size, 800, size); // 하단
  hitVignette.fillRect(0, 0, size, 600);           // 좌측
  hitVignette.fillRect(800 - size, 0, size, 600);  // 우측

  scene.tweens.add({
    targets: hitVignette, alpha: { from: 1, to: 0 },
    duration: 300, ease: 'Quad.easeOut',
    onComplete: () => hitVignette.setAlpha(1), // alpha 리셋 (다음 피격 대비)
  });
}
```

---

## 6. 사망 이펙트

### 6-1. 적 사망

```typescript
function playEnemyDeath(enemy: Enemy): void {
  // 1. 사망 애니메이션 재생 (4프레임, 0.5초)
  enemy.sprite.play('wolf_die');   // 또는 tiger_die 등

  // 2. 동시에: 피 파티클 폭발 (plan 09 피격 파티클 × 2배)
  spawnBloodBurst(enemy.x, enemy.y, 12);

  // 3. 사망 후 0.5초: 스프라이트 페이드아웃 + 회전 쓰러짐
  scene.time.delayedCall(500, () => {
    scene.tweens.add({
      targets: enemy.sprite,
      alpha: 0, angle: enemy.sprite.flipX ? -90 : 90,
      duration: 400, ease: 'Quad.easeIn',
      onComplete: () => {
        enemy.sprite.destroy();
        spawnDropItems(enemy);   // 드랍 아이템 스폰
      },
    });
  });

  // 4. 처치 XP 팝업 (초록)
  spawnDamagePopup(enemy.x, enemy.y - 16, { value: 20, isCrit: false, isHeal: true });
}
```

### 6-2. 드랍 아이템 스폰 연출

```typescript
// 드랍 아이템이 약간 위로 튀어올랐다가 지면에 안착
function spawnDropItems(enemy: Enemy): void {
  enemy.dropItems.forEach((item, i) => {
    const offsetAngle = (i / enemy.dropItems.length) * Math.PI * 2;
    const dropSprite = scene.add.image(enemy.x, enemy.y, item.spriteKey);

    scene.tweens.add({
      targets: dropSprite,
      x: enemy.x + Math.cos(offsetAngle) * 20,
      y: enemy.y + Math.sin(offsetAngle) * 20 - 30,
      duration: 250, ease: 'Quad.easeOut',
      yoyo: false,
      onComplete: () => {
        // 지면 착지 후 낙하
        scene.tweens.add({
          targets: dropSprite,
          y: dropSprite.y + 30,
          duration: 200, ease: 'Bounce.easeOut',
          onComplete: () => registerGroundItem(dropSprite, item),
        });
      },
    });

    // 아이템 획득 글로우 (plan 16 희귀 아이템 노란 글로우)
    if (item.isRare) addItemGlow(dropSprite);
  });
}
```

---

## 7. 침략 이벤트 연출

### 7-1. 침략 예고 UI

```
┌──────────────────────────────────────────────────┐
│  ⚠  침략이 시작됩니다!  30초 후                   │  ← 화면 상단 중앙, 빨간색
│  ████████░░░░░░░░░░░░  방향: 동쪽 ▶              │
└──────────────────────────────────────────────────┘
배경: rgba(120, 0, 0, 0.75)
등장: 위에서 슬라이드다운 (0.3초)
카운트다운 30→0초
```

### 7-2. 방향 화살표 & 밀도 표시

```typescript
// 화면 가장자리에 적 진입 방향 화살표 표시
function drawInvasionArrow(dir: 'N'|'S'|'E'|'W', enemyCount: number): void {
  const positions = { N:[400,20], S:[400,580], E:[780,300], W:[20,300] };
  const angles    = { N:90, S:270, E:180, W:0 };
  const [x, y]    = positions[dir];

  // 화살표 삼각형 (빨강, 깜빡임)
  const arrow = scene.add.triangle(x, y, 0,0, 20,10, 0,20, 0xff2222, 0.9)
    .setAngle(angles[dir]).setScrollFactor(0).setDepth(85);

  // 적 수 표시
  scene.add.text(x, y + 18, `×${enemyCount}`, {
    fontSize: '11px', color: '#ffaaaa',
    stroke: '#000000', strokeThickness: 2,
  }).setScrollFactor(0).setDepth(85).setOrigin(0.5);

  // 깜빡임 (1초 주기)
  scene.tweens.add({
    targets: arrow, alpha: { from: 0.4, to: 1.0 },
    duration: 500, yoyo: true, repeat: -1,
  });
}
```

---

## 8. 스프라이트 추가 목록

| 키 | 크기 | 설명 |
|----|------|------|
| `enemy_wolf` | 128×96 | 늑대 스프라이트시트 (4열×3행) |
| `enemy_tiger` | 128×96 | 호랑이 스프라이트시트 |
| `enemy_raider` | 128×96 | 침략자 일반 스프라이트시트 |
| `enemy_raider_boss` | 128×96 | 침략자 대장 스프라이트시트 |
| `fx_slash` | 48×48 | 슬래시 호 이펙트 (기존 재드로잉) |
| `fx_arrow` | 8×3 | 화살 비행 스프라이트 |
| `fx_aoe_warning` | — | 코드 생성 (Graphics) |

---

## 9. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/world/SpriteGenerator.ts` | 적 스프라이트시트 4종, fx_arrow 추가 |
| `src/rendering/EnemyRenderer.ts` | 신규: 적 애니메이션, 눈 빛남, 감지 이모트 |
| `src/rendering/CombatRenderer.ts` | 신규: 슬래시·화살·AoE·데미지팝업·빈네트 |
| `src/systems/EnemySystem.ts` | EnemyRenderer 연결, 사망 연출 트리거 |
| `src/systems/CombatSystem.ts` | CombatRenderer 연결, 피격 이펙트 트리거 |
| `src/ui/InvasionHUD.ts` | 신규: 침략 예고 카운트다운 + 방향 화살표 |

---

## 10. 확정 규칙

- 적 오른쪽 방향: 왼쪽 스프라이트 `flipX: true` 재사용 (plan 40 캐릭터와 동일 방식)
- 침략자 대장 스케일: `setScale(1.3)` — 스프라이트는 일반과 동일 시트 사용 가능
- 데미지 팝업 최대 동시 표시: 6개 (초과 시 가장 오래된 것 즉시 제거)
- 피격 빈네트: 플레이어 피격 시만 표시 (적끼리 싸울 때는 미표시)
- 야간 눈 빛남: 플레이어 광원(64px) 안에 들어오면 즉시 제거
- 사망 4프레임 재생 중 피격 이펙트 추가 발생 시 무시 (이미 사망 처리됨)
