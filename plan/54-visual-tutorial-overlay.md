# Plan 54 — 튜토리얼 비주얼 오버레이 (Visual Tutorial Overlay)

## 개요

plan 29(튜토리얼 스텝 로직)에서 정의된 10단계 튜토리얼에  
시각적 안내 요소를 추가한다.  
배경 딤(dim) 오버레이, 스포트라이트 하이라이트, 방향 화살표 포인터,  
말풍선 안내 패널, 키 아이콘, 진행 표시 도트를 설계한다.

---

## 1. 딤 오버레이 + 스포트라이트 (`TutorialSpotlight`)

### 1-1. 스포트라이트 방식

화면 전체를 반투명 어두운 오버레이로 덮고,  
강조할 영역(UI 요소 또는 월드 오브젝트)만 원형/사각형으로 구멍을 낸다.

```typescript
interface SpotlightTarget {
  type: 'rect' | 'circle' | 'world';
  // 'rect'/'circle': ScrollFactor 0 기준 화면 좌표
  // 'world': 월드 좌표 → 카메라 변환으로 화면 좌표 계산
  x: number;
  y: number;
  w?: number;   // rect용
  h?: number;
  r?: number;   // circle용
  padding?: number;  // 기본 8px
}

class TutorialSpotlight {
  private dimRt: Phaser.GameObjects.RenderTexture;
  private currentTarget: SpotlightTarget | null = null;

  show(target: SpotlightTarget | null, dimAlpha = 0.72): void {
    const { width: W, height: H } = scene.cameras.main;
    this.dimRt.clear();

    // 전체 딤
    const dimGfx = scene.make.graphics({ add: false });
    dimGfx.fillStyle(0x000000, dimAlpha);
    dimGfx.fillRect(0, 0, W, H);
    this.dimRt.draw(dimGfx, 0, 0);
    dimGfx.destroy();

    if (!target) return;

    const pad = target.padding ?? 8;
    const eraseGfx = scene.make.graphics({ add: false });
    eraseGfx.fillStyle(0x000000, 1.0);

    if (target.type === 'rect') {
      // 모서리 라운드 사각형 구멍
      eraseGfx.fillRoundedRect(
        target.x - pad, target.y - pad,
        (target.w ?? 100) + pad * 2,
        (target.h ?? 40) + pad * 2,
        6
      );
    } else {
      // 원형 구멍
      const r = (target.r ?? 40) + pad;
      eraseGfx.fillCircle(target.x, target.y, r);
    }
    this.dimRt.erase(eraseGfx, 0, 0);
    eraseGfx.destroy();

    // 스포트라이트 테두리 (황금색 점선 효과)
    this.drawSpotlightBorder(target, pad);
  }

  // 스포트라이트 입장 tween: dimAlpha 0 → 0.72 (0.3s)
  fadeIn(target: SpotlightTarget): void {
    this.dimRt.setAlpha(0);
    this.show(target);
    scene.tweens.add({
      targets: this.dimRt, alpha: 1,
      duration: 300, ease: 'Quad.easeOut'
    });
  }

  // 다른 스포트라이트로 이동: 현재 구멍을 닫고 새 위치로 이동 (0.25s)
  moveTo(newTarget: SpotlightTarget): void {
    scene.tweens.add({
      targets: this.dimRt, alpha: 0,
      duration: 150,
      onComplete: () => {
        this.show(newTarget);
        scene.tweens.add({
          targets: this.dimRt, alpha: 1, duration: 150
        });
      }
    });
  }

  private drawSpotlightBorder(target: SpotlightTarget, pad: number): void {
    const borderGfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(119);
    borderGfx.lineStyle(2, 0xf0c030, 0.8);

    if (target.type === 'rect') {
      borderGfx.strokeRoundedRect(
        target.x - pad, target.y - pad,
        (target.w ?? 100) + pad * 2,
        (target.h ?? 40) + pad * 2, 6
      );
    } else {
      borderGfx.strokeCircle(target.x, target.y, (target.r ?? 40) + pad);
    }
    // 다음 스텝 전환 시 destroy
    this.currentBorderGfx?.destroy();
    this.currentBorderGfx = borderGfx;
  }
}
```

---

## 2. 튜토리얼 안내 패널 (`TutorialPanel`)

### 2-1. 패널 외형

```
┌─ 튜토리얼 (2/10) ─────────────────────────────────────┐
│                                                          │
│  🌲 나무에 가까이 가서 [E] 키를 눌러 벌목하세요.          │
│                                                          │
│  [E] ← 키 아이콘                                         │
│                                                          │
│              ● ● ○ ○ ○ ○ ○ ○ ○ ○   [건너뛰기]           │
└──────────────────────────────────────────────────────────┘
```

- 위치: 화면 하단 중앙 (y: height − 90px)
- 크기: 360×80px, 라운드 4px
- 배경: `rgba(10, 8, 5, 0.92)`, 테두리 `#c8a030` 2px
- 왼쪽 3px 황금 accent bar

### 2-2. 패널 렌더링

```typescript
class TutorialPanel {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private dotBar: Phaser.GameObjects.Graphics;
  private skipBtn: Phaser.GameObjects.Text;

  show(step: TutorialStep, stepIndex: number, totalSteps: number): void {
    const cam = scene.cameras.main;
    const PW = 360, PH = 80;
    const px = (cam.width - PW) / 2;
    const py = cam.height - PH - 16;

    // 패널 등장: 아래서 위로 슬라이드 (0.25s Back.easeOut)
    this.container.setPosition(px, py + 40).setAlpha(0);
    scene.tweens.add({
      targets: this.container,
      y: py, alpha: 1,
      duration: 250, ease: 'Back.easeOut'
    });

    // 제목
    this.titleText.setText(`튜토리얼 (${stepIndex + 1}/${totalSteps})`);

    // 본문 (아이콘 포함)
    this.bodyText.setText(step.message);

    // 진행 도트
    this.drawDots(stepIndex, totalSteps);

    // 건너뛰기 버튼 (5초 후 표시)
    this.skipBtn.setVisible(false);
    scene.time.delayedCall(5000, () => {
      if (this.container.active) this.skipBtn.setVisible(true);
    });
  }

  hide(): void {
    scene.tweens.add({
      targets: this.container,
      y: this.container.y + 30, alpha: 0,
      duration: 200,
      onComplete: () => this.container.setVisible(false)
    });
  }

  private drawDots(current: number, total: number): void {
    this.dotBar.clear();
    const dotR = 3, dotGap = 10;
    const startX = 12;
    const y = 70;
    for (let i = 0; i < total; i++) {
      const x = startX + i * dotGap;
      if (i < current) {
        this.dotBar.fillStyle(0xf0c030, 1.0); // 완료: 금색
      } else if (i === current) {
        this.dotBar.fillStyle(0xffffff, 1.0); // 현재: 흰색 (더 큰)
        this.dotBar.fillCircle(x, y, dotR + 1);
        continue;
      } else {
        this.dotBar.fillStyle(0x555545, 1.0); // 미완: 회색
      }
      this.dotBar.fillCircle(x, y, dotR);
    }
  }
}
```

---

## 3. 방향 화살표 포인터 (`TutorialArrow`)

스포트라이트 영역을 가리키는 애니메이션 화살표.

```typescript
type ArrowDirection = 'up' | 'down' | 'left' | 'right';

class TutorialArrow {
  private gfx: Phaser.GameObjects.Graphics;
  private tween: Phaser.Tweens.Tween | null = null;

  point(
    targetX: number, targetY: number,
    dir: ArrowDirection,
    offset = 24
  ): void {
    this.tween?.stop();
    this.gfx.setVisible(true);

    const positions: Record<ArrowDirection, { x: number; y: number; angle: number }> = {
      up:    { x: targetX,          y: targetY - offset, angle: -90 },
      down:  { x: targetX,          y: targetY + offset, angle: 90  },
      left:  { x: targetX - offset, y: targetY,          angle: 180 },
      right: { x: targetX + offset, y: targetY,          angle: 0   },
    };
    const pos = positions[dir];
    this.gfx.setPosition(pos.x, pos.y);

    // 화살표 그리기 (→ 방향 기준 16×12px)
    this.gfx.clear();
    this.gfx.fillStyle(0xf0c030, 0.95);
    this.gfx.fillTriangle(16, 6, 0, 0, 0, 12);
    this.gfx.fillRect(-12, 2, 12, 8);
    this.gfx.setAngle(pos.angle);

    // 앞뒤 yoyo 애니메이션 (6px, 0.5s)
    const moveAxis = dir === 'up' || dir === 'down' ? 'y' : 'x';
    const moveDir  = dir === 'down' || dir === 'right' ? 8 : -8;
    this.tween = scene.tweens.add({
      targets: this.gfx,
      [moveAxis]: pos[moveAxis] + moveDir,
      duration: 500, ease: 'Sine.easeInOut',
      yoyo: true, repeat: -1
    });
  }

  hide(): void {
    this.tween?.stop();
    this.gfx.setVisible(false);
  }
}
```

---

## 4. 키 아이콘 (`KeyIcon`)

안내 패널 내 또는 월드 위에 표시되는 키보드/마우스 아이콘.

```typescript
function drawKeyIcon(
  ctx: CanvasRenderingContext2D,
  label: string,    // 'E', 'SPACE', 'LMB', '↑↓←→'
  x: number, y: number
): void {
  const W = label.length > 2 ? 36 : 20, H = 20;

  // 키 외형
  ctx.fillStyle = '#2a2218';
  roundRect(ctx, x, y, W, H, 3); ctx.fill();

  // 상단 하이라이트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, x + 1, y + 1, W - 2, 8, 2); ctx.fill();

  // 테두리
  ctx.strokeStyle = '#6a5030';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, W, H, 3); ctx.stroke();

  // 레이블
  ctx.fillStyle = '#f0e0b0';
  ctx.font = 'bold 9px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + W / 2, y + 13);
}

// 마우스 버튼 아이콘 (LMB/RMB)
function drawMouseIcon(
  ctx: CanvasRenderingContext2D,
  button: 'left' | 'right',
  x: number, y: number
): void {
  // 마우스 본체 18×24px
  ctx.fillStyle = '#2a2218';
  ctx.beginPath();
  ctx.ellipse(x + 9, y + 12, 9, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 버튼 하이라이트 (클릭되는 쪽)
  ctx.fillStyle = '#f0c030';
  ctx.fillRect(x + (button === 'left' ? 2 : 8), y + 2, 7, 10);

  // 가운데 구분선
  ctx.strokeStyle = '#6a5030'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 9, y + 2); ctx.lineTo(x + 9, y + 12); ctx.stroke();
}
```

---

## 5. 스텝별 시각 설정표

| Step | 안내 텍스트 | 스포트라이트 | 화살표 | 키 아이콘 |
|------|------------|------------|--------|----------|
| 1 이동 | 방향키로 이동하세요 | 없음 (전체 활성) | 없음 | ↑↓←→ |
| 2 벌목 | 나무에 다가가 [E] | 가장 가까운 나무 (world) | down | E |
| 3 인벤토리 | [I]로 인벤토리 열기 | 인벤토리 버튼 (rect) | up | I |
| 4 도구 제작 | 도끼 제작 방법 | 제작 탭 슬롯 (rect) | right | LMB |
| 5 채광 | 돌에 [E] | 가장 가까운 돌 (world) | down | E |
| 6 건설 | [B]로 건설 모드 | 건설 버튼 (rect) | up | B |
| 7 모닥불 설치 | 모닥불을 배치하세요 | 배치 미리보기 (world) | down | LMB |
| 8 요리 | 캠프파이어에서 [E] | 캠프파이어 (world) | down | E |
| 9 수면 | 침대에서 [E] | 침대 (world) | down | E |
| 10 완료 | 기초 완료! 탐험을 시작하세요 | 없음 | 없음 | 없음 |

---

## 6. 단계 완료 연출 (`TutorialStepComplete`)

```typescript
function playStepCompleteEffect(stepIndex: number, totalSteps: number): void {
  const cam = scene.cameras.main;

  // 1. 초록 체크 팝업 (패널 위치)
  const check = scene.add.text(
    cam.width / 2, cam.height - 130, '✓',
    { fontSize: '24px', color: '#40e060', stroke: '#000', strokeThickness: 2 }
  ).setScrollFactor(0).setDepth(122).setOrigin(0.5).setAlpha(0);

  scene.tweens.add({
    targets: check,
    alpha: { from: 0, to: 1 },
    scaleX: [0.5, 1.3, 1.0],
    scaleY: [0.5, 1.3, 1.0],
    duration: 300, ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(600, () => {
        scene.tweens.add({
          targets: check, alpha: 0, y: check.y - 20,
          duration: 300,
          onComplete: () => check.destroy()
        });
      });
    }
  });

  // 2. 도트 바 업데이트 (완료된 도트가 금색으로 변하는 짧은 scale pulse)
  // TutorialPanel.drawDots 재호출로 처리

  // 3. 마지막 단계 완료: 전체 연출
  if (stepIndex === totalSteps - 1) {
    playTutorialCompleteEffect();
  }
}

function playTutorialCompleteEffect(): void {
  const cam = scene.cameras.main;
  const cx = cam.width / 2, cy = cam.height / 2;

  // 금색 confetti 20개
  const emitter = scene.add.particles(cx, cy, 'fx_pixel', {
    tint:    [0xf0c030, 0xffffff, 0x40e060, 0x4080e0],
    speed:   { min: 80, max: 200 },
    angle:   { min: 0, max: 360 },
    scale:   { start: 1.5, end: 0 },
    alpha:   { start: 1.0, end: 0 },
    lifespan: 1000,
    quantity: 20,
    emitting: false
  }).setScrollFactor(0).setDepth(125);
  emitter.explode(20);

  // "튜토리얼 완료!" 텍스트 (plan 43 스타일)
  const done = scene.add.text(cx, cy - 20, '튜토리얼 완료!', {
    fontSize: '20px', fontFamily: 'Courier New',
    color: '#f0c030', stroke: '#000000', strokeThickness: 3
  }).setScrollFactor(0).setDepth(125).setOrigin(0.5).setAlpha(0);

  scene.tweens.add({
    targets: done,
    alpha: 1, y: cy - 40,
    duration: 500, ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(2000, () => {
        scene.tweens.add({
          targets: done, alpha: 0, duration: 500,
          onComplete: () => { done.destroy(); emitter.destroy(); }
        });
      });
    }
  });
}
```

---

## 7. 조작 도움말 패널 (H키 Cheatsheet) 비주얼

plan 29에서 H키 도움말 존재만 명시됨 → 외형 설계.

```typescript
// 화면 중앙 패널, 360×400px
// plan 43 UIRenderer.drawPanel 사용
// 키 아이콘 + 설명 2열 레이아웃

const CHEATSHEET_ENTRIES = [
  { key: '↑↓←→', desc: '이동' },
  { key: 'E',     desc: '상호작용 / 수확' },
  { key: 'I',     desc: '인벤토리 열기' },
  { key: 'B',     desc: '건설 모드' },
  { key: 'F',     desc: '낚시' },
  { key: 'ESC',   desc: '메뉴 / 닫기' },
  { key: 'H',     desc: '도움말 토글' },
  { key: 'L',     desc: '이벤트 로그' },
  { key: 'LMB',   desc: '공격 / 확인' },
  { key: 'RMB',   desc: '컨텍스트 메뉴' },
  { key: 'Scroll','desc': '줌 인/아웃' },
  { key: 'Tab',   desc: '빠른 슬롯 전환' },
];

// 슬라이드-인 애니: 오른쪽에서 등장 (0.25s)
// 반투명 배경 딤 (alpha 0.5)
// ESC/H로 닫기
```

---

## 8. 깊이(Depth) 할당

| 오브젝트 | depth | ScrollFactor |
|----------|-------|--------------|
| 딤 오버레이 RenderTexture | 118 | 0 |
| 스포트라이트 테두리 | 119 | 0 |
| 튜토리얼 화살표 | 120 | 0 |
| 튜토리얼 안내 패널 | 121 | 0 |
| 스텝 완료 체크 표시 | 122 | 0 |
| Cheatsheet 패널 | 123 | 0 |
| 튜토리얼 완료 confetti | 125 | 0 |

---

## 9. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/ui/TutorialSpotlight.ts` | 딤 오버레이 + 스포트라이트 구멍 |
| `src/ui/TutorialPanel.ts` | 안내 패널, 진행 도트, 건너뛰기 버튼 |
| `src/ui/TutorialArrow.ts` | 방향 화살표 포인터 yoyo |
| `src/ui/KeyIcon.ts` | 키보드·마우스 아이콘 Canvas 드로잉 |
| `src/systems/TutorialSystem.ts` | plan 29 로직에 위 UI 컴포넌트 연결 |
| `src/ui/CheatsheetPanel.ts` | H키 도움말 패널 |

---

## 10. 버전

`v0.54.0`
