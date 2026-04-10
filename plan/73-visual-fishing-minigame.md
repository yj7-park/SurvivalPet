# Plan 73 — 낚시 미니게임 UI 비주얼

## 개요

plan 57(물 상호작용)에서 정의한 낚싯줄·찌 표현을 기반으로  
**캐스팅 → 대기 → 입질 → 당기기 → 성공/실패** 전 단계에 걸쳐  
낚시 미니게임의 시각적 피드백을 설계한다.  
텐션 게이지, 찌 애니메이션, 물고기 출현 이펙트, 완료 연출을 포함한다.

---

## 1. 캐스팅 이펙트

```typescript
function playCastingEffect(
  scene: Phaser.Scene,
  playerX: number, playerY: number,
  bobberX: number, bobberY: number
): void {
  // 1. 찌 발사 궤적 (포물선 파티클 트레일)
  const STEPS = 12;
  for (let i = 0; i < STEPS; i++) {
    const t = i / (STEPS - 1);
    // 포물선: y = lerp + sin(t*PI) * arcHeight
    const tx = playerX + (bobberX - playerX) * t;
    const ty = playerY + (bobberY - playerY) * t - Math.sin(t * Math.PI) * 60;

    scene.time.delayedCall(i * 30, () => {
      const dot = scene.add.graphics().setDepth(57);
      dot.fillStyle(0xffffff, 0.6 - t * 0.4);
      dot.fillCircle(tx, ty, 2 - t * 1.5);
      scene.tweens.add({
        targets: dot, alpha: 0, duration: 200,
        onComplete: () => dot.destroy(),
      });
    });
  }

  // 2. 릴 감기 사운드 느낌 — 낚싯대 흔들림 (plan 57 낚싯줄 tween)
  // 실제 낚싯줄은 updateFishingLine()으로 매 프레임 갱신
}
```

---

## 2. 찌 (Bobber) 애니메이션

```typescript
class BobberAnimator {
  private bobGfx: Phaser.GameObjects.Graphics;
  private rippleGfx: Phaser.GameObjects.Graphics;
  private phase = 0;
  private state: 'idle' | 'bite' | 'pulling' = 'idle';
  private alertTimer?: Phaser.Time.TimerEvent;

  create(scene: Phaser.Scene, wx: number, wy: number): void {
    this.bobGfx   = scene.add.graphics().setDepth(57);
    this.rippleGfx = scene.add.graphics().setDepth(56);
    this.worldX = wx;
    this.worldY = wy;
    scene.events.on('update', this.update, this);
  }

  private worldX = 0; private worldY = 0;

  private update(_time: number, delta: number): void {
    this.phase += delta * 0.003;

    const bobOffset = this.state === 'bite'
      ? Math.sin(this.phase * 8) * 5   // 입질: 빠르게 상하
      : Math.sin(this.phase) * 2;      // 대기: 천천히 흔들림

    const y = this.worldY + bobOffset;

    this.bobGfx.clear();
    this.drawBobber(this.worldX, y);

    // 수면 잔물결
    if (Math.floor(this.phase * 2) % 3 === 0) {
      this.drawSmallRipple(this.worldX, this.worldY);
    }
  }

  private drawBobber(x: number, y: number): void {
    // 하단 빨간 구체
    this.bobGfx.fillStyle(0xff3333, 1);
    this.bobGfx.fillCircle(x, y + 2, 4);

    // 상단 흰색 구체
    this.bobGfx.fillStyle(0xeeeeee, 1);
    this.bobGfx.fillCircle(x, y - 2, 4);

    // 하이라이트
    this.bobGfx.fillStyle(0xffffff, 0.5);
    this.bobGfx.fillCircle(x - 1, y - 3, 1.5);

    // 수면 아래 잠긴 부분 (반투명)
    this.bobGfx.fillStyle(0xff3333, 0.3);
    this.bobGfx.fillCircle(x, y + 5, 3);
  }

  private drawSmallRipple(x: number, y: number): void {
    const r = 6 + (this.phase % 1) * 8;
    const alpha = 0.4 - (this.phase % 1) * 0.4;
    this.rippleGfx.clear();
    this.rippleGfx.lineStyle(1, 0x88ccee, alpha);
    this.rippleGfx.strokeEllipse(x, y, r * 2, r * 0.6);
  }

  setBite(scene: Phaser.Scene): void {
    this.state = 'bite';

    // 입질 경고: 느낌표 표시
    const alert = scene.add.text(this.worldX, this.worldY - 24, '!',
      { fontSize: '18px', color: '#ffff00', fontFamily: 'Courier New', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 3 }
    ).setOrigin(0.5).setDepth(60);

    scene.tweens.add({
      targets: alert,
      scaleX: 1.4, scaleY: 1.4,
      duration: 150,
      yoyo: true,
      repeat: -1,
    });
    this.alertTimer = scene.time.delayedCall(3000, () => alert.destroy());
    (this as any)._alert = alert;
  }

  clearBite(): void {
    this.state = 'idle';
    (this as any)._alert?.destroy();
    this.alertTimer?.remove();
  }

  destroy(scene: Phaser.Scene): void {
    scene.events.off('update', this.update, this);
    this.bobGfx.destroy();
    this.rippleGfx.destroy();
  }
}
```

---

## 3. 텐션 게이지 (당기기 미니게임)

```typescript
// 화면 오른쪽 세로 게이지
// 너무 강하면 줄 끊김, 너무 약하면 물고기 탈출
class FishingTensionGauge {
  private container: Phaser.GameObjects.Container;
  private barBg: Phaser.GameObjects.Graphics;
  private barFill: Phaser.GameObjects.Graphics;
  private indicator: Phaser.GameObjects.Graphics;  // 이상적 범위 표시
  private needle: Phaser.GameObjects.Graphics;     // 현재 텐션 바늘
  private fishIcon: Phaser.GameObjects.Text;
  private tension = 0.5;  // 0~1

  // 이상적 범위 (초록 구간) — 물고기마다 다름
  private safeMin = 0.35;
  private safeMax = 0.65;

  show(scene: Phaser.Scene): void {
    const cam = scene.cameras.main;
    const GX = cam.width - 36;
    const GY = cam.height * 0.2;
    const GH = cam.height * 0.5;

    this.container = scene.add.container(GX, GY)
      .setScrollFactor(0).setDepth(88);

    this.barBg = scene.add.graphics();
    this.barFill = scene.add.graphics();
    this.indicator = scene.add.graphics();
    this.needle = scene.add.graphics();
    this.fishIcon = scene.add.text(0, -18, '🐟', { fontSize: '12px' }).setOrigin(0.5);

    this.container.add([this.barBg, this.indicator, this.barFill, this.needle, this.fishIcon]);

    this.GAUGE_H = GH;
    this.drawStatic(GH);
    scene.events.on('update', this.updateVisual, this);
  }

  private GAUGE_H = 200;

  private drawStatic(h: number): void {
    // 배경
    this.barBg.fillStyle(0x111111, 0.8);
    this.barBg.fillRoundedRect(-10, 0, 20, h, 3);

    // 위험 구간 (빨간 상단)
    this.barBg.fillStyle(0xff4444, 0.3);
    this.barBg.fillRoundedRect(-9, 1, 18, h * this.safeMax, 2);

    // 안전 구간 (초록)
    this.indicator.fillStyle(0x44ff88, 0.25);
    this.indicator.fillRect(-9, h * (1 - this.safeMax), 18, h * (this.safeMax - this.safeMin));

    // 위험 구간 (빨간 하단)
    this.barBg.fillStyle(0xff4444, 0.3);
    this.barBg.fillRect(-9, h * (1 - this.safeMin), 18, h * this.safeMin);

    // 구분선
    this.barBg.lineStyle(1, 0x44ff88, 0.6);
    this.barBg.beginPath();
    this.barBg.moveTo(-9, h * (1 - this.safeMax)); this.barBg.lineTo(9, h * (1 - this.safeMax));
    this.barBg.moveTo(-9, h * (1 - this.safeMin)); this.barBg.lineTo(9, h * (1 - this.safeMin));
    this.barBg.strokePath();
  }

  setTension(t: number): void { this.tension = Math.max(0, Math.min(1, t)); }

  private updateVisual(): void {
    const h = this.GAUGE_H;
    const ny = h * (1 - this.tension);  // 위가 높은 텐션

    // 바늘 (현재 텐션 위치)
    this.needle.clear();
    const inSafe = this.tension >= this.safeMin && this.tension <= this.safeMax;
    const color = this.tension > this.safeMax ? 0xff4444 : inSafe ? 0x44ff88 : 0xff8800;
    this.needle.lineStyle(2, color, 1);
    this.needle.beginPath();
    this.needle.moveTo(-12, ny);
    this.needle.lineTo(12, ny);
    this.needle.strokePath();

    // 삼각 화살촉
    this.needle.fillStyle(color, 1);
    this.needle.fillTriangle(-12, ny, -6, ny - 4, -6, ny + 4);
    this.needle.fillTriangle( 12, ny,  6, ny - 4,  6, ny + 4);

    // 물고기 아이콘 위치 (텐션이 높으면 위로)
    this.fishIcon.setY(ny - 14);

    // 위험 구간 진입 시 게이지 떨림
    if (this.tension > this.safeMax + 0.05 || this.tension < this.safeMin - 0.05) {
      this.container.setX(this.container.x + (Math.random() - 0.5) * 2);
    }
  }

  hide(scene: Phaser.Scene): void {
    scene.events.off('update', this.updateVisual, this);
    scene.tweens.add({
      targets: this.container,
      alpha: 0, x: this.container.x + 20,
      duration: 300,
      onComplete: () => this.container.destroy(),
    });
  }
}
```

---

## 4. 낚시 성공 연출

```typescript
function playFishCaughtEffect(
  scene: Phaser.Scene,
  playerX: number, playerY: number,
  fish: FishData
): void {
  // 1. 물에서 튀어오르는 물고기 아크
  const fishIcon = scene.add.text(playerX, playerY + 30, '🐟',
    { fontSize: fish.size === 'large' ? '22px' : '16px' }
  ).setOrigin(0.5).setDepth(58);

  scene.tweens.add({
    targets: fishIcon,
    x: playerX,
    y: playerY - 48,
    duration: 500,
    ease: 'Back.easeOut',
    onComplete: () => {
      // 수중 탈출 물보라
      const splash = scene.add.particles(playerX, playerY, '__DEFAULT', {
        speed: { min: 40, max: 100 },
        angle: { min: -150, max: -30 },
        scale: { start: 0.5, end: 0 },
        lifespan: 500,
        quantity: 10,
        tint: 0x88aadd,
      }).setDepth(57);
      splash.explode(10);
      scene.time.delayedCall(600, () => splash.destroy());

      // 2. 등급 색상 텍스트 팝업
      const gradeColor = GRADE_COLORS[fish.grade]?.text ?? '#ffffff';
      const txt = scene.add.text(playerX, playerY - 56,
        `${fish.name} 획득!`,
        { fontSize: '13px', color: gradeColor, fontFamily: 'Courier New', fontStyle: 'bold',
          stroke: '#000', strokeThickness: 3 }
      ).setOrigin(0.5).setDepth(61);

      scene.tweens.add({
        targets: txt, y: playerY - 76, alpha: 0,
        duration: 1200, delay: 400, ease: 'Quad.easeOut',
        onComplete: () => txt.destroy(),
      });

      // 3. 물고기 스프라이트 → 인벤토리 날아가기 (plan 55 equipFly 재사용)
      scene.time.delayedCall(600, () => {
        playEquipFlyAnimation(scene, fishIcon, getInventorySlotPosition());
      });
    },
  });
}
```

---

## 5. 낚시 실패 연출

```typescript
function playFishEscapeEffect(
  scene: Phaser.Scene,
  bobberX: number, bobberY: number
): void {
  // 1. 물 튀김 (아래 방향)
  const splash = scene.add.particles(bobberX, bobberY, '__DEFAULT', {
    speed: { min: 20, max: 60 },
    angle: { min: 160, max: 200 },
    scale: { start: 0.4, end: 0 },
    lifespan: 400,
    quantity: 6,
    tint: 0x88aadd,
  }).setDepth(57);
  splash.explode(6);
  scene.time.delayedCall(500, () => splash.destroy());

  // 2. "놓쳤다!" 텍스트
  const txt = scene.add.text(bobberX, bobberY - 24, '놓쳤다!',
    { fontSize: '12px', color: '#ff8888', fontFamily: 'Courier New',
      stroke: '#000', strokeThickness: 2 }
  ).setOrigin(0.5).setDepth(60);

  scene.tweens.add({
    targets: txt, y: bobberY - 44, alpha: 0,
    duration: 900, ease: 'Quad.easeOut',
    onComplete: () => txt.destroy(),
  });

  // 3. 찌 튀어오르기
  // BobberAnimator.clearBite() → 찌 아크 복귀 tween으로 처리
}
```

---

## 6. 낚시 줄 끊김 이펙트

```typescript
function playLineBreakEffect(
  scene: Phaser.Scene,
  linePoints: { x: number; y: number }[]
): void {
  // 중간 지점에서 두 방향으로 튕겨나감
  const midIdx = Math.floor(linePoints.length / 2);
  const mid = linePoints[midIdx];

  // 끊어진 선 스파크
  const emitter = scene.add.particles(mid.x, mid.y, '__DEFAULT', {
    speed: { min: 30, max: 80 },
    scale: { start: 0.3, end: 0 },
    lifespan: 300,
    quantity: 8,
    tint: 0xffffff,
    blendMode: Phaser.BlendModes.ADD,
  }).setDepth(57);
  emitter.explode(8);
  scene.time.delayedCall(400, () => emitter.destroy());

  // 텍스트
  const txt = scene.add.text(mid.x, mid.y - 16, '줄 끊김!',
    { fontSize: '11px', color: '#ff4444', fontFamily: 'Courier New',
      stroke: '#000', strokeThickness: 2 }
  ).setOrigin(0.5).setDepth(60);
  scene.tweens.add({
    targets: txt, y: mid.y - 36, alpha: 0, duration: 800,
    onComplete: () => txt.destroy(),
  });
}
```

---

## 7. 낚시 HUD 오버레이

```typescript
// 낚시 중 화면 하단 안내 UI (scrollFactor 0)
class FishingHUD {
  private hint: Phaser.GameObjects.Text;
  private tensionGauge: FishingTensionGauge;
  private waitIndicator: Phaser.GameObjects.Graphics;
  private waitPhase = 0;

  show(scene: Phaser.Scene): void {
    const cam = scene.cameras.main;

    this.hint = scene.add.text(cam.width / 2, cam.height - 20,
      '[ 클릭/탭 ] 당기기  — 타이밍에 맞춰 조절하세요',
      { fontSize: '10px', color: '#aaaaaa', fontFamily: 'Courier New' }
    ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(88).setAlpha(0);

    scene.tweens.add({ targets: this.hint, alpha: 1, duration: 400 });

    // 대기 스피너 (입질 전)
    this.waitIndicator = scene.add.graphics()
      .setScrollFactor(0).setDepth(87);
    scene.events.on('update', (_t: number, delta: number) => {
      this.waitPhase += delta * 0.002;
      this.waitIndicator.clear();
      this.waitIndicator.lineStyle(1.5, 0x88aacc, 0.5);
      this.waitIndicator.arc(
        cam.width / 2 - 90, cam.height - 14,
        7,
        this.waitPhase,
        this.waitPhase + Math.PI * 1.2,
        false
      );
      this.waitIndicator.strokePath();
    });
  }

  showBiteAlert(scene: Phaser.Scene): void {
    this.hint.setText('⚡ 입질! 지금 당기세요! ⚡');
    this.hint.setColor('#ffff44');

    scene.tweens.add({
      targets: this.hint,
      scaleX: 1.1, scaleY: 1.1,
      duration: 120, yoyo: true, repeat: 3,
    });

    this.tensionGauge = new FishingTensionGauge();
    this.tensionGauge.show(scene);
  }

  hide(scene: Phaser.Scene): void {
    this.tensionGauge?.hide(scene);
    scene.tweens.add({
      targets: [this.hint, this.waitIndicator],
      alpha: 0, duration: 300,
      onComplete: () => {
        this.hint.destroy();
        this.waitIndicator.destroy();
      },
    });
  }
}
```

---

## 8. 큰 물고기 특별 연출

물고기 등급 epic/legendary 잡았을 때 추가 연출:

```typescript
function playBigFishReveal(
  scene: Phaser.Scene,
  fish: FishData,
  playerX: number, playerY: number
): void {
  if (fish.grade !== 'epic' && fish.grade !== 'legendary') return;

  // 화면 일시 슬로우모션 (0.3배속, 0.8초)
  scene.time.timeScale = 0.3;
  scene.time.delayedCall(800, () => { scene.time.timeScale = 1.0; });

  // 물고기 대형 표시 (화면 중앙 잠깐)
  const W = scene.cameras.main.width;
  const H = scene.cameras.main.height;

  const bg = scene.add.rectangle(W / 2, H / 2, W, 80, 0x000000, 0.6)
    .setScrollFactor(0).setDepth(95);
  const fishTxt = scene.add.text(W / 2, H / 2,
    `${fish.grade === 'legendary' ? '🏆 전설의 ' : '✨ '}${fish.name}!`,
    { fontSize: '20px', color: GRADE_COLORS[fish.grade].text,
      fontFamily: 'Courier New', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4 }
  ).setOrigin(0.5).setScrollFactor(0).setDepth(96).setAlpha(0);

  scene.tweens.add({
    targets: fishTxt, alpha: 1,
    scaleX: 1.2, scaleY: 1.2,
    duration: 300 / 0.3,   // 슬로우모션 보정
    ease: 'Back.easeOut',
    yoyo: true, hold: 600 / 0.3,
    onComplete: () => { fishTxt.destroy(); bg.destroy(); },
  });
}
```

---

## 9. 깊이(Depth) 테이블

| 요소 | Depth | 비고 |
|------|-------|------|
| 수면 잔물결 | 56 | 물 타일(20) 위 |
| 찌 그래픽 | 57 | |
| 낚싯줄 | 57 | plan 57 |
| 물고기 아크 스프라이트 | 58 | |
| 낚시 텍스트 팝업 | 60~61 | |
| 낚시 HUD | 87~88 | scrollFactor 0 |
| 큰 물고기 연출 | 95~96 | scrollFactor 0 |

---

## 10. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/ui/FishingHUD.ts` | 낚시 안내 + 입질 경고 + 텐션 게이지 |
| `src/fx/BobberAnimator.ts` | 찌 애니메이션 + 입질 느낌표 |
| `src/fx/FishingEffects.ts` | 캐스팅·성공·실패·줄 끊김 이펙트 |

---

## 11. 버전

`v0.73.0`
