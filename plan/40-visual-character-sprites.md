# 설계 40 — 캐릭터 비주얼 & 보행 애니메이션

> **전제 조건**: 01~39 단계 완료 상태.
> plan 03(스프라이트 기준)에서 정의한 정적 4방향 캐릭터 스프라이트를
> 프레임 애니메이션으로 확장하고, 스킨·장비 오버레이 시각화를 확정한다.

---

## 1. 이번 단계 목표

1. **보행 애니메이션** — 4방향 × 4프레임 워킹 사이클
2. **유휴 애니메이션** — 서 있을 때 미세 호흡 동작
3. **3종 스킨** — plan 19(캐릭터 생성)에서 선택한 스킨 시각화
4. **장비 오버레이** — 무기·방어구·횃불을 캐릭터 위에 겹쳐 렌더
5. **상태별 시각 표현** — 피격·광란·수면·허기 위험 등

---

## 2. 스프라이트시트 구조

### 2-1. 캐릭터 스프라이트시트 레이아웃

하나의 스프라이트시트(128×192px)에 모든 프레임 배치:

```
각 프레임 크기: 32×32px
열(col): 0=idle, 1=walk_1, 2=walk_2, 3=walk_3
행(row): 0=down, 1=up, 2=left, 3=right

     col0    col1    col2    col3
row0 [↓idle] [↓w1]  [↓w2]  [↓w3]   ← 아래 방향
row1 [↑idle] [↑w1]  [↑w2]  [↑w3]   ← 위 방향
row2 [←idle] [←w1]  [←w2]  [←w3]   ← 왼쪽
row3 [→idle] [→w1]  [→w2]  [→w3]   ← 오른쪽 (← 좌우반전)
```

Phaser 애니메이션 등록:
```typescript
// 방향별 보행 애니메이션 (4프레임, 8fps)
this.anims.create({
  key: 'walk_down',
  frames: this.anims.generateFrameNumbers('char_skin0', { frames: [1,2,3,2] }),
  frameRate: 8,
  repeat: -1,
});
// walk_up, walk_left, walk_right 동일 패턴

// 유휴 (단일 프레임 → col0 사용)
this.anims.create({
  key: 'idle_down',
  frames: this.anims.generateFrameNumbers('char_skin0', { frames: [0] }),
  frameRate: 1,
  repeat: -1,
});
```

### 2-2. 보행 프레임 드로잉 가이드

Canvas API 기준 각 프레임별 신체 부위 오프셋:

| 프레임 | 좌다리 오프셋Y | 우다리 오프셋Y | 팔 각도 | 몸통 오프셋Y |
|--------|------------|------------|--------|------------|
| idle (col0) | 0 | 0 | 0° | 0 |
| walk_1 (col1) | -3 | +3 | +15° | 0 |
| walk_2 (col2) | 0 | 0 | 0° | -1 (살짝 위) |
| walk_3 (col3) | +3 | -3 | -15° | 0 |

```typescript
// SpriteGenerator — 보행 프레임 그리기 (방향: 'down' 기준)
function drawCharFrame(ctx: CanvasRenderingContext2D, frame: number, dir: Direction, skin: SkinId): void {
  const pal = SKIN_PALETTES[skin];
  const legOffset = WALK_OFFSETS[frame];  // { leftY, rightY }
  const armAngle  = ARM_ANGLES[frame];

  // 신체 레이어 순서: 그림자 → 다리 뒤 → 몸통 → 머리 → 다리 앞 → 팔 → 장비
  drawShadow(ctx);
  drawLegs(ctx, legOffset, pal);
  drawBody(ctx, pal);
  drawHead(ctx, dir, pal);
  drawArms(ctx, armAngle, dir, pal);
}
```

---

## 3. 3종 스킨 팔레트

plan 19에서 정의한 스킨 3종의 색상 확정:

```typescript
const SKIN_PALETTES: Record<SkinId, SkinPalette> = {
  0: {  // 기본 (갈색 머리)
    skin:    '#f0c898',   // 피부
    hair:    '#8b5c2a',   // 머리카락
    shirt:   '#4a7fc1',   // 상의 (파랑)
    pants:   '#3a5a3a',   // 하의 (초록)
    shoes:   '#5a3a1a',   // 신발 (갈색)
    outline: '#2a1a0a',   // 외곽선
  },
  1: {  // 금발 (밝은 피부)
    skin:    '#fddcb0',
    hair:    '#e8c840',
    shirt:   '#c14a4a',   // 상의 (빨강)
    pants:   '#4a3a6a',   // 하의 (보라)
    shoes:   '#3a2a1a',
    outline: '#2a1a0a',
  },
  2: {  // 흑발 (어두운 피부)
    skin:    '#c87840',
    hair:    '#1a1a1a',
    shirt:   '#3a7a3a',   // 상의 (초록)
    pants:   '#5a4a2a',   // 하의 (카키)
    shoes:   '#2a1a0a',
    outline: '#0a0a0a',
  },
};
```

스프라이트시트 키: `char_skin0`, `char_skin1`, `char_skin2`
→ preload 시 스킨별로 3개의 128×192px 텍스처 생성

---

## 4. 장비 오버레이

캐릭터 스프라이트 위에 별도 스프라이트를 Phaser Container로 합성:

```typescript
// CharacterRenderer
const container = scene.add.container(x, y);
container.add(bodySprite);      // 캐릭터 본체
container.add(weaponSprite);    // 무기 오버레이
container.add(armorSprite);     // 방어구 오버레이
container.add(torchSprite);     // 횃불 오버레이 (plan 32)
```

### 4-1. 오버레이 스프라이트 정의

| 키 | 크기 | 설명 |
|----|------|------|
| `overlay_sword_wood` | 32×32 | 나무칼 (하단 우측, 앞방향) |
| `overlay_sword_stone` | 32×32 | 석재칼 |
| `overlay_sword_iron` | 32×32 | 철제칼 |
| `overlay_bow` | 32×32 | 활 (좌측, 겨냥 자세) |
| `overlay_shield_wood` | 32×32 | 목재 방패 (왼팔) |
| `overlay_shield_stone` | 32×32 | 석재 방패 |
| `overlay_armor_leather` | 32×32 | 가죽 갑옷 조끼 레이어 |
| `overlay_armor_wood` | 32×32 | 목재 갑옷 |
| `overlay_armor_stone` | 32×32 | 석재 갑옷 |
| `overlay_armor_iron` | 32×32 | 철제 갑옷 |

방향별 오프셋 테이블:
```typescript
const WEAPON_OFFSETS: Record<Direction, { x: number; y: number; angle: number }> = {
  down:  { x: +10, y: +4,  angle: 0   },
  up:    { x: -10, y: -4,  angle: 180 },
  left:  { x: -8,  y: +2,  angle: -90 },
  right: { x: +8,  y: +2,  angle: 90  },
};
```

---

## 5. 상태별 시각 표현

### 5-1. 피격 플래시

```typescript
// 피격 시 캐릭터 스프라이트 흰색 플래시
bodySprite.setTint(0xffffff);
scene.time.delayedCall(80, () => bodySprite.clearTint());
```

### 5-2. 광란 상태 (plan 18)

```typescript
// 빨간 틴트 + 진동
bodySprite.setTint(0xff6666);
// 매 프레임 ±1~2px 랜덤 오프셋 (흔들림)
container.x = baseX + Phaser.Math.Between(-2, 2);
container.y = baseY + Phaser.Math.Between(-1, 1);
```

### 5-3. 수면 상태

```typescript
// 캐릭터 눕힘 (90도 회전) + 반투명
container.setAngle(90);
container.setAlpha(0.7);
// ZZZ 파티클은 plan 09에서 정의됨
```

### 5-4. 허기 위험 (20 이하, plan 34)

```typescript
// 캐릭터에 노란빛 약한 펄스
const pulse = Math.sin(time * 3) * 0.15 + 0.85;   // 0.7~1.0
bodySprite.setAlpha(pulse);
```

### 5-5. HP 극저 (10 이하)

```typescript
// 빨간 틴트 펄스
const r = Math.floor(lerp(255, 200, Math.sin(time * 4) * 0.5 + 0.5));
bodySprite.setTint(Phaser.Display.Color.GetColor(r, 100, 100));
```

---

## 6. 이름표 & 체력바 (멀티플레이)

원격 플레이어 캐릭터 위 표시:

```typescript
// 이름표
const nameTag = scene.add.text(0, -40, playerName, {
  fontSize: '10px',
  fontFamily: 'monospace',
  color: playerColor,          // plan 33 플레이어 고유 색상
  stroke: '#000000',
  strokeThickness: 2,
});

// 미니 HP바 (28×3px)
const hpBar = scene.add.graphics();
hpBar.fillStyle(0x333333);
hpBar.fillRect(-14, -36, 28, 3);
hpBar.fillStyle(0x44cc66);
hpBar.fillRect(-14, -36, 28 * (hp / maxHp), 3);
```

---

## 7. 유휴 호흡 애니메이션

별도 프레임 없이 코드로 구현 (idle 상태에서):

```typescript
// 매 프레임, idle 상태일 때만
const breathScale = 1.0 + Math.sin(time * 1.2) * 0.012;   // ±1.2% 크기 변화
bodySprite.setScale(1.0, breathScale);
```

---

## 8. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/world/SpriteGenerator.ts` | 캐릭터 스프라이트시트 3종 생성 (4방향×4프레임, 128×192px) |
| `src/rendering/CharacterRenderer.ts` | 신규: 캐릭터 Container 구성, 장비 오버레이 관리 |
| `src/rendering/AnimationManager.ts` | 신규: Phaser anims 등록 (walk/idle × 4방향 × 3스킨) |
| `src/scenes/GameScene.ts` | CharacterRenderer 사용으로 캐릭터 렌더링 교체 |
| `src/config/skins.ts` | 신규: SKIN_PALETTES, WALK_OFFSETS, ARM_ANGLES 상수 |
| `src/config/overlays.ts` | 신규: 장비 오버레이 오프셋 테이블 |

---

## 9. 확정 규칙

- 보행 애니메이션: 이동 중 play, 정지 시 해당 방향 idle 프레임으로 즉시 전환
- 오른쪽 방향 스프라이트: 왼쪽 스프라이트를 `flipX: true` 로 재사용 (텍스처 절약)
- 장비 오버레이는 장착된 아이템이 없으면 visible: false (렌더링 비용 0)
- 멀티플레이 원격 플레이어도 동일 CharacterRenderer 사용 (스킨·장비 Firebase 동기화)
- 광란 상태 시각(빨간 틴트)은 본인 화면 + 다른 플레이어 화면 모두 표시 (plan 33 연동)
- 상태 시각 우선순위: 피격 플래시 > 광란 > HP극저 > 허기위험 (중복 시 높은 쪽 우선)
