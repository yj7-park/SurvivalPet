# Plan 69 — 저장·수리 비주얼 피드백

## 개요

자동저장 인디케이터, 저장 확인 연출, 수리 작업대 애니메이션,  
그리고 게임 로드 화면의 비주얼을 설계한다.  
플레이어에게 "지금 저장됐다", "수리 중이다"를 명확히 알려주는 시각적 피드백이 목적이다.

---

## 1. 자동저장 인디케이터

```typescript
// HUD 우하단 — scrollFactor 0, depth 85
class AutoSaveIndicator {
  private icon: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private spinAngle = 0;
  private state: 'idle' | 'saving' | 'done' = 'idle';

  constructor(scene: Phaser.Scene) {
    // 저장 아이콘: 원형 화살표 (두 호 + 화살촉)
    this.icon = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(85)
      .setAlpha(0);

    this.label = scene.add.text(
      scene.cameras.main.width - 16, scene.cameras.main.height - 12,
      '저장됨', { fontSize: '9px', color: '#88cc88', fontFamily: 'Courier New' }
    ).setOrigin(1, 1).setScrollFactor(0).setDepth(85).setAlpha(0);

    scene.events.on('update', this.update, this);
  }

  startSaving(): void {
    this.state = 'saving';
    this.icon.setAlpha(1);
    this.label.setAlpha(0);
  }

  doneSaving(): void {
    this.state = 'done';
    this.spinAngle = 0;

    // "저장됨" 텍스트 2초 표시 후 페이드아웃
    this.label.setAlpha(1);
    this.label.scene.tweens.add({
      targets: [this.label, this.icon],
      alpha: 0,
      delay: 2000,
      duration: 600,
      onComplete: () => { this.state = 'idle'; },
    });
  }

  private update(_time: number, delta: number): void {
    if (this.state !== 'saving') return;

    this.spinAngle += delta * 0.004;  // ~4 rad/s

    const cx = this.icon.scene.cameras.main.width - 28;
    const cy = this.icon.scene.cameras.main.height - 12;
    this.icon.clear();
    drawSaveSpinner(this.icon, cx, cy, 8, this.spinAngle);
  }
}

// 회전하는 저장 아이콘 (원형 점선 화살표)
function drawSaveSpinner(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  r: number,
  angle: number
): void {
  // 호 (270도)
  gfx.lineStyle(1.5, 0x88cc88, 0.9);
  gfx.beginPath();
  gfx.arc(cx, cy, r, angle, angle + Math.PI * 1.5, false);
  gfx.strokePath();

  // 화살촉
  const ax = cx + Math.cos(angle) * r;
  const ay = cy + Math.sin(angle) * r;
  const headAngle = angle - Math.PI / 2;
  gfx.fillStyle(0x88cc88, 0.9);
  gfx.fillTriangle(
    ax + Math.cos(headAngle) * 4, ay + Math.sin(headAngle) * 4,
    ax + Math.cos(headAngle + 2.4) * 3, ay + Math.sin(headAngle + 2.4) * 3,
    ax + Math.cos(headAngle - 2.4) * 3, ay + Math.sin(headAngle - 2.4) * 3
  );
}
```

---

## 2. 저장 확인 팝업 (수동 저장)

```typescript
function playSaveConfirmEffect(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;

  // 1. 화면 하단 중앙 슬라이드업 패널
  const panel = scene.add.graphics().setScrollFactor(0).setDepth(86);
  const txt = scene.add.text(
    cam.width / 2, cam.height + 24,
    '✓  게임이 저장되었습니다',
    {
      fontSize: '12px',
      color: '#ccffcc',
      fontFamily: 'Courier New',
      backgroundColor: '#1a3a1a',
      padding: { x: 16, y: 8 },
    }
  ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(86);

  // 초록 아웃라인
  const bounds = txt.getBounds();
  panel.lineStyle(1, 0x55aa55, 0.9);
  panel.strokeRoundedRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4, 6);

  // 슬라이드 업
  scene.tweens.add({
    targets: txt,
    y: cam.height - 28,
    duration: 300,
    ease: 'Back.easeOut',
  });

  // 2초 후 슬라이드 다운
  scene.time.delayedCall(2200, () => {
    scene.tweens.add({
      targets: [txt, panel],
      y: `+=${50}`,
      alpha: 0,
      duration: 300,
      ease: 'Quad.easeIn',
      onComplete: () => { txt.destroy(); panel.destroy(); },
    });
  });
}
```

---

## 3. 수리 작업대 애니메이션

### 3-1. 망치질 애니메이션

```typescript
class RepairAnimator {
  private hammerGfx: Phaser.GameObjects.Graphics;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private hitTimer?: Phaser.Time.TimerEvent;

  startRepair(scene: Phaser.Scene, benchX: number, benchY: number): void {
    this.hammerGfx = scene.add.graphics().setDepth(36);

    // 망치 스프라이트 (Graphics로 근사)
    this.drawHammer(0);

    // 0.6초마다 망치질
    this.hitTimer = scene.time.addEvent({
      delay: 600,
      loop: true,
      callback: () => this.strikeHammer(scene, benchX, benchY),
    });

    // 불꽃 파티클 (dormant)
    this.sparks = scene.add.particles(benchX, benchY - 4, '__DEFAULT', {
      speed: { min: 30, max: 90 },
      angle: { min: -120, max: -60 },
      scale: { start: 0.6, end: 0 },
      lifespan: 350,
      tint: [0xffaa00, 0xff6600, 0xffff66],
      blendMode: Phaser.BlendModes.ADD,
      frequency: -1,  // explode only
    }).setDepth(55);
  }

  private drawHammer(swingAngle: number): void {
    this.hammerGfx.clear();
    this.hammerGfx.save();

    // 손잡이
    this.hammerGfx.lineStyle(2, 0x8B6914, 1);
    const hx = this.benchX - 8;
    const hy = this.benchY - 24;
    this.hammerGfx.beginPath();
    this.hammerGfx.moveTo(hx, hy);
    this.hammerGfx.lineTo(hx + 10 * Math.cos(swingAngle), hy + 10 * Math.sin(swingAngle));
    this.hammerGfx.strokePath();

    // 해머 머리
    this.hammerGfx.fillStyle(0x777777, 1);
    this.hammerGfx.fillRect(hx + 8, hy - 3, 10, 6);

    this.hammerGfx.restore();
  }

  private benchX = 0; private benchY = 0;

  private strikeHammer(scene: Phaser.Scene, bx: number, by: number): void {
    this.benchX = bx; this.benchY = by;

    // 내려치기 → 올리기 트윈
    const obj = { angle: -Math.PI / 4 };
    scene.tweens.add({
      targets: obj,
      angle: Math.PI / 6,
      duration: 100,
      ease: 'Quad.easeIn',
      onUpdate: () => this.drawHammer(obj.angle),
      onComplete: () => {
        // 타격 이펙트
        this.sparks.explode(6);
        scene.cameras.main.shake(80, 0.003);

        // 올리기
        scene.tweens.add({
          targets: obj,
          angle: -Math.PI / 4,
          duration: 300,
          ease: 'Quad.easeOut',
          onUpdate: () => this.drawHammer(obj.angle),
        });
      },
    });
  }

  stopRepair(): void {
    this.hitTimer?.remove();
    this.sparks?.destroy();
    this.hammerGfx?.destroy();
  }
}
```

### 3-2. 수리 완료 이펙트

```typescript
function playRepairCompleteEffect(
  scene: Phaser.Scene,
  itemSprite: Phaser.GameObjects.Image
): void {
  // 1. 아이템 위 별 파티클 버스트
  const emitter = scene.add.particles(itemSprite.x, itemSprite.y, '__DEFAULT', {
    speed: { min: 40, max: 80 },
    scale: { start: 0.8, end: 0 },
    lifespan: 500,
    quantity: 10,
    tint: [0xffffff, 0x88ddff, 0xaaaaff],
    blendMode: Phaser.BlendModes.ADD,
  });
  emitter.explode(10);
  scene.time.delayedCall(600, () => emitter.destroy());

  // 2. 내구도 바 녹색 플래시
  flashDurabilityBar(itemSprite, 0x44ff44);

  // 3. 텍스트
  const txt = scene.add.text(itemSprite.x, itemSprite.y - 20, '수리 완료!',
    { fontSize: '11px', color: '#88ffaa', fontFamily: 'Courier New', fontStyle: 'bold' }
  ).setOrigin(0.5).setDepth(itemSprite.depth + 5);

  scene.tweens.add({
    targets: txt,
    y: itemSprite.y - 42,
    alpha: 0,
    duration: 800,
    ease: 'Quad.easeOut',
    onComplete: () => txt.destroy(),
  });
}
```

---

## 4. 로드 화면 비주얼

### 4-1. 진행 바 & 배경

```typescript
class LoadingScreen {
  private bg: Phaser.GameObjects.Rectangle;
  private bar: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private progress = 0;

  show(scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    // 배경
    this.bg = scene.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0a)
      .setScrollFactor(0).setDepth(200);

    // 게임 타이틀
    scene.add.text(W / 2, H * 0.38, 'BASECAMP',
      { fontSize: '28px', color: '#f0c030', fontFamily: 'Courier New', fontStyle: 'bold' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // 부제
    scene.add.text(W / 2, H * 0.38 + 32, 'Survival Simulation',
      { fontSize: '12px', color: '#888888', fontFamily: 'Courier New' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // 진행 바
    this.bar = scene.add.graphics().setScrollFactor(0).setDepth(201);
    this.updateBar(W, H);

    // 상태 텍스트
    this.label = scene.add.text(W / 2, H * 0.62 + 24, '로딩 중...',
      { fontSize: '10px', color: '#666666', fontFamily: 'Courier New' }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    // 로딩 스피너 (하단)
    this.startSpinner(scene, W / 2, H * 0.62 + 44);
  }

  setProgress(pct: number, statusText?: string): void {
    this.progress = pct;
    const W = this.bg.scene.cameras.main.width;
    const H = this.bg.scene.cameras.main.height;
    this.updateBar(W, H);
    if (statusText) this.label.setText(statusText);
  }

  private updateBar(W: number, H: number): void {
    const barW = W * 0.5;
    const barH = 6;
    const bx = (W - barW) / 2;
    const by = H * 0.62;

    this.bar.clear();

    // 트랙
    this.bar.fillStyle(0x222222, 1);
    this.bar.fillRoundedRect(bx, by, barW, barH, 3);

    // 채움 (gradient 효과: 밝기 단계)
    const filled = barW * this.progress;
    if (filled > 0) {
      this.bar.fillStyle(0xf0c030, 1);
      this.bar.fillRoundedRect(bx, by, filled, barH, 3);
      // 하이라이트
      this.bar.fillStyle(0xffffff, 0.25);
      this.bar.fillRect(bx + 2, by + 1, filled - 4, 2);
    }

    // 퍼센트
    this.bar.fillStyle(0x888888, 1);  // text는 Graphics로 못 그리므로 별도 Text 사용
  }

  private startSpinner(scene: Phaser.Scene, cx: number, cy: number): void {
    let angle = 0;
    const spinGfx = scene.add.graphics().setScrollFactor(0).setDepth(201);
    scene.events.on('update', (_t: number, delta: number) => {
      angle += delta * 0.004;
      spinGfx.clear();
      drawSaveSpinner(spinGfx, cx, cy, 6, angle);
    });
  }

  hide(): void {
    this.bg.scene.tweens.add({
      targets: [this.bg, this.bar, this.label],
      alpha: 0,
      duration: 400,
      onComplete: () => {
        this.bg.destroy(); this.bar.destroy(); this.label.destroy();
      },
    });
  }
}
```

### 4-2. 로드 완료 페이드인

```typescript
function playSceneEnterFade(scene: Phaser.Scene): void {
  // 블랙 오버레이 → 서서히 투명
  const overlay = scene.add.rectangle(
    scene.cameras.main.scrollX + scene.cameras.main.width / 2,
    scene.cameras.main.scrollY + scene.cameras.main.height / 2,
    scene.cameras.main.width,
    scene.cameras.main.height,
    0x000000, 1
  ).setScrollFactor(0).setDepth(195);

  scene.tweens.add({
    targets: overlay,
    alpha: 0,
    duration: 700,
    ease: 'Quad.easeOut',
    onComplete: () => overlay.destroy(),
  });
}
```

---

## 5. 데이터 손상 경고 비주얼

저장 데이터 로드 실패 시:

```typescript
function showSaveCorruptWarning(scene: Phaser.Scene): void {
  const W = scene.cameras.main.width;
  const H = scene.cameras.main.height;

  // 반투명 빨간 패널
  const panel = scene.add.graphics().setScrollFactor(0).setDepth(200);
  panel.fillStyle(0x3a0000, 0.9);
  panel.fillRoundedRect(W / 2 - 160, H / 2 - 50, 320, 100, 8);
  panel.lineStyle(2, 0xff4444, 1);
  panel.strokeRoundedRect(W / 2 - 160, H / 2 - 50, 320, 100, 8);

  scene.add.text(W / 2, H / 2 - 22, '⚠ 저장 데이터 손상',
    { fontSize: '14px', color: '#ff6666', fontFamily: 'Courier New', fontStyle: 'bold' }
  ).setOrigin(0.5).setScrollFactor(0).setDepth(201);

  scene.add.text(W / 2, H / 2 + 4, '새 게임으로 시작합니다.',
    { fontSize: '11px', color: '#cccccc', fontFamily: 'Courier New' }
  ).setOrigin(0.5).setScrollFactor(0).setDepth(201);

  // 3초 후 자동 제거
  scene.time.delayedCall(3000, () => {
    scene.tweens.add({
      targets: [panel],
      alpha: 0,
      duration: 400,
    });
  });
}
```

---

## 6. 깊이(Depth) 테이블

| 요소 | Depth | 비고 |
|------|-------|------|
| 수리 망치 그래픽 | 36 | 캐릭터(35) 위 |
| 수리 불꽃 파티클 | 55 | |
| 자동저장 인디케이터 | 85 | HUD 상단 |
| 저장 확인 패널 | 86 | |
| 로드 화면 오버레이 | 200 | 최상위 |
| 로드 화면 UI 요소 | 201 | |
| 씬 진입 페이드 | 195 | 로드 화면 뒤 |

---

## 7. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/ui/AutoSaveIndicator.ts` | 자동저장 스피너 + 완료 표시 |
| `src/ui/LoadingScreen.ts` | 로드 화면 진행 바 + 페이드인 |
| `src/fx/RepairAnimator.ts` | 망치질 + 불꽃 + 완료 이펙트 |
| `src/ui/SaveFeedback.ts` | 수동 저장 팝업, 손상 경고 |

---

## 8. 버전

`v0.69.0`
