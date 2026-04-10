# Plan 85 — 보스 인트로·전투 연출

## 목표
보스 등장 시 인트로 컷신(카메라 줌·텍스트 연출), 보스 전용 체력바 UI,
특수 공격 경고 이펙트, 처치 연출을 구현한다.

## 버전
`v0.85.0`

## 대상 파일
- `src/rendering/BossIntroFX.ts` (신규)
- `src/ui/BossHealthBar.ts` (신규)

---

## 1. 보스 인트로 연출

```typescript
// src/rendering/BossIntroFX.ts

export interface BossData {
  name: string;
  subTitle: string;   // 예: '숲의 수호자'
  nameColor: number;  // 이름 색상
  worldX: number;
  worldY: number;
}

export function playBossIntro(
  scene: Phaser.Scene,
  boss: BossData,
  onComplete: () => void,
): void {
  const { width: W, height: H } = scene.scale;
  const cam = scene.cameras.main;

  // ── 1) 화면 어두워짐 (0.5초) ───────────────────────────────
  cam.flash(200, 0, 0, 0);  // 검은 플래시 → 어두워지는 효과 근사

  const dimOverlay = scene.add.graphics()
    .fillStyle(0x000000, 0)
    .fillRect(0, 0, W, H)
    .setDepth(220).setScrollFactor(0);

  scene.tweens.add({
    targets: dimOverlay,
    alpha: 0.75,
    duration: 400,
    ease: 'Sine.easeIn',
  });

  // ── 2) 카메라가 보스 위치로 이동 + 줌인 (1초) ───────────────
  scene.time.delayedCall(300, () => {
    cam.pan(boss.worldX, boss.worldY, 900, 'Sine.easeInOut');
    cam.zoomTo(1.6, 900, 'Sine.easeInOut');
  });

  // ── 3) 보스 이름 텍스트 등장 (1.2초 후) ─────────────────────
  scene.time.delayedCall(1200, () => {
    _showBossNameCard(scene, boss, W, H);
  });

  // ── 4) 경고 깜빡임 + 굉음 연출 (2.0초 후) ──────────────────
  scene.time.delayedCall(2000, () => {
    cam.shake(400, 0.012);

    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(i * 120, () => {
        cam.flash(80, 255, 50, 0);  // 주황 플래시
      });
    }
  });

  // ── 5) 카메라 복귀 + 줌 원복 (3.0초 후) ────────────────────
  scene.time.delayedCall(3000, () => {
    cam.zoomTo(1.0, 600, 'Sine.easeInOut');
    // 카메라는 플레이어 추적으로 자동 복귀

    scene.tweens.add({
      targets: dimOverlay,
      alpha: 0,
      duration: 400,
      onComplete: () => dimOverlay.destroy(),
    });
  });

  // ── 6) 완료 콜백 (3.8초 후) ──────────────────────────────────
  scene.time.delayedCall(3800, onComplete);
}

function _showBossNameCard(
  scene: Phaser.Scene,
  boss: BossData,
  W: number,
  H: number,
): void {
  // 좌우 검은 바
  const barL = scene.add.rectangle(-W * 0.25, H / 2, W * 0.5, 80, 0x000000, 0.9)
    .setDepth(221).setScrollFactor(0);
  const barR = scene.add.rectangle(W * 1.25, H / 2, W * 0.5, 80, 0x000000, 0.9)
    .setDepth(221).setScrollFactor(0);

  // 바 슬라이드 인
  scene.tweens.add({ targets: barL, x: W * 0.25,  duration: 300, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: barR, x: W * 0.75,  duration: 300, ease: 'Cubic.easeOut' });

  // 보스 이름 (중앙에서 펀치 스케일)
  const nameColor = Phaser.Display.Color.IntegerToColor(boss.nameColor).rgba;
  const nameTxt = scene.add.text(W / 2, H / 2 - 12, boss.name, {
    fontSize: '32px', fontFamily: '"Noto Sans KR", sans-serif',
    color: nameColor, fontStyle: 'bold',
    stroke: '#000000', strokeThickness: 5,
  }).setOrigin(0.5).setDepth(222).setScrollFactor(0).setScale(0.3).setAlpha(0);

  scene.tweens.add({
    targets: nameTxt,
    scaleX: 1, scaleY: 1, alpha: 1,
    duration: 280, ease: 'Back.easeOut',
    delay: 280,
  });

  // 부제목
  const subTxt = scene.add.text(W / 2, H / 2 + 18, boss.subTitle, {
    fontSize: '14px', fontFamily: '"Noto Sans KR", sans-serif',
    color: '#aaaaaa',
    letterSpacing: 4,
  }).setOrigin(0.5).setDepth(222).setScrollFactor(0).setAlpha(0);

  scene.tweens.add({ targets: subTxt, alpha: 1, duration: 300, delay: 450 });

  // 장식 선 (이름 아래 위)
  const lineL = scene.add.graphics()
    .lineStyle(1, boss.nameColor, 0.7)
    .strokeLineShape(new Phaser.Geom.Line(W / 2, H / 2 - 28, W / 2, H / 2 - 28))
    .setDepth(222).setScrollFactor(0);
  scene.tweens.add({
    targets: {},
    progress: { from: 0, to: 1 },
    duration: 300, delay: 500,
    onUpdate: (_: unknown, p: number) => {
      const len = p * 120;
      lineL.clear()
        .lineStyle(1, boss.nameColor, 0.7)
        .strokeLineShape(new Phaser.Geom.Line(W / 2 - len, H / 2 - 28, W / 2 + len, H / 2 - 28))
        .strokeLineShape(new Phaser.Geom.Line(W / 2 - len, H / 2 + 32, W / 2 + len, H / 2 + 32));
    },
  });

  // 1.5초 후 페이드 아웃
  scene.time.delayedCall(1600, () => {
    scene.tweens.add({
      targets: [barL, barR, nameTxt, subTxt, lineL],
      alpha: 0,
      duration: 300,
      onComplete: () => [barL, barR, nameTxt, subTxt, lineL].forEach(o => o.destroy()),
    });
  });
}
```

---

## 2. 보스 체력바 UI

```typescript
// src/ui/BossHealthBar.ts

export class BossHealthBar {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private fillGfx!: Phaser.GameObjects.Graphics;
  private rageFillGfx!: Phaser.GameObjects.Graphics;  // 분노 게이지
  private nameTxt!: Phaser.GameObjects.Text;
  private hpTxt!: Phaser.GameObjects.Text;
  private currentHp = 0;
  private maxHp = 0;
  private phaseThresholds: number[] = [];  // 페이즈 전환 HP (예: [0.5, 0.25])

  private readonly BAR_W = 480;
  private readonly BAR_H = 18;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._build();
  }

  private _build(): void {
    const { width: W } = this.scene.scale;
    const cx = (W - this.BAR_W) / 2;
    const cy = 12;

    // 배경
    const bg = this.scene.add.graphics()
      .fillStyle(0x0a0a1a, 0.95)
      .fillRoundedRect(0, 0, this.BAR_W, this.BAR_H + 30, 5)
      .lineStyle(1, 0x334455, 0.8)
      .strokeRoundedRect(0, 0, this.BAR_W, this.BAR_H + 30, 5);

    // HP 바 배경
    const barBg = this.scene.add.graphics()
      .fillStyle(0x221122, 1)
      .fillRoundedRect(8, 22, this.BAR_W - 16, this.BAR_H, 3);

    // HP 바 채움
    this.fillGfx = this.scene.add.graphics().setDepth(1);

    // 분노 게이지 (가늘게, 상단)
    this.rageFillGfx = this.scene.add.graphics().setDepth(1);

    // 보스 이름
    this.nameTxt = this.scene.add.text(this.BAR_W / 2, 10, '', {
      fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#ddaaff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // HP 텍스트 (우측)
    this.hpTxt = this.scene.add.text(this.BAR_W - 10, 24, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(1, 0);

    this.container = this.scene.add.container(cx, cy, [
      bg, barBg, this.fillGfx, this.rageFillGfx, this.nameTxt, this.hpTxt,
    ]).setDepth(175).setScrollFactor(0).setAlpha(0);
  }

  show(bossName: string, hp: number, maxHp: number, phases: number[] = []): void {
    this.nameTxt.setText(bossName);
    this.maxHp = maxHp;
    this.phaseThresholds = phases;
    this.setHp(hp);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      y: 12,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  setHp(hp: number): void {
    const prevRatio = this.currentHp / this.maxHp;
    const newRatio  = hp / this.maxHp;
    this.currentHp  = hp;

    const BW = this.BAR_W - 16;

    // HP 바 색상 (HP에 따라 변화)
    const barColor = newRatio > 0.5 ? 0xcc2244
                   : newRatio > 0.25 ? 0xff4400
                   : 0xff2200;

    this.fillGfx.clear()
      .fillStyle(barColor, 1)
      .fillRoundedRect(8, 22, BW * newRatio, this.BAR_H, 3);

    // HP 감소 연출: 이전 값에서 흰 잔상이 천천히 따라옴
    if (prevRatio > newRatio) {
      const ghostGfx = this.scene.add.graphics()
        .fillStyle(0xffffff, 0.4)
        .fillRoundedRect(8 + BW * newRatio, 22, BW * (prevRatio - newRatio), this.BAR_H, 3)
        .setDepth(2)
        .setScrollFactor(0);
      this.container.add(ghostGfx);

      this.scene.tweens.add({
        targets: ghostGfx,
        scaleX: 0,
        duration: 600,
        ease: 'Sine.easeIn',
        onComplete: () => { this.container.remove(ghostGfx, true); },
      });
    }

    this.hpTxt.setText(`${hp} / ${this.maxHp}`);

    // 페이즈 전환 선
    this.fillGfx.lineStyle(1.5, 0x555566, 0.8);
    this.phaseThresholds.forEach(t => {
      const lx = 8 + BW * t;
      this.fillGfx.strokeLineShape(new Phaser.Geom.Line(lx, 22, lx, 22 + this.BAR_H));
    });
  }

  /** 보스 분노 상태 강조 (바 테두리 맥동) */
  playEnrageEffect(): void {
    const container = this.container;
    this.scene.tweens.add({
      targets: container,
      x: container.x + 3,
      yoyo: true, repeat: 5,
      duration: 40,
      ease: 'Linear',
      onComplete: () => {
        // 바 테두리를 빨간색으로 변경
        // (build에서 bg Graphics 참조 필요 — 생략 처리)
      },
    });
  }

  /** 페이즈 전환 시 바 전체 플래시 */
  playPhaseTransition(nextPhaseColor: number): void {
    const flash = this.scene.add.graphics()
      .fillStyle(nextPhaseColor, 0.8)
      .fillRoundedRect(8, 22, this.BAR_W - 16, this.BAR_H, 3)
      .setDepth(3).setScrollFactor(0);
    this.container.add(flash);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 600,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.container.remove(flash, true),
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: this.container.y - 10,
      duration: 400,
    });
  }

  destroy(): void { this.container.destroy(); }
}
```

---

## 3. 보스 특수 공격 경고 이펙트

```typescript
// src/rendering/BossIntroFX.ts (추가)

/** 광역 공격 경고 원 */
export function showAoeWarning(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  radius: number,
  delayMs: number,
  onFire: () => void,
): void {
  const gfx = scene.add.graphics().setDepth(55);
  const startTime = Date.now();

  // 깜빡이는 위험 원
  const updateFn = () => {
    const elapsed = Date.now() - startTime;
    const t = elapsed / delayMs;
    const blink = Math.sin(t * Math.PI * (4 + t * 6)) > 0;  // 점점 빠르게 깜빡임
    const alpha  = blink ? Phaser.Math.Linear(0.3, 0.7, t) : 0;

    gfx.clear();
    gfx.lineStyle(2, 0xff2200, alpha)
       .strokeCircle(worldX, worldY, radius);
    gfx.fillStyle(0xff2200, alpha * 0.15)
       .fillCircle(worldX, worldY, radius);
  };

  scene.events.on('update', updateFn);

  scene.time.delayedCall(delayMs, () => {
    scene.events.off('update', updateFn);
    gfx.destroy();
    onFire();

    // 폭발 이펙트
    const boom = scene.add.graphics()
      .fillStyle(0xff4400, 0.7)
      .fillCircle(worldX, worldY, radius)
      .setDepth(56);
    scene.tweens.add({
      targets: boom,
      scaleX: 1.4, scaleY: 1.4, alpha: 0,
      duration: 300,
      ease: 'Expo.easeOut',
      onComplete: () => boom.destroy(),
    });
  });
}

/** 레이저 빔 경고 선 */
export function showLaserWarning(
  scene: Phaser.Scene,
  x1: number, y1: number,
  x2: number, y2: number,
  delayMs: number,
  onFire: () => void,
): void {
  const gfx = scene.add.graphics().setDepth(55);
  const startTime = Date.now();

  const updateFn = () => {
    const t = (Date.now() - startTime) / delayMs;
    const blink = Math.sin(t * Math.PI * (3 + t * 8)) > 0;
    gfx.clear();
    if (blink) {
      gfx.lineStyle(Phaser.Math.Linear(1, 4, t), 0xff4400, Phaser.Math.Linear(0.4, 1, t));
      gfx.strokeLineShape(new Phaser.Geom.Line(x1, y1, x2, y2));
    }
  };

  scene.events.on('update', updateFn);
  scene.time.delayedCall(delayMs, () => {
    scene.events.off('update', updateFn);
    gfx.destroy();
    onFire();
  });
}
```

---

## 4. 보스 처치 연출

```typescript
export function playBossDeathFX(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  onComplete: () => void,
): void {
  const { width: W, height: H } = scene.scale;

  // 연속 폭발 5회
  for (let i = 0; i < 5; i++) {
    scene.time.delayedCall(i * 180, () => {
      const ex = worldX + Phaser.Math.Between(-40, 40);
      const ey = worldY + Phaser.Math.Between(-40, 40);
      const boom = scene.add.graphics()
        .fillStyle(0xff6622, 0.9)
        .fillCircle(ex, ey, 20 + i * 5)
        .setDepth(85);
      scene.tweens.add({
        targets: boom,
        scaleX: 2 + i, scaleY: 2 + i, alpha: 0,
        duration: 400,
        onComplete: () => boom.destroy(),
      });
      scene.cameras.main.shake(100, 0.006 + i * 0.002);
    });
  }

  // 최종 대폭발 (1초 후)
  scene.time.delayedCall(1000, () => {
    const W2 = W, H2 = H;
    const finalFlash = scene.add.graphics()
      .fillStyle(0xffffff, 1).fillRect(0, 0, W2, H2)
      .setDepth(220).setScrollFactor(0);
    scene.cameras.main.shake(500, 0.018);

    scene.tweens.add({
      targets: finalFlash,
      alpha: 0,
      duration: 800,
      ease: 'Expo.easeOut',
      onComplete: () => { finalFlash.destroy(); onComplete(); },
    });

    // 보상 드롭 파티클 (금색)
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const p = scene.add.graphics()
        .fillStyle(0xffcc22, 0.9)
        .fillCircle(0, 0, 4)
        .setPosition(worldX, worldY).setDepth(86);
      scene.tweens.add({
        targets: p,
        x: worldX + Math.cos(angle) * (60 + Phaser.Math.Between(0, 40)),
        y: worldY + Math.sin(angle) * (60 + Phaser.Math.Between(0, 40)),
        alpha: 0,
        duration: 700,
        delay: 900 + i * 20,
        ease: 'Sine.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  });
}
```

---

## 5. 깊이(Depth) 테이블

| 레이어                  | depth |
|-------------------------|-------|
| AoE 경고 원·레이저       | 55    |
| 보스 폭발 파티클         | 85–86 |
| 보스 체력바              | 175   |
| 인트로 오버레이          | 220   |
| 인트로 이름 카드         | 221–222 |
