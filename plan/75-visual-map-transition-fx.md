# Plan 75 — 맵 전환 화면 전환 이펙트 비주얼

## 목표
맵 이동(문·계단·맵 경계)·씬 전환·텔레포트 시 플레이어 눈에 보이는
전환 이펙트를 추가해 게임의 몰입감을 높인다.

## 버전
`v0.75.0`

## 대상 파일
- `src/rendering/MapTransitionFX.ts` (신규)
- `src/systems/MapTransitionSystem.ts` (훅 연결)
- `src/scenes/GameScene.ts` (카메라·오버레이 레이어 연결)

---

## 1. 전환 이펙트 종류 및 선택 로직

```typescript
// src/rendering/MapTransitionFX.ts

export type TransitionType =
  | 'fade'        // 기본 검은 화면 페이드
  | 'iris'        // 원형 조리개 닫힘/열림
  | 'swipe_left'  // 슬라이드 ← (던전 진입)
  | 'swipe_right' // 슬라이드 → (던전 탈출)
  | 'flash'       // 하얀 섬광 (텔레포트)
  | 'dissolve'    // 픽셀 디졸브 (마법 포탈)
  | 'ripple';     // 물결 왜곡 (물 통과)

/** 전환 유형 자동 선택 */
export function pickTransitionType(trigger: string): TransitionType {
  if (trigger === 'teleport')       return 'flash';
  if (trigger === 'portal_magic')   return 'dissolve';
  if (trigger === 'water_surface')  return 'ripple';
  if (trigger === 'dungeon_enter')  return 'swipe_left';
  if (trigger === 'dungeon_exit')   return 'swipe_right';
  if (trigger === 'iris_door')      return 'iris';
  return 'fade';
}
```

---

## 2. MapTransitionFX 클래스

```typescript
export class MapTransitionFX {
  private scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.Graphics;
  private irisGfx: Phaser.GameObjects.Graphics;
  private pixelPool: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width: W, height: H } = scene.scale;

    // 전체 화면 오버레이 (depth 200)
    this.overlay = scene.add.graphics()
      .fillStyle(0x000000, 1)
      .fillRect(0, 0, W, H)
      .setDepth(200)
      .setAlpha(0)
      .setScrollFactor(0);

    // 조리개용 별도 Graphics
    this.irisGfx = scene.add.graphics()
      .setDepth(201)
      .setScrollFactor(0);

    // 픽셀 디졸브용 사각형 풀 (20×20 그리드 = 최대 ~800개)
    this._buildPixelPool(W, H);
  }

  private _buildPixelPool(W: number, H: number): void {
    const COLS = 20, ROWS = 15;
    const pw = W / COLS, ph = H / ROWS;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const rect = this.scene.add
          .rectangle(c * pw + pw / 2, r * ph + ph / 2, pw, ph, 0x000000)
          .setDepth(200)
          .setScrollFactor(0)
          .setAlpha(0);
        this.pixelPool.push(rect);
      }
    }
  }

  // ── 공통 OUT (화면 가리기) ────────────────────────────────

  out(type: TransitionType, duration = 400): Promise<void> {
    return new Promise(resolve => {
      switch (type) {
        case 'fade':       this._fadeOut(duration, resolve);       break;
        case 'iris':       this._irisClose(duration, resolve);     break;
        case 'swipe_left': this._swipeOut('left', duration, resolve); break;
        case 'swipe_right':this._swipeOut('right', duration, resolve); break;
        case 'flash':      this._flashOut(duration, resolve);      break;
        case 'dissolve':   this._dissolveOut(duration, resolve);   break;
        case 'ripple':     this._rippleOut(duration, resolve);     break;
        default:           this._fadeOut(duration, resolve);
      }
    });
  }

  // ── 공통 IN (화면 열기) ──────────────────────────────────

  in(type: TransitionType, duration = 400): Promise<void> {
    return new Promise(resolve => {
      switch (type) {
        case 'fade':       this._fadeIn(duration, resolve);        break;
        case 'iris':       this._irisOpen(duration, resolve);      break;
        case 'swipe_left': this._swipeIn('right', duration, resolve); break;
        case 'swipe_right':this._swipeIn('left', duration, resolve);  break;
        case 'flash':      this._flashIn(duration, resolve);       break;
        case 'dissolve':   this._dissolveIn(duration, resolve);    break;
        case 'ripple':     this._fadeIn(duration, resolve);        break; // ripple IN은 단순 페이드
        default:           this._fadeIn(duration, resolve);
      }
    });
  }

  // ── 세부 구현 ────────────────────────────────────────────

  private _fadeOut(ms: number, done: () => void): void {
    this.overlay.setAlpha(0);
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 1,
      duration: ms,
      ease: 'Linear',
      onComplete: done,
    });
  }

  private _fadeIn(ms: number, done: () => void): void {
    this.overlay.setAlpha(1);
    this.scene.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: ms,
      ease: 'Linear',
      onComplete: done,
    });
  }

  /** 원형 조리개 닫힘: Phaser.GameObjects.Graphics maskTexture 이용 */
  private _irisClose(ms: number, done: () => void): void {
    const { width: W, height: H } = this.scene.scale;
    const cx = W / 2, cy = H / 2;
    let radius = Math.hypot(W, H) / 2;   // 최대 반경
    const target = { r: radius };

    // 매 프레임 irisGfx 재드로우
    const updateFn = () => {
      this.irisGfx.clear();
      // 전체 채움
      this.irisGfx.fillStyle(0x000000, 1).fillRect(0, 0, W, H);
      // 원형 구멍 (erase 대신 Phaser.Display.Canvas.CanvasPool 우회:
      //   BlendMode.ERASE or mask 사용)
      this.irisGfx.fillStyle(0x000000, 0);
      // Phaser 3에서 원형 구멍은 Graphics.fillCircle 후 blendMode ERASE
      // 간단히: 검은 rect + 원래 씬이 보이는 원형 mask
      this.irisGfx.clear()
        .fillStyle(0x000000, 1)
        .fillRect(0, 0, W, H);
    };

    // Phaser Graphics로 직접 구멍 뚫기가 제한적이므로
    // RenderTexture + erase pipeline 활용
    const rt = this.scene.add.renderTexture(0, 0, W, H)
      .setDepth(200).setScrollFactor(0);
    const gfx = this.scene.add.graphics()
      .setVisible(false);

    const onUpdate = (_: unknown, progress: number) => {
      const r = Phaser.Math.Linear(radius, 0, progress);
      rt.clear();
      // 검은 레이어
      gfx.clear().fillStyle(0x000000, 1).fillRect(0, 0, W, H);
      rt.draw(gfx, 0, 0);
      // 원형 구멍 (erase blend)
      gfx.clear().fillStyle(0xffffff, 1).fillCircle(cx, cy, r);
      rt.erase(gfx, 0, 0);
    };

    this.scene.tweens.add({
      targets: {},
      progress: { from: 0, to: 1 },
      duration: ms,
      ease: 'Sine.easeIn',
      onUpdate,
      onComplete: () => { gfx.destroy(); rt.destroy(); done(); },
    });
  }

  private _irisOpen(ms: number, done: () => void): void {
    const { width: W, height: H } = this.scene.scale;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.hypot(W, H) / 2;

    const rt = this.scene.add.renderTexture(0, 0, W, H)
      .setDepth(200).setScrollFactor(0);
    const gfx = this.scene.add.graphics().setVisible(false);

    const onUpdate = (_: unknown, progress: number) => {
      const r = Phaser.Math.Linear(0, maxR, progress);
      rt.clear();
      gfx.clear().fillStyle(0x000000, 1).fillRect(0, 0, W, H);
      rt.draw(gfx, 0, 0);
      gfx.clear().fillStyle(0xffffff, 1).fillCircle(cx, cy, r);
      rt.erase(gfx, 0, 0);
    };

    this.scene.tweens.add({
      targets: {},
      progress: { from: 0, to: 1 },
      duration: ms,
      ease: 'Sine.easeOut',
      onUpdate,
      onComplete: () => { gfx.destroy(); rt.destroy(); done(); },
    });
  }

  private _swipeOut(dir: 'left' | 'right', ms: number, done: () => void): void {
    const { width: W, height: H } = this.scene.scale;
    const startX = dir === 'left' ? W : -W;
    const panel = this.scene.add
      .rectangle(startX + W / 2, H / 2, W, H, 0x000000)
      .setDepth(200).setScrollFactor(0);

    this.scene.tweens.add({
      targets: panel,
      x: W / 2,
      duration: ms,
      ease: 'Cubic.easeIn',
      onComplete: () => { panel.setVisible(false); done(); },
    });
  }

  private _swipeIn(dir: 'left' | 'right', ms: number, done: () => void): void {
    const { width: W, height: H } = this.scene.scale;
    const endX = dir === 'left' ? -W / 2 : W * 1.5;
    const panel = this.scene.add
      .rectangle(W / 2, H / 2, W, H, 0x000000)
      .setDepth(200).setScrollFactor(0);

    this.scene.tweens.add({
      targets: panel,
      x: endX,
      duration: ms,
      ease: 'Cubic.easeOut',
      onComplete: () => { panel.destroy(); done(); },
    });
  }

  private _flashOut(ms: number, done: () => void): void {
    const { width: W, height: H } = this.scene.scale;
    const flash = this.scene.add
      .rectangle(W / 2, H / 2, W, H, 0xffffff)
      .setDepth(200).setScrollFactor(0).setAlpha(0);

    this.scene.tweens.add({
      targets: flash,
      alpha: 1,
      duration: ms * 0.3,
      ease: 'Expo.easeOut',
      onComplete: () => { (flash as any)._keepRef = true; (this as any)._flashRef = flash; done(); },
    });
  }

  private _flashIn(ms: number, done: () => void): void {
    const flash = (this as any)._flashRef as Phaser.GameObjects.Rectangle | undefined;
    if (!flash) { this._fadeIn(ms, done); return; }
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: ms,
      ease: 'Linear',
      onComplete: () => { flash.destroy(); done(); },
    });
  }

  /** 픽셀 디졸브: 랜덤 순서로 타일을 검게 채움 */
  private _dissolveOut(ms: number, done: () => void): void {
    const indices = Phaser.Utils.Array.Shuffle([...Array(this.pixelPool.length).keys()]);
    const delayPerTile = ms / this.pixelPool.length;

    indices.forEach((idx, order) => {
      this.scene.time.delayedCall(order * delayPerTile, () => {
        this.pixelPool[idx].setAlpha(1);
      });
    });
    this.scene.time.delayedCall(ms + 50, done);
  }

  private _dissolveIn(ms: number, done: () => void): void {
    const indices = Phaser.Utils.Array.Shuffle([...Array(this.pixelPool.length).keys()]);
    const delayPerTile = ms / this.pixelPool.length;

    indices.forEach((idx, order) => {
      this.scene.time.delayedCall(order * delayPerTile, () => {
        this.pixelPool[idx].setAlpha(0);
      });
    });
    this.scene.time.delayedCall(ms + 50, done);
  }

  /** 물결 왜곡: PostFX pipeline 사용 (간략 구현) */
  private _rippleOut(ms: number, done: () => void): void {
    // Phaser 3.60+ WavePipeline이 없으면 단순 페이드로 fallback
    const cam = this.scene.cameras.main;
    // 카메라 셰이크 + 페이드
    cam.shake(ms * 0.4, 0.004);
    cam.fade(ms, 0, 0, 0, false, (_: unknown, progress: number) => {
      if (progress === 1) done();
    });
  }

  destroy(): void {
    this.overlay.destroy();
    this.irisGfx.destroy();
    this.pixelPool.forEach(r => r.destroy());
    this.pixelPool.length = 0;
  }
}
```

---

## 3. MapTransitionSystem 훅 연결

```typescript
// src/systems/MapTransitionSystem.ts (발췌·수정)

import { MapTransitionFX, pickTransitionType } from '../rendering/MapTransitionFX';

export class MapTransitionSystem {
  private fx!: MapTransitionFX;

  init(scene: Phaser.Scene): void {
    this.fx = new MapTransitionFX(scene);
    // Bug46 수정 포함: 전환 전 지붕 복원
    this.roofSystem?.restoreAllRoofs();
  }

  async triggerTransition(
    trigger: string,
    onMidpoint: () => void,   // 실제 맵 데이터 교체 콜백
  ): Promise<void> {
    const type = pickTransitionType(trigger);

    // 1) OUT: 화면 가리기
    await this.fx.out(type, 380);

    // 2) 맵 교체 (로직 실행)
    onMidpoint();
    this.roofSystem?.restoreAllRoofs();   // Bug46 fix

    // 짧은 대기 (새 맵 렌더링 안정화)
    await new Promise<void>(r => this.scene.time.delayedCall(80, r));

    // 3) IN: 화면 열기
    await this.fx.in(type, 380);
  }
}
```

---

## 4. 전환별 보조 이펙트

### 4-1. 문 통과 발자국 잔상

```typescript
// src/rendering/MapTransitionFX.ts

export function playDoorExitTrail(
  scene: Phaser.Scene,
  playerX: number,
  playerY: number,
  dir: 'up' | 'down' | 'left' | 'right',
): void {
  const STEPS = 5;
  const dx = dir === 'left' ? -6 : dir === 'right' ? 6 : 0;
  const dy = dir === 'up'   ? -6 : dir === 'down'  ? 6 : 0;

  for (let i = 0; i < STEPS; i++) {
    const footprint = scene.add.graphics()
      .fillStyle(0xffffff, 0.4)
      .fillEllipse(playerX + dx * i, playerY + dy * i + 6, 6, 4)
      .setDepth(50);

    scene.tweens.add({
      targets: footprint,
      alpha: 0,
      duration: 500,
      delay: i * 60,
      onComplete: () => footprint.destroy(),
    });
  }
}
```

### 4-2. 텔레포트 잔상 링

```typescript
export function playTeleportLeaveEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
): void {
  // 3개의 확장 링 (흰색 → 투명)
  for (let i = 0; i < 3; i++) {
    const ring = scene.add.graphics().setDepth(60);
    scene.tweens.add({
      targets: {},
      progress: { from: 0, to: 1 },
      duration: 400,
      delay: i * 80,
      onUpdate: (_: unknown, p: number) => {
        ring.clear();
        const r = Phaser.Math.Linear(10, 50, p);
        const a = Phaser.Math.Linear(0.8, 0, p);
        ring.lineStyle(3, 0xaaddff, a).strokeCircle(x, y, r);
      },
      onComplete: () => ring.destroy(),
    });
  }

  // 하얀 섬광 점
  const dot = scene.add
    .circle(x, y, 12, 0xffffff)
    .setDepth(61).setAlpha(1);
  scene.tweens.add({
    targets: dot,
    scaleX: 0, scaleY: 0, alpha: 0,
    duration: 200,
    ease: 'Expo.easeOut',
    onComplete: () => dot.destroy(),
  });
}

export function playTeleportArriveEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
): void {
  // 수축 링 3개 (큰 → 작은)
  for (let i = 0; i < 3; i++) {
    const ring = scene.add.graphics().setDepth(60);
    scene.tweens.add({
      targets: {},
      progress: { from: 0, to: 1 },
      duration: 350,
      delay: i * 70,
      onUpdate: (_: unknown, p: number) => {
        ring.clear();
        const r = Phaser.Math.Linear(50, 8, p);
        const a = Phaser.Math.Linear(0, 0.7, p);
        ring.lineStyle(2, 0x88ccff, a).strokeCircle(x, y, r);
      },
      onComplete: () => ring.destroy(),
    });
  }
}
```

### 4-3. 포탈 진입/탈출 이펙트

```typescript
export function playPortalEnterEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number = 0x8844ff,
): void {
  // 나선형 파티클 (12개)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const startR = 30;
    const px = x + Math.cos(angle) * startR;
    const py = y + Math.sin(angle) * startR;
    const dot = scene.add.circle(px, py, 3, color).setDepth(62).setAlpha(0.9);

    scene.tweens.add({
      targets: dot,
      x: x,
      y: y,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: 300 + i * 20,
      ease: 'Sine.easeIn',
      onComplete: () => dot.destroy(),
    });
  }

  // 포탈 외곽 링 확장
  const ring = scene.add.graphics().setDepth(61);
  scene.tweens.add({
    targets: {},
    progress: { from: 0, to: 1 },
    duration: 400,
    onUpdate: (_: unknown, p: number) => {
      ring.clear();
      const r = Phaser.Math.Linear(8, 40, p);
      const a = Phaser.Math.Linear(1, 0, p);
      ring.lineStyle(4, color, a).strokeCircle(x, y, r);
    },
    onComplete: () => ring.destroy(),
  });
}
```

---

## 5. 계단 전환 전용 이펙트

```typescript
// 계단 내려가기: 카메라가 아래로 살짝 스크롤 후 페이드
export function playStairsDescendFX(
  scene: Phaser.Scene,
  onMidpoint: () => void,
): void {
  const cam = scene.cameras.main;
  const originalScrollY = cam.scrollY;

  // 1) 카메라 아래로 20px 이동
  scene.tweens.add({
    targets: cam,
    scrollY: originalScrollY + 20,
    duration: 200,
    ease: 'Sine.easeIn',
    onComplete: () => {
      // 2) 페이드 아웃
      cam.fade(200, 0, 0, 0, false, (_: unknown, p: number) => {
        if (p === 1) {
          onMidpoint();
          // 3) 새 맵에서 카메라 위에서 내려오며 페이드 인
          cam.scrollY = cam.scrollY - 20;
          cam.fadeIn(300);
        }
      });
    },
  });
}

// 계단 올라가기: 카메라가 위로 스크롤 후 페이드
export function playStairsAscendFX(
  scene: Phaser.Scene,
  onMidpoint: () => void,
): void {
  const cam = scene.cameras.main;
  scene.tweens.add({
    targets: cam,
    scrollY: cam.scrollY - 20,
    duration: 200,
    ease: 'Sine.easeIn',
    onComplete: () => {
      cam.fade(200, 0, 0, 0, false, (_: unknown, p: number) => {
        if (p === 1) {
          onMidpoint();
          cam.scrollY = cam.scrollY + 20;
          cam.fadeIn(300);
        }
      });
    },
  });
}
```

---

## 6. 목적지 도착 안내 텍스트

```typescript
export function showAreaNameBanner(
  scene: Phaser.Scene,
  areaName: string,
): void {
  const { width: W, height: H } = scene.scale;

  // 반투명 배경 패널
  const panel = scene.add
    .rectangle(W / 2, H * 0.15, W * 0.5, 36, 0x000000, 0.55)
    .setDepth(150)
    .setScrollFactor(0)
    .setAlpha(0);

  const txt = scene.add.text(W / 2, H * 0.15, areaName, {
    fontSize: '18px',
    fontFamily: '"Noto Sans KR", sans-serif',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 3,
  })
    .setOrigin(0.5)
    .setDepth(151)
    .setScrollFactor(0)
    .setAlpha(0);

  // 페이드 인 → 2초 유지 → 페이드 아웃
  scene.tweens.add({
    targets: [panel, txt],
    alpha: 1,
    duration: 400,
    ease: 'Sine.easeOut',
    onComplete: () => {
      scene.time.delayedCall(2000, () => {
        scene.tweens.add({
          targets: [panel, txt],
          alpha: 0,
          duration: 600,
          onComplete: () => { panel.destroy(); txt.destroy(); },
        });
      });
    },
  });

  // 위에서 살짝 내려오는 슬라이드
  panel.y = H * 0.15 - 12;
  txt.y   = H * 0.15 - 12;
  scene.tweens.add({
    targets: [panel, txt],
    y: H * 0.15,
    duration: 400,
    ease: 'Back.easeOut',
  });
}
```

---

## 7. 깊이(Depth) 테이블

| 레이어              | depth |
|---------------------|-------|
| 게임 오브젝트 최상  | ~100  |
| 발자국 잔상          | 50    |
| 링·파티클 이펙트     | 60–62 |
| 전환 오버레이        | 200   |
| 조리개 이펙트        | 201   |
| 지역명 배너          | 150   |

---

## 8. 이펙트 × 트리거 매핑 요약

| trigger           | out 이펙트        | in 이펙트          | 보조                         |
|-------------------|-------------------|--------------------|------------------------------|
| `door`            | fade              | fade               | playDoorExitTrail()          |
| `dungeon_enter`   | swipe_left        | swipe_right        | showAreaNameBanner()         |
| `dungeon_exit`    | swipe_right       | swipe_left         | showAreaNameBanner()         |
| `teleport`        | flash             | flash              | Leave/Arrive 링              |
| `portal_magic`    | dissolve          | dissolve           | playPortalEnterEffect()      |
| `water_surface`   | ripple(+ shake)   | fade               | —                            |
| `iris_door`       | iris              | iris               | —                            |
| `stairs_down`     | (내부 처리)       | (내부 처리)        | playStairsDescendFX()        |
| `stairs_up`       | (내부 처리)       | (내부 처리)        | playStairsAscendFX()         |
