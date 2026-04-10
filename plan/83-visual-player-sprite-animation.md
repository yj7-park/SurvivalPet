# Plan 83 — 플레이어 캐릭터 스프라이트·애니메이션 고도화

## 목표
플레이어 캐릭터의 이동·대기·구르기·공격·피격·사망·채집·건설 등
모든 동작 애니메이션을 Canvas 픽셀아트로 생성하고 Phaser에 등록한다.
장비(갑옷·무기)를 레이어로 합성하는 구조도 설계한다.

## 버전
`v0.83.0`

## 대상 파일
- `src/rendering/PlayerSpriteFactory.ts` (신규)
- `src/rendering/CharacterRenderer.ts` (개선)

---

## 1. 스프라이트시트 레이아웃

```typescript
// src/rendering/PlayerSpriteFactory.ts

/**
 * 스프라이트시트 구조 (1장 = 모든 방향 × 모든 동작)
 *
 * 프레임 크기: 32×32 px
 * 열(COL): 프레임 인덱스 (최대 8프레임/동작)
 * 행(ROW): 동작 × 방향
 *
 *  ROW  동작        방향
 *  0    idle        down
 *  1    idle        up
 *  2    idle        left  (right는 flipX)
 *  3    walk        down
 *  4    walk        up
 *  5    walk        left
 *  6    run         down
 *  7    run         up
 *  8    run         left
 *  9    attack      down
 *  10   attack      up
 *  11   attack      left
 *  12   hurt        down (all-dir 공통)
 *  13   die         down (all-dir 공통)
 *  14   gather      down
 *  15   build       down
 *  16   roll        down
 *  17   sleep       down
 */

export const PLAYER_ANIM_ROWS = {
  idle_down: 0,  idle_up: 1,  idle_left: 2,
  walk_down: 3,  walk_up: 4,  walk_left: 5,
  run_down:  6,  run_up:  7,  run_left:  8,
  atk_down:  9,  atk_up: 10,  atk_left: 11,
  hurt:      12,
  die:       13,
  gather:    14,
  build:     15,
  roll_down: 16,
  sleep:     17,
} as const;

export const ANIM_FRAME_COUNTS: Record<keyof typeof PLAYER_ANIM_ROWS, number> = {
  idle_down: 4, idle_up: 4, idle_left: 4,
  walk_down: 6, walk_up: 6, walk_left: 6,
  run_down:  6, run_up:  6, run_left:  6,
  atk_down:  5, atk_up:  5, atk_left:  5,
  hurt:      3,
  die:       6,
  gather:    4,
  build:     4,
  roll_down: 5,
  sleep:     2,
};

const FRAME_W = 32, FRAME_H = 32;
const COLS    = 8;
```

---

## 2. 플레이어 픽셀 팔레트

```typescript
// 스킨 타입별 팔레트 (피부색·머리색·기본 복장)
export type PlayerSkin = 'default' | 'dark' | 'pale' | 'tan';

const SKIN_PALETTES: Record<PlayerSkin, {
  skin: number; skinShadow: number;
  hair: number; eye: number;
  cloth1: number; cloth2: number;
}> = {
  default: { skin: 0xddb58a, skinShadow: 0xbb9066, hair: 0x663322, eye: 0x2244aa, cloth1: 0x446688, cloth2: 0x334466 },
  dark:    { skin: 0x8a6644, skinShadow: 0x664422, hair: 0x221100, eye: 0xaa6600, cloth1: 0x664422, cloth2: 0x442200 },
  pale:    { skin: 0xeeddcc, skinShadow: 0xccbbaa, hair: 0xddccaa, eye: 0x6699cc, cloth1: 0x888899, cloth2: 0x667788 },
  tan:     { skin: 0xcc9966, skinShadow: 0xaa7744, hair: 0x442200, eye: 0x336622, cloth1: 0x557744, cloth2: 0x334422 },
};
```

---

## 3. 프레임 드로우 함수

```typescript
/** 단일 프레임을 Graphics로 드로우 후 RenderTexture에 스탬프 */
function drawPlayerFrame(
  gfx: Phaser.GameObjects.Graphics,
  skin: typeof SKIN_PALETTES[PlayerSkin],
  action: keyof typeof PLAYER_ANIM_ROWS,
  frame: number,  // 0-based 프레임 인덱스
): void {
  gfx.clear();
  const P = 2;  // 픽셀 크기 (2px = 16×16 가상 캔버스)
  const ox = 0, oy = 0;

  // ── 공통 신체 (idle_down 기준, 다른 동작은 변형) ──────
  const drawBody = (legOffset = 0, armOffset = 0) => {
    // 발 (2개)
    gfx.fillStyle(skin.cloth2, 1)
      .fillRect(ox + 6*P, oy + 14*P + legOffset, 3*P, 2*P)
      .fillRect(ox + 9*P, oy + 14*P - legOffset, 3*P, 2*P);

    // 다리
    gfx.fillStyle(skin.cloth1, 1)
      .fillRect(ox + 6*P, oy + 10*P, 3*P, 4*P)
      .fillRect(ox + 9*P, oy + 10*P, 3*P, 4*P);

    // 몸통
    gfx.fillStyle(skin.cloth1, 1)
      .fillRect(ox + 5*P, oy + 6*P, 8*P, 4*P);
    gfx.fillStyle(skin.cloth2, 1)
      .fillRect(ox + 5*P, oy + 6*P, 8*P, P);  // 어깨선

    // 팔 (왼)
    gfx.fillStyle(skin.cloth1, 1)
      .fillRect(ox + 3*P, oy + 6*P + armOffset, 2*P, 3*P);
    // 팔 (오)
    gfx.fillStyle(skin.cloth1, 1)
      .fillRect(ox + 13*P, oy + 6*P - armOffset, 2*P, 3*P);
    // 손 (왼)
    gfx.fillStyle(skin.skin, 1)
      .fillRect(ox + 3*P, oy + 9*P + armOffset, 2*P, 2*P);
    // 손 (오)
    gfx.fillStyle(skin.skin, 1)
      .fillRect(ox + 13*P, oy + 9*P - armOffset, 2*P, 2*P);

    // 목
    gfx.fillStyle(skin.skin, 1)
      .fillRect(ox + 7*P, oy + 4*P, 2*P, 2*P);

    // 머리
    gfx.fillStyle(skin.skin, 1)
      .fillRect(ox + 5*P, oy + P, 6*P, 4*P);
    // 머리카락
    gfx.fillStyle(skin.hair, 1)
      .fillRect(ox + 5*P, oy + P, 6*P, P)    // 정수리
      .fillRect(ox + 5*P, oy + P, P, 2*P)   // 왼 사이드
      .fillRect(ox + 10*P, oy + P, P, 2*P); // 오 사이드
    // 눈
    gfx.fillStyle(skin.eye, 1)
      .fillRect(ox + 6*P, oy + 2*P, P, P)
      .fillRect(ox + 9*P, oy + 2*P, P, P);
  };

  // ── 동작별 변형 ──────────────────────────────────────────
  switch (action) {
    case 'idle_down':
      drawBody(frame % 2 === 0 ? 0 : 0, 0);
      break;

    case 'walk_down': {
      const legAlt = frame % 2 === 0 ? P : -P;
      const armAlt = frame % 2 === 0 ? P : -P;
      drawBody(legAlt, armAlt);
      break;
    }

    case 'run_down': {
      const r = frame % 3;
      drawBody(r === 0 ? P*2 : r === 1 ? 0 : -P*2, r === 0 ? -P : r === 1 ? 0 : P);
      break;
    }

    case 'atk_down': {
      // 팔을 앞으로 뻗는 포즈
      const reach = frame < 2 ? frame * P : (4 - frame) * P;
      drawBody(0, -reach);
      break;
    }

    case 'hurt': {
      // 뒤로 젖히는 포즈
      drawBody(frame * P * 0.5, -frame * P);
      // 붉은 오버레이 (히트 플래시)
      gfx.fillStyle(0xff0000, 0.4)
        .fillRect(ox + 3*P, oy + P, 12*P, 16*P);
      break;
    }

    case 'die': {
      // 점점 눕는 포즈 (frame 0→5: 서있다가 수평으로)
      const tiltScale = frame / 5;
      gfx.setAngle(tiltScale * 90);  // 회전 근사 불가, 대신 이동 + 압축
      drawBody(frame * P, 0);
      gfx.setAlpha(1 - frame * 0.15);
      break;
    }

    case 'gather': {
      // 숙이는 포즈
      const bend = frame < 2 ? frame * P : (4 - frame) * P;
      drawBody(bend, bend);
      break;
    }

    case 'roll_down': {
      // 공 모양으로 압축
      const squeeze = 1 - frame * 0.15;
      gfx.setScale(1, squeeze);
      drawBody(0, P * frame);
      gfx.setScale(1, 1);
      break;
    }

    default:
      drawBody(0, 0);
  }
}
```

---

## 4. 스프라이트시트 생성

```typescript
export function generatePlayerSpritesheet(
  scene: Phaser.Scene,
  skin: PlayerSkin = 'default',
  textureKey = 'player_sheet',
): void {
  if (scene.textures.exists(textureKey)) return;

  const pal = SKIN_PALETTES[skin];
  const rowKeys = Object.keys(PLAYER_ANIM_ROWS) as (keyof typeof PLAYER_ANIM_ROWS)[];
  const totalRows = rowKeys.length;
  const totalW    = COLS * FRAME_W;
  const totalH    = totalRows * FRAME_H;

  const rt  = scene.add.renderTexture(0, 0, totalW, totalH).setVisible(false);
  const gfx = scene.add.graphics().setVisible(false);

  rowKeys.forEach((action, rowIdx) => {
    const frameCount = ANIM_FRAME_COUNTS[action];
    for (let f = 0; f < frameCount; f++) {
      drawPlayerFrame(gfx, pal, action, f);
      rt.draw(gfx, f * FRAME_W, rowIdx * FRAME_H);
    }
  });

  // RenderTexture → Texture 변환
  rt.snapshot(img => {
    scene.textures.addImage(textureKey, img as HTMLImageElement);
    rt.destroy();
    gfx.destroy();
    _registerAnims(scene, textureKey);
  });
}

function _registerAnims(scene: Phaser.Scene, key: string): void {
  const rowKeys = Object.keys(PLAYER_ANIM_ROWS) as (keyof typeof PLAYER_ANIM_ROWS)[];

  rowKeys.forEach(action => {
    const rowIdx = PLAYER_ANIM_ROWS[action];
    const count  = ANIM_FRAME_COUNTS[action];
    const fps    = _getAnimFPS(action);
    const repeat = action === 'die' ? 0 : -1;

    const frames = scene.anims.generateFrameNumbers(key, {
      start: rowIdx * COLS,
      end:   rowIdx * COLS + count - 1,
    });

    scene.anims.create({
      key:       `player_${action}`,
      frames,
      frameRate: fps,
      repeat,
    });
  });
}

function _getAnimFPS(action: keyof typeof PLAYER_ANIM_ROWS): number {
  if (action.startsWith('run'))    return 12;
  if (action.startsWith('walk'))   return 8;
  if (action.startsWith('atk'))    return 10;
  if (action === 'roll_down')      return 14;
  if (action === 'die')            return 8;
  if (action === 'hurt')           return 12;
  return 6;  // idle, gather, build, sleep
}
```

---

## 5. CharacterRenderer 개선 — 장비 레이어 합성

```typescript
// src/rendering/CharacterRenderer.ts (발췌·개선)

export interface EquipmentLayer {
  slot: 'head' | 'body' | 'weapon' | 'shield';
  textureKey: string;
  tintColor?: number;
}

export class CharacterLayerRenderer {
  private scene: Phaser.Scene;
  private sprites: {
    base:   Phaser.GameObjects.Sprite;
    head?:  Phaser.GameObjects.Sprite;
    body?:  Phaser.GameObjects.Sprite;
    weapon?: Phaser.GameObjects.Sprite;
  } = {} as any;
  private container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    this.sprites.base = scene.add.sprite(0, 0, 'player_sheet').setOrigin(0.5, 1);

    this.container = scene.add.container(x, y, [this.sprites.base])
      .setDepth(y);
  }

  playAnim(
    action: keyof typeof PLAYER_ANIM_ROWS,
    dir: 'up' | 'down' | 'left' | 'right',
  ): void {
    const dirKey = dir === 'right' ? 'left' : dir;
    const animKey = `player_${action}_${dirKey}` as string;

    // Bug55 fix: right → flipX=true, left 기준 스프라이트
    this.sprites.base.setFlipX(dir === 'right');

    if (this.scene.anims.exists(animKey)) {
      this.sprites.base.play(animKey, true);
    } else if (this.scene.anims.exists(`player_${action}_down`)) {
      this.sprites.base.play(`player_${action}_down`, true);
    }

    // 장비 레이어도 동기화
    if (this.sprites.head)   this.sprites.head.play(animKey.replace('player_', 'head_'), true);
    if (this.sprites.weapon) this.sprites.weapon.play(animKey.replace('player_', 'weapon_'), true);
  }

  setEquipment(layers: EquipmentLayer[]): void {
    layers.forEach(layer => {
      const existing = this.sprites[layer.slot as keyof typeof this.sprites] as Phaser.GameObjects.Sprite | undefined;
      if (existing) existing.destroy();

      const sprite = this.scene.add.sprite(0, 0, layer.textureKey).setOrigin(0.5, 1);
      if (layer.tintColor) sprite.setTint(layer.tintColor);
      (this.sprites as any)[layer.slot] = sprite;
      this.container.add(sprite);
    });
  }

  updatePosition(x: number, y: number): void {
    this.container.setPosition(x, y).setDepth(y);
  }

  /** 피격 시 히트 플래시 */
  playHitFlash(): void {
    this.sprites.base.setTint(0xff4444);
    this.scene.time.delayedCall(80, () => {
      this.sprites.base.clearTint();
    });
  }

  /** 사망 연출 */
  playDeath(onComplete: () => void): void {
    this.sprites.base.play('player_die', true);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 600,
      delay: 400,
      onComplete,
    });
  }

  destroy(): void {
    this.container.destroy();
  }
}
```

---

## 6. 구르기(Roll) 트레일 이펙트

```typescript
// src/rendering/PlayerSpriteFactory.ts (추가)

export function playRollTrailFX(
  scene: Phaser.Scene,
  positions: { x: number; y: number }[],  // 구르기 경로 (샘플링된 좌표)
): void {
  positions.forEach((pos, i) => {
    const ghost = scene.add.sprite(pos.x, pos.y, 'player_sheet')
      .setTint(0x88aaff)
      .setAlpha(0.5 - i * 0.08)
      .setDepth(pos.y - 1);

    scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 200,
      delay: i * 30,
      onComplete: () => ghost.destroy(),
    });
  });
}
```

---

## 7. 애니메이션 전환 규칙

| 현재 상태         | 입력/이벤트          | 다음 애니메이션 |
|-------------------|----------------------|----------------|
| idle              | 이동                 | walk           |
| walk              | 빠른 이동            | run            |
| walk/run          | 정지                 | idle           |
| any               | 공격 입력            | atk (우선)     |
| any               | 피격                 | hurt           |
| hurt 완료         | HP > 0               | idle           |
| hurt 완료         | HP ≤ 0               | die            |
| idle/walk         | 상호작용             | gather/build   |
| any               | 구르기 입력          | roll           |
| idle              | 수면 시작            | sleep          |

```typescript
// CharacterLayerRenderer.ts (상태 머신)
export type AnimState =
  | 'idle' | 'walk' | 'run' | 'atk' | 'hurt' | 'die'
  | 'gather' | 'build' | 'roll' | 'sleep';

export function resolveAnimState(
  current: AnimState,
  isMoving: boolean,
  isRunning: boolean,
  isAttacking: boolean,
  isHurt: boolean,
  isDead: boolean,
): AnimState {
  if (isDead)       return 'die';
  if (isHurt)       return 'hurt';
  if (isAttacking)  return 'atk';
  if (isRunning)    return 'run';
  if (isMoving)     return 'walk';
  if (current === 'gather' || current === 'build' || current === 'sleep') return current;
  return 'idle';
}
```
