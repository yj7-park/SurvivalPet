# Plan 60 — 모바일 가상 컨트롤 비주얼 (Visual Mobile Controls)

## 개요

plan 38(모바일 터치 지원)에서 기능 구조만 정의된  
가상 조이스틱·액션 버튼의 시각 표현을 설계한다.  
조이스틱 그라디언트, 방향 표시, 버튼 아이콘·프레스 리플,  
쿨다운 링, 투명도 자동화, 가로/세로 레이아웃을 포함한다.

---

## 1. 가상 조이스틱 외형 (`VirtualJoystickRenderer`)

### 1-1. 외부 원 (Base Ring)

```typescript
function drawJoystickBase(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  active: boolean
): void {
  const R = 56;

  // 외부 원 — 그라디언트 테두리
  const grad = ctx.createRadialGradient(cx, cy, R - 8, cx, cy, R + 2);
  grad.addColorStop(0,   active ? 'rgba(240,192,48,0.35)' : 'rgba(255,255,255,0.20)');
  grad.addColorStop(0.5, active ? 'rgba(240,192,48,0.15)' : 'rgba(255,255,255,0.08)');
  grad.addColorStop(1,   'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.fill();

  // 내부 채움 (반투명 어두운 원)
  ctx.fillStyle = active ? 'rgba(240,192,48,0.08)' : 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // 십자 가이드라인 (희미하게)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  ctx.setLineDash([]);

  // 방향 삼각 힌트 (4방향 작은 화살표)
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  const arrowOffset = R - 10;
  drawSmallArrow(ctx, cx,              cy - arrowOffset, 0);    // 위
  drawSmallArrow(ctx, cx,              cy + arrowOffset, 180);  // 아래
  drawSmallArrow(ctx, cx - arrowOffset, cy,              270);  // 왼
  drawSmallArrow(ctx, cx + arrowOffset, cy,              90);   // 오른
}

function drawSmallArrow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, angleDeg: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleDeg * Math.PI / 180);
  ctx.beginPath();
  ctx.moveTo(0, -5); ctx.lineTo(-4, 2); ctx.lineTo(4, 2);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
```

### 1-2. 핸들 (Inner Handle)

```typescript
function drawJoystickHandle(
  ctx: CanvasRenderingContext2D,
  hx: number, hy: number,
  active: boolean,
  magnitude: number   // 0~1
): void {
  const R = 24;

  // 외곽 글로우 (active 시 황금빛)
  if (active && magnitude > 0.1) {
    const glowR = R + 6 * magnitude;
    const glowGrad = ctx.createRadialGradient(hx, hy, R * 0.5, hx, hy, glowR);
    glowGrad.addColorStop(0, `rgba(240,192,48,${0.4 * magnitude})`);
    glowGrad.addColorStop(1, 'rgba(240,192,48,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(hx, hy, glowR, 0, Math.PI * 2); ctx.fill();
  }

  // 핸들 본체
  const bodyGrad = ctx.createRadialGradient(hx - R*0.3, hy - R*0.3, 2, hx, hy, R);
  bodyGrad.addColorStop(0, active ? 'rgba(255,240,180,0.75)' : 'rgba(255,255,255,0.55)');
  bodyGrad.addColorStop(0.6, active ? 'rgba(240,192,48,0.55)' : 'rgba(200,200,200,0.35)');
  bodyGrad.addColorStop(1, active ? 'rgba(180,120,20,0.40)' : 'rgba(100,100,100,0.20)');

  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.arc(hx, hy, R, 0, Math.PI * 2); ctx.fill();

  // 내부 하이라이트 (상단 1/4 밝은 원)
  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.beginPath();
  ctx.arc(hx - 4, hy - 6, R * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // 중심 점
  ctx.fillStyle = active ? 'rgba(240,192,48,0.8)' : 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
}
```

### 1-3. 방향 표시 (이동 방향 아크 강조)

```typescript
function drawJoystickDirectionArc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  dx: number, dy: number,    // 정규화 방향 벡터
  magnitude: number
): void {
  if (magnitude < 0.15) return;

  const angle = Math.atan2(dy, dx);
  const R = 56;
  const arcSpan = Math.PI * 0.45;   // ±41°

  ctx.strokeStyle = `rgba(240,192,48,${0.5 * magnitude})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 4, angle - arcSpan / 2, angle + arcSpan / 2);
  ctx.stroke();
}
```

### 1-4. 조이스틱 진입 리플

조이스틱 베이스가 처음 나타날 때 바깥으로 퍼지는 원:

```typescript
function playJoystickAppearEffect(scene: Phaser.Scene, x: number, y: number): void {
  const gfx = scene.add.graphics().setScrollFactor(0).setDepth(75);
  scene.tweens.add({
    targets: { r: 0, a: 0.6 }, r: 64, a: 0,
    duration: 300, ease: 'Quad.easeOut',
    onUpdate: (tw, obj) => {
      gfx.clear();
      gfx.lineStyle(2, 0xf0c030, obj.a);
      gfx.strokeCircle(x, y, obj.r);
    },
    onComplete: () => gfx.destroy()
  });
}
```

---

## 2. 액션 버튼 외형 (`ActionButtonRenderer`)

### 2-1. 버튼 디자인 규격

```typescript
interface ActionButtonConfig {
  id:      string;
  icon:    string;        // 이모지 또는 텍스트
  label:   string;        // 버튼 하단 작은 레이블
  radius:  number;        // 28 또는 36
  color:   number;        // 기본 테두리 색
  key:     string;        // 키 힌트
}

const ACTION_BUTTONS: ActionButtonConfig[] = [
  { id: 'attack',    icon: '⚔',  label: 'ATK', radius: 36, color: 0xe04040, key: 'SPC' },
  { id: 'inventory', icon: '🎒', label: 'INV', radius: 28, color: 0x4080c0, key: 'I'   },
  { id: 'equip',     icon: '🛡',  label: 'EQP', radius: 28, color: 0x60a040, key: 'E'   },
  { id: 'build',     icon: '🔨', label: 'BLD', radius: 28, color: 0xc8a030, key: 'B'   },
  { id: 'help',      icon: '?',   label: 'HLP', radius: 28, color: 0x808080, key: 'H'   },
];
```

### 2-2. 버튼 렌더링 함수

```typescript
function drawActionButton(
  ctx: CanvasRenderingContext2D,
  cfg: ActionButtonConfig,
  cx: number, cy: number,
  state: 'idle' | 'pressed' | 'cooldown',
  cooldownRatio?: number   // 0~1
): void {
  const R = cfg.radius;

  // 배경 원
  ctx.fillStyle = state === 'pressed'
    ? 'rgba(255,255,255,0.25)'
    : 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // 테두리 (색상 + 2px)
  ctx.strokeStyle = '#' + cfg.color.toString(16).padStart(6, '0');
  ctx.lineWidth = state === 'pressed' ? 3 : 2;
  ctx.globalAlpha = state === 'cooldown' ? 0.4 : 1.0;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1.0;

  // 쿨다운 오버레이 (시계 방향 sweep)
  if (state === 'cooldown' && cooldownRatio !== undefined) {
    const endAngle = -Math.PI / 2 + (1 - cooldownRatio) * Math.PI * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.50)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, -Math.PI / 2, endAngle, false);
    ctx.closePath(); ctx.fill();
  }

  // 아이콘
  ctx.globalAlpha = state === 'cooldown' ? 0.5 : 1.0;
  ctx.font = `${R * 0.7}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cfg.icon, cx, cy - 2);
  ctx.globalAlpha = 1.0;

  // 키 힌트 레이블 (버튼 하단 작은 글씨)
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '7px Courier New';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(cfg.key, cx, cy + R + 9);
}
```

### 2-3. 버튼 프레스 리플

```typescript
function playButtonPressRipple(
  scene: Phaser.Scene,
  cx: number, cy: number,
  color: number
): void {
  const gfx = scene.add.graphics().setScrollFactor(0).setDepth(76);
  scene.tweens.add({
    targets: { r: 0, a: 0.7 }, r: 50, a: 0,
    duration: 250, ease: 'Quad.easeOut',
    onUpdate: (tw, obj) => {
      gfx.clear();
      gfx.lineStyle(2, color, obj.a);
      gfx.strokeCircle(cx, cy, obj.r);
    },
    onComplete: () => gfx.destroy()
  });

  // 버튼 scale punch (0.85 → 1.0)
  scene.tweens.add({
    targets: getButtonContainer(cx, cy),
    scaleX: [0.85, 1.05, 1.0],
    scaleY: [0.85, 1.05, 1.0],
    duration: 200, ease: 'Back.easeOut'
  });
}
```

---

## 3. 투명도 자동화 (`TouchControlAutoFade`)

```typescript
class TouchControlAutoFade {
  private readonly ACTIVE_ALPHA  = 0.85;
  private readonly IDLE_ALPHA    = 0.30;
  private readonly FADE_DELAY_MS = 4000;
  private idleTimer: Phaser.Time.TimerEvent | null = null;

  onTouchStart(): void {
    scene.tweens.add({
      targets: [joystickContainer, buttonContainer],
      alpha: this.ACTIVE_ALPHA, duration: 150
    });
    this.idleTimer?.remove();
  }

  onTouchEnd(): void {
    this.idleTimer?.remove();
    this.idleTimer = scene.time.delayedCall(this.FADE_DELAY_MS, () => {
      scene.tweens.add({
        targets: [joystickContainer, buttonContainer],
        alpha: this.IDLE_ALPHA, duration: 1000
      });
    });
  }
}
```

---

## 4. 범용 탭 리플 (`TapFeedback`)

화면 어느 위치든 탭 시 작은 원형 피드백:

```typescript
function showTapFeedback(scene: Phaser.Scene, x: number, y: number): void {
  const gfx = scene.add.graphics().setScrollFactor(0).setDepth(74);
  scene.tweens.add({
    targets: { r: 4, a: 0.5 }, r: 20, a: 0,
    duration: 200, ease: 'Quad.easeOut',
    onUpdate: (tw, obj) => {
      gfx.clear();
      gfx.lineStyle(1.5, 0xffffff, obj.a);
      gfx.strokeCircle(x, y, obj.r);
    },
    onComplete: () => gfx.destroy()
  });
}
```

---

## 5. 화면 방향별 레이아웃

### 5-1. 가로 모드 (Landscape)

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│  🎮                              [B] [⚔] [I]           │
│  (조이스틱)                          [E] [H]            │
└──────────────────────────────────────────────────────┘
좌하단 y: 화면H - 90, 우하단 y: 화면H - 80~160
```

### 5-2. 세로 모드 (Portrait — 미지원 안내)

```typescript
function showPortraitWarning(scene: Phaser.Scene): void {
  if (!isPortrait()) return;

  const cam = scene.cameras.main;
  const warn = scene.add.text(
    cam.width / 2, cam.height / 2,
    '📱 화면을 가로로 돌려주세요',
    {
      fontSize: '16px', fontFamily: 'Courier New',
      color: '#f0c030', stroke: '#000000', strokeThickness: 3,
      align: 'center'
    }
  ).setScrollFactor(0).setDepth(200).setOrigin(0.5);

  // 아이콘 회전 애니메이션
  scene.tweens.add({
    targets: warn, angle: { from: -10, to: 10 },
    duration: 600, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
  });
}
```

---

## 6. 조이스틱 이동 궤적 (이동 방향 표시)

```typescript
class JoystickTrail {
  private trail: { x: number; y: number; t: number }[] = [];

  update(hx: number, hy: number, active: boolean, gfx: Phaser.GameObjects.Graphics): void {
    if (!active) { this.trail = []; gfx.clear(); return; }

    this.trail.push({ x: hx, y: hy, t: Date.now() });
    // 최근 200ms만 유지
    const cutoff = Date.now() - 200;
    this.trail = this.trail.filter(p => p.t > cutoff);

    gfx.clear();
    this.trail.forEach((p, i) => {
      const alpha = (i / this.trail.length) * 0.3;
      gfx.fillStyle(0xf0c030, alpha);
      gfx.fillCircle(p.x, p.y, 3 * (i / this.trail.length));
    });
  }
}
```

---

## 7. 핀치 줌 시각 피드백

```typescript
function showPinchZoomIndicator(scene: Phaser.Scene, zoom: number): void {
  // 현재 줌 레벨 화면 중앙 일시 표시
  let zoomLabel = scene.data.get('zoomLabel') as Phaser.GameObjects.Text;
  if (!zoomLabel) {
    zoomLabel = scene.add.text(
      scene.cameras.main.width / 2, 40,
      '',
      { fontSize: '11px', fontFamily: 'Courier New',
        color: '#f0c030', stroke: '#000', strokeThickness: 2 }
    ).setScrollFactor(0).setDepth(89).setOrigin(0.5).setAlpha(0);
    scene.data.set('zoomLabel', zoomLabel);
  }

  zoomLabel.setText(`🔍 ${zoom.toFixed(1)}×`).setAlpha(1);
  scene.time.delayedCall(1200, () => {
    scene.tweens.add({ targets: zoomLabel, alpha: 0, duration: 400 });
  });
}
```

---

## 8. 깊이(Depth) 할당

| 오브젝트 | depth | ScrollFactor |
|----------|-------|--------------|
| 탭 피드백 리플 | 74 | 0 |
| 조이스틱 이동 궤적 | 75 | 0 |
| 조이스틱 베이스 + 핸들 | 75 | 0 |
| 버튼 프레스 리플 | 76 | 0 |
| 액션 버튼 | 76 | 0 |
| 핀치 줌 레이블 | 89 | 0 |
| 세로모드 경고 | 200 | 0 |

---

## 9. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/ui/VirtualJoystickRenderer.ts` | 베이스 링, 핸들, 방향 아크, 진입 리플 |
| `src/ui/ActionButtonRenderer.ts` | 버튼 드로잉, 쿨다운 링, 프레스 리플 |
| `src/ui/TouchControlAutoFade.ts` | 활성/유휴 투명도 tween |
| `src/ui/TapFeedback.ts` | 범용 탭 원형 피드백 |
| `src/ui/JoystickTrail.ts` | 핸들 이동 궤적 |

---

## 10. 버전

`v0.60.0`
