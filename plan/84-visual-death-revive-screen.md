# Plan 84 — 사망·부활 화면 비주얼

## 목표
플레이어 사망 시 화면 연출(빨간 비네팅·슬로우모션·데스 스크린),
부활 선택 UI, 유령 모드 오버레이, 부활 이펙트를 구현한다.

## 버전
`v0.84.0`

## 대상 파일
- `src/rendering/DeathVisualFX.ts` (신규)
- `src/ui/DeathReviveScreen.ts` (신규)

---

## 1. 사망 순간 연출

```typescript
// src/rendering/DeathVisualFX.ts

/** 사망 직전: 붉은 비네팅 + 슬로우모션 효과 */
export function playDeathMomentFX(
  scene: Phaser.Scene,
  onComplete: () => void,
): void {
  const { width: W, height: H } = scene.scale;

  // ── 1) 붉은 비네팅 오버레이 ──────────────────────────────
  const vignette = scene.add.graphics().setDepth(210).setScrollFactor(0);
  const drawVignette = (alpha: number) => {
    vignette.clear();
    // 4방향 그라데이션 사각형으로 비네팅 근사
    vignette.fillGradientStyle(0xff0000, 0xff0000, 0x000000, 0x000000, alpha, alpha, 0, 0);
    vignette.fillRect(0, 0, W, H * 0.35);
    vignette.fillGradientStyle(0x000000, 0x000000, 0xff0000, 0xff0000, 0, 0, alpha, alpha);
    vignette.fillRect(0, H * 0.65, W, H * 0.35);
    vignette.fillGradientStyle(0xff0000, 0x000000, 0x000000, 0xff0000, alpha, 0, 0, alpha);
    vignette.fillRect(0, 0, W * 0.25, H);
    vignette.fillGradientStyle(0x000000, 0xff0000, 0xff0000, 0x000000, 0, alpha, alpha, 0);
    vignette.fillRect(W * 0.75, 0, W * 0.25, H);
  };

  // 비네팅 페이드 인
  const t = { alpha: 0 };
  scene.tweens.add({
    targets: t,
    alpha: 0.55,
    duration: 300,
    ease: 'Sine.easeIn',
    onUpdate: () => drawVignette(t.alpha),
  });

  // ── 2) 슬로우모션: Phaser timeScale 감소 ─────────────────
  scene.time.timeScale = 1;
  scene.tweens.add({
    targets: scene.time,
    timeScale: 0.15,
    duration: 250,
    ease: 'Expo.easeOut',
  });

  // ── 3) 0.8초 후 화면 블랙아웃 ────────────────────────────
  scene.time.delayedCall(800, () => {
    // timeScale 복원
    scene.tweens.add({ targets: scene.time, timeScale: 1, duration: 100 });

    const blackout = scene.add.graphics()
      .fillStyle(0x000000, 0)
      .fillRect(0, 0, W, H)
      .setDepth(211).setScrollFactor(0);

    scene.tweens.add({
      targets: blackout,
      alpha: 1,
      duration: 500,
      ease: 'Linear',
      onComplete: () => {
        vignette.destroy();
        blackout.setAlpha(1);
        onComplete();
      },
    });
  });
}

/** 유령 모드 오버레이 (화면 전체 흑백 + 반투명) */
export function applyGhostOverlay(
  scene: Phaser.Scene,
): Phaser.GameObjects.Graphics {
  const { width: W, height: H } = scene.scale;

  // 카메라에 흑백 후처리가 없으므로 반투명 파란 오버레이로 근사
  const overlay = scene.add.graphics()
    .fillStyle(0x223355, 0.35)
    .fillRect(0, 0, W, H)
    .setDepth(5).setScrollFactor(0);

  // 느린 맥동
  scene.tweens.add({
    targets: overlay,
    alpha: 0.2,
    yoyo: true, repeat: -1,
    duration: 2000,
    ease: 'Sine.easeInOut',
  });

  return overlay;
}

/** 부활 이펙트 */
export function playReviveFX(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  onComplete: () => void,
): void {
  const { width: W, height: H } = scene.scale;

  // 화면 화이트아웃에서 페이드
  const whiteout = scene.add.graphics()
    .fillStyle(0xffffff, 1)
    .fillRect(0, 0, W, H)
    .setDepth(212).setScrollFactor(0);

  scene.tweens.add({
    targets: whiteout,
    alpha: 0,
    duration: 800,
    ease: 'Expo.easeOut',
    onComplete: () => whiteout.destroy(),
  });

  // 부활 지점 황금 기둥 (아래→위 링 3개)
  for (let i = 0; i < 5; i++) {
    const ring = scene.add.graphics()
      .lineStyle(3, 0xffdd44, 0.9)
      .strokeCircle(worldX, worldY, 24)
      .setDepth(80);

    scene.tweens.add({
      targets: ring,
      y: worldY - 60 - i * 20,
      scaleX: 0.3, scaleY: 0.3,
      alpha: 0,
      duration: 600,
      delay: i * 80,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  // 빛 기둥 (세로 선)
  const pillar = scene.add.graphics()
    .fillStyle(0xffeeaa, 0.6)
    .fillRect(worldX - 4, worldY - 80, 8, 80)
    .setDepth(79);

  scene.tweens.add({
    targets: pillar,
    alpha: 0,
    scaleY: 2,
    duration: 700,
    ease: 'Sine.easeOut',
    onComplete: () => { pillar.destroy(); onComplete(); },
  });

  // 파티클 흩뿌림
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const p = scene.add.graphics()
      .fillStyle(0xffdd44, 0.9)
      .fillCircle(0, 0, 3)
      .setPosition(worldX, worldY)
      .setDepth(81);

    scene.tweens.add({
      targets: p,
      x: worldX + Math.cos(angle) * 50,
      y: worldY + Math.sin(angle) * 50 - 30,
      alpha: 0,
      duration: 500,
      delay: i * 20,
      ease: 'Sine.easeOut',
      onComplete: () => p.destroy(),
    });
  }
}
```

---

## 2. 데스·부활 선택 스크린

```typescript
// src/ui/DeathReviveScreen.ts

export interface ReviveOption {
  label: string;
  subLabel: string;   // 비용/조건
  cost?: number;      // 골드
  disabled?: boolean;
  action: () => void;
}

export class DeathReviveScreen {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private _countdownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(
    cause: string,          // 사망 원인 텍스트
    survivalTime: string,   // 생존 시간 (예: '2일 14시간')
    options: ReviveOption[],
    autoRespawnSec = 30,
  ): void {
    this._build(cause, survivalTime, options, autoRespawnSec);

    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 600,
      ease: 'Linear',
    });
  }

  private _build(
    cause: string, survivalTime: string,
    options: ReviveOption[], autoSec: number,
  ): void {
    const { width: W, height: H } = this.scene.scale;

    // 어두운 배경
    const bg = this.scene.add.graphics()
      .fillStyle(0x000000, 0.88)
      .fillRect(0, 0, W, H);

    // ── 사망 텍스트 ──────────────────────────────────────────
    const deadTitle = this.scene.add.text(W / 2, H * 0.2, '사망', {
      fontSize: '52px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#cc2222', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    const causeText = this.scene.add.text(W / 2, H * 0.2 + 58, cause, {
      fontSize: '16px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#888888',
    }).setOrigin(0.5);

    const survText = this.scene.add.text(W / 2, H * 0.2 + 82, `생존 시간: ${survivalTime}`, {
      fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#556677',
    }).setOrigin(0.5);

    // ── 혈흔 장식 (랜덤 흩뿌림) ─────────────────────────────
    const bloodGfx = this.scene.add.graphics();
    for (let i = 0; i < 8; i++) {
      const bx = W * (0.1 + Math.random() * 0.8);
      const by = H * (0.1 + Math.random() * 0.5);
      const br = 4 + Math.random() * 10;
      bloodGfx.fillStyle(0x660000, 0.3 + Math.random() * 0.3)
        .fillEllipse(bx, by, br * 2, br);
    }

    // ── 부활 옵션 버튼 ────────────────────────────────────────
    const BTN_W = 240, BTN_H = 52, BTN_GAP = 12;
    const totalH = options.length * (BTN_H + BTN_GAP);
    const startY = H * 0.52;

    const btnContainers = options.map((opt, i) => {
      const by = startY + i * (BTN_H + BTN_GAP);
      const isDisabled = opt.disabled ?? false;
      const borderColor = isDisabled ? 0x333344 : 0x4455aa;
      const bgColor     = isDisabled ? 0x111118 : 0x1a1a2e;

      const btnBg = this.scene.add.graphics()
        .fillStyle(bgColor, 0.95)
        .fillRoundedRect(0, 0, BTN_W, BTN_H, 6)
        .lineStyle(1.5, borderColor, 1)
        .strokeRoundedRect(0, 0, BTN_W, BTN_H, 6);

      const labelTxt = this.scene.add.text(BTN_W / 2, 14, opt.label, {
        fontSize: '15px', fontFamily: '"Noto Sans KR", sans-serif',
        color: isDisabled ? '#444455' : '#ddddff',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const subTxt = this.scene.add.text(BTN_W / 2, 33, opt.subLabel, {
        fontSize: '11px', fontFamily: '"Noto Sans KR", sans-serif',
        color: isDisabled ? '#333344' : '#778899',
      }).setOrigin(0.5);

      // 골드 비용 표시
      if (opt.cost !== undefined && !isDisabled) {
        const costTxt = this.scene.add.text(BTN_W - 8, BTN_H / 2, `💰${opt.cost}G`, {
          fontSize: '11px', fontFamily: 'monospace',
          color: '#ffcc44',
        }).setOrigin(1, 0.5);
        // (costTxt는 btn container에 포함)
      }

      const btnCont = this.scene.add.container(
        W / 2 - BTN_W / 2, by, [btnBg, labelTxt, subTxt],
      );

      if (!isDisabled) {
        btnBg.setInteractive(
          new Phaser.Geom.Rectangle(0, 0, BTN_W, BTN_H),
          Phaser.Geom.Rectangle.Contains,
        );
        btnBg.on('pointerover', () => {
          btnBg.clear()
            .fillStyle(0x2a2a4e, 0.98)
            .fillRoundedRect(0, 0, BTN_W, BTN_H, 6)
            .lineStyle(2, 0x8899ff, 1)
            .strokeRoundedRect(0, 0, BTN_W, BTN_H, 6);
          this.scene.tweens.add({ targets: btnCont, scaleX: 1.02, scaleY: 1.02, duration: 60 });
        });
        btnBg.on('pointerout', () => {
          btnBg.clear()
            .fillStyle(bgColor, 0.95)
            .fillRoundedRect(0, 0, BTN_W, BTN_H, 6)
            .lineStyle(1.5, borderColor, 1)
            .strokeRoundedRect(0, 0, BTN_W, BTN_H, 6);
          this.scene.tweens.add({ targets: btnCont, scaleX: 1, scaleY: 1, duration: 60 });
        });
        btnBg.on('pointerdown', () => {
          this.hide();
          opt.action();
        });
      }

      return btnCont;
    });

    // ── 자동 리스폰 카운트다운 ─────────────────────────────────
    let remaining = autoSec;
    const countdownTxt = this.scene.add.text(W / 2, H * 0.88,
      `${remaining}초 후 자동 리스폰`, {
      fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#445566',
    }).setOrigin(0.5);

    this._countdownTimer = setInterval(() => {
      remaining--;
      countdownTxt.setText(`${remaining}초 후 자동 리스폰`);
      if (remaining <= 0) {
        this._clearCountdown();
        this.hide();
        options[options.length - 1]?.action();  // 마지막 옵션 = 기본 리스폰
      }
    }, 1000);

    this.container = this.scene.add.container(0, 0, [
      bg, bloodGfx, deadTitle, causeText, survText,
      ...btnContainers, countdownTxt,
    ]).setDepth(215).setScrollFactor(0);
  }

  private _clearCountdown(): void {
    if (this._countdownTimer !== null) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  }

  hide(): void {
    this._clearCountdown();
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 300,
      onComplete: () => this.container?.destroy(),
    });
  }

  destroy(): void {
    this._clearCountdown();
    this.container?.destroy();
  }
}
```

---

## 3. 낮은 체력 경고 비네팅 (상시)

```typescript
// src/rendering/DeathVisualFX.ts (추가)

export class LowHpVignette {
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private pulseTween: Phaser.Tweens.Tween;
  private active = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width: W, height: H } = scene.scale;
    this.gfx = scene.add.graphics().setDepth(8).setScrollFactor(0);

    this.pulseTween = scene.tweens.add({
      targets: {},
      progress: { from: 0, to: 1 },
      yoyo: true, repeat: -1,
      duration: 600,
      ease: 'Sine.easeInOut',
      paused: true,
      onUpdate: (_: unknown, p: number) => {
        if (!this.active) return;
        const a = Phaser.Math.Linear(0.08, 0.28, p);
        this.gfx.clear();
        this.gfx.fillGradientStyle(0xff0000, 0xff0000, 0x000000, 0x000000, a, a, 0, 0);
        this.gfx.fillRect(0, 0, W, H * 0.3);
        this.gfx.fillGradientStyle(0x000000, 0x000000, 0xff0000, 0xff0000, 0, 0, a, a);
        this.gfx.fillRect(0, H * 0.7, W, H * 0.3);
      },
    });
  }

  /** hpRatio: 0~1 */
  update(hpRatio: number): void {
    if (hpRatio <= 0.2 && !this.active) {
      this.active = true;
      this.pulseTween.resume();
    } else if (hpRatio > 0.2 && this.active) {
      this.active = false;
      this.pulseTween.pause();
      this.gfx.clear();
    }
  }

  destroy(): void {
    this.pulseTween.stop();
    this.gfx.destroy();
  }
}
```

---

## 4. 깊이(Depth) 테이블

| 레이어              | depth |
|---------------------|-------|
| 저체력 비네팅        | 8     |
| 부활 파티클·기둥     | 79–81 |
| 사망 비네팅          | 210   |
| 블랙아웃             | 211   |
| 화이트아웃(부활)     | 212   |
| 데스 스크린          | 215   |
