# Plan 53 — 야간 조명 비주얼 강화 (Visual Lighting & Night Atmosphere)

## 개요

plan 32(조명 시스템)·plan 44(하늘/별)·plan 50(PostFX)을 기반으로  
야간의 **따뜻한 광원 색상 틴트**, **달 렌더링**, **횃불 불꽃 스프라이트**,  
**실내 조명 분위기**, **달빛 블루 오버레이** 등 야간 분위기를 완성한다.

---

## 1. 달 렌더링 (`MoonRenderer`)

### 1-1. 달 외형

```typescript
function drawMoon(
  ctx: CanvasRenderingContext2D,
  phase: number   // 0.0~1.0 (0=삭, 0.5=망, 1.0=삭)
): void {
  const W = 32, H = 32, cx = W / 2, cy = H / 2, r = 12;

  // 달 본체 (크림 흰색)
  ctx.fillStyle = '#f0eecc';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 달 표면 크레이터 (어두운 반점 3개)
  const craters = [[cx-3, cy-2, 2.5], [cx+4, cy+3, 1.8], [cx+1, cy-5, 1.5]];
  ctx.fillStyle = 'rgba(180,170,120,0.5)';
  for (const [cx2, cy2, r2] of craters) {
    ctx.beginPath(); ctx.arc(cx2, cy2, r2, 0, Math.PI * 2); ctx.fill();
  }

  // 위상 마스크 (phase에 따라 왼쪽/오른쪽 가림)
  if (phase < 0.48 || phase > 0.52) {
    // 0~0.5: 오른쪽이 밝아짐, 0.5~1.0: 왼쪽이 어두워짐
    const progress = phase < 0.5 ? phase * 2 : (phase - 0.5) * 2;
    const maskX = phase < 0.5
      ? cx - r + progress * (r * 2)   // 초승 → 반달 → 보름
      : cx - r;                        // 보름 → 반달 → 그믐

    ctx.fillStyle = 'rgba(0, 10, 30, 0.92)';  // 하늘 배경색에 맞춤
    ctx.beginPath();
    ctx.arc(maskX, cy, r * (1 - Math.abs(progress - 0.5) * 2 + 0.001), 0, Math.PI * 2);
    ctx.fill();
  }

  // 달 테두리 (미광)
  ctx.strokeStyle = 'rgba(255,255,200,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.stroke();
}
```

### 1-2. 달 위치 & 위상 계산

```typescript
class MoonSystem {
  private moonSprite: Phaser.GameObjects.Image;

  // 게임 내 날짜 기반 달 위상 (29.5일 주기)
  getMoonPhase(gameDay: number): number {
    return (gameDay % 30) / 30;
  }

  // 게임 시간 기반 달 호 궤적 (20:00 동쪽 → 04:00 서쪽)
  getMoonPosition(gameHour: number, camW: number, camH: number): { x: number; y: number } {
    // 20:00~28:00(=04:00) → 0.0~1.0 진행률
    const t = gameHour >= 20
      ? (gameHour - 20) / 8
      : (gameHour + 4) / 8;   // 0:00~4:00 처리

    const x = camW * 0.15 + camW * 0.7 * t;
    const y = camH * 0.35 - Math.sin(t * Math.PI) * (camH * 0.22);
    return { x, y };
  }

  update(gameHour: number, gameDay: number): void {
    const isDaytime = gameHour >= 6 && gameHour < 20;
    this.moonSprite.setVisible(!isDaytime);

    if (!isDaytime) {
      const { x, y } = this.getMoonPosition(gameHour, scene.cameras.main.width, scene.cameras.main.height);
      const phase = this.getMoonPhase(gameDay);
      this.moonSprite.setPosition(x, y);
      // 위상별 텍스처 재생성은 비용이 크므로 8단계 캐싱
      const phaseIdx = Math.round(phase * 7);
      this.moonSprite.setTexture(`moon_phase_${phaseIdx}`);
    }
  }
}
```

### 1-3. 달빛 블루 오버레이

```typescript
// plan 50 ColorGradeTransition에 야간 달빛 색조 추가
// (plan 50의 night bonus와 별도: 달빛은 채도가 아니라 파란 tint)
function applyMoonlightOverlay(
  scene: Phaser.Scene,
  gameHour: number,
  moonPhase: number  // 0=삭(어두움), 0.5=보름(밝음)
): void {
  const alpha = getDarknessAlpha(gameHour);  // plan 32
  if (alpha < 0.3) return;

  // 보름달에 가까울수록 파란 달빛 강함
  const moonStrength = Math.sin(moonPhase * Math.PI) * 0.12;

  if (!moonlightGfx) {
    moonlightGfx = scene.add.graphics().setScrollFactor(0).setDepth(48);
  }
  moonlightGfx.clear();
  moonlightGfx.fillStyle(0x1830a0, moonStrength);
  moonlightGfx.fillRect(0, 0, scene.cameras.main.width, scene.cameras.main.height);
}
```

---

## 2. 광원 따뜻한 색상 틴트 (`WarmLightTintOverlay`)

plan 32 DarknessLayer는 구멍을 뚫어 어둠을 지우지만, 광원 반경 내 **따뜻한 주황빛 오버레이**가 없다.

### 2-1. 광원 색상 정의

```typescript
const LIGHT_WARM_COLORS: Record<LightType, { color: number; alpha: number }> = {
  player_torch:  { color: 0xff8820, alpha: 0.18 },  // 따뜻한 주황
  placed_torch:  { color: 0xff7010, alpha: 0.20 },  // 진한 주황
  campfire:      { color: 0xff5010, alpha: 0.25 },  // 붉은 주황
  player_body:   { color: 0x8899cc, alpha: 0.06 },  // 달빛 미광 (차가운 청회)
};
```

### 2-2. 따뜻한 빛 레이어 렌더링

```typescript
class WarmLightLayer {
  private rt: Phaser.GameObjects.RenderTexture;

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.cameras.main;
    this.rt = scene.add.renderTexture(0, 0, width, height)
      .setScrollFactor(0)
      .setDepth(49)   // DarknessLayer(depth 50) 바로 아래
      .setBlendMode(Phaser.BlendModes.ADD);  // ADD 블렌드로 자연스러운 빛 합성
  }

  update(lights: LightSource[], cam: Phaser.Cameras.Scene2D.Camera): void {
    this.rt.clear();

    for (const light of lights) {
      const cfg = LIGHT_WARM_COLORS[light.type];
      const screenX = light.x - cam.scrollX;
      const screenY = light.y - cam.scrollY;

      // 방사형 그라디언트: 중심 alpha → 0 (5단계)
      const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
      const r = light.radius;
      const steps = 5;
      for (let i = 0; i < steps; i++) {
        const ratio = (steps - i) / steps;          // 1.0 → 0.2
        const stepAlpha = cfg.alpha * ratio * ratio; // 이차곡선으로 부드럽게
        gfx.fillStyle(cfg.color, stepAlpha);
        gfx.fillCircle(screenX, screenY, r * (i + 1) / steps);
      }
      this.rt.draw(gfx, 0, 0);
      gfx.destroy();
    }
  }
}
```

---

## 3. 횃불 불꽃 스프라이트 (`TorchFlameSprite`)

### 3-1. 스프라이트시트 명세

설치형 횃불: 16×24px, 4프레임 애니메이션

```
frame 0: 불꽃 좁음 (아래 주황, 위 노랑, 팁 흰색)
frame 1: 불꽃 중간 좌측 기울기
frame 2: 불꽃 넓음 (팽창)
frame 3: 불꽃 중간 우측 기울기
```

```typescript
function drawTorchFlame(
  ctx: CanvasRenderingContext2D,
  frame: 0 | 1 | 2 | 3
): void {
  const W = 16, H = 24;

  // 횃불 자루 (아래 8px)
  ctx.fillStyle = '#5a3a10';
  ctx.fillRect(6, 16, 4, 8);

  // 횃불 머리 (재/숯 부분)
  ctx.fillStyle = '#3a2808';
  ctx.fillRect(5, 13, 6, 4);

  // 불꽃 (위 16px) — frame에 따라 형태 변화
  const offsets = [0, -2, 0, 2];  // frame별 X 오프셋
  const widths  = [5, 4, 7, 4];   // frame별 너비
  const ox = offsets[frame];
  const fw = widths[frame];

  // 바닥 주황
  const grad = ctx.createLinearGradient(0, 12, 0, 0);
  grad.addColorStop(0.0, 'rgba(240,100,10,0.95)');
  grad.addColorStop(0.4, 'rgba(255,180,20,0.9)');
  grad.addColorStop(0.75, 'rgba(255,240,100,0.8)');
  grad.addColorStop(1.0,  'rgba(255,255,220,0.0)');
  ctx.fillStyle = grad;

  // 불꽃 삼각 베지에 경로
  ctx.beginPath();
  ctx.moveTo(W/2 + ox - fw/2, 13);
  ctx.quadraticCurveTo(W/2 + ox - fw*0.8, 6, W/2 + ox, 0);
  ctx.quadraticCurveTo(W/2 + ox + fw*0.8, 6, W/2 + ox + fw/2, 13);
  ctx.closePath();
  ctx.fill();

  // 중심 밝은 코어
  ctx.fillStyle = 'rgba(255,255,200,0.6)';
  ctx.beginPath();
  ctx.ellipse(W/2 + ox, 9, fw * 0.25, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}
```

### 3-2. 횃불 애니메이션 등록

```typescript
// SpriteGenerator에서 스프라이트시트 생성 후:
scene.anims.create({
  key: 'torch_burn',
  frames: scene.anims.generateFrameNumbers('torch_sheet', { start: 0, end: 3 }),
  frameRate: 8,
  repeat: -1
});

// 설치 시
const torchSprite = scene.add.sprite(worldX, worldY, 'torch_sheet')
  .play('torch_burn')
  .setDepth(30 + worldY / TILE_SIZE * 0.01);
```

### 3-3. 횃불 불꽃 파티클 (소형 ember)

```typescript
function createTorchEmber(scene: Phaser.Scene, x: number, y: number): void {
  scene.add.particles(x, y - 8, 'fx_pixel', {
    tint:      [0xff8010, 0xffb020, 0xffcc40],
    speed:     { min: 8, max: 25 },
    angle:     { min: -110, max: -70 },   // 위로
    scale:     { start: 0.7, end: 0 },
    alpha:     { start: 0.9, end: 0 },
    lifespan:  { min: 300, max: 600 },
    frequency: 120,                        // 0.12초마다 1개
    blendMode: Phaser.BlendModes.ADD,
    depth:     31
  });
}
```

---

## 4. 실내 조명 분위기 (`IndoorLightingSystem`)

plan 31 실내/문 시스템 + plan 32 DarknessLayer 연계.

### 4-1. 실내 상태별 조명

```typescript
const INDOOR_LIGHT_CONFIGS = {
  // 캠프파이어 없음 + 횃불 없음
  dark: {
    darknessAlphaMultiplier: 1.2,   // 실외보다 더 어두움
    ambientColor:  0x100820,
    ambientAlpha:  0.0,
  },
  // 횃불 있음
  torch: {
    darknessAlphaMultiplier: 0.7,   // 약간 밝아짐
    ambientColor:  0xff8820,
    ambientAlpha:  0.04,
  },
  // 캠프파이어 있음 (실내 모닥불)
  campfire: {
    darknessAlphaMultiplier: 0.5,
    ambientColor:  0xff5010,
    ambientAlpha:  0.08,
  },
};
```

### 4-2. 실내 천장 그림자 (plan 49와 연계)

```typescript
// plan 49 setRoofTransparency 후 천장 내부 그림자 보강
function drawIndoorCeilingShadow(
  gfx: Phaser.GameObjects.Graphics,
  roomBounds: Phaser.Geom.Rectangle
): void {
  // 4면 그라디언트 어두운 띠 (각 16px)
  const { x, y, width: w, height: h } = roomBounds;
  const shadowColor = 0x000000;
  const steps = 4;

  for (let i = 0; i < steps; i++) {
    const alpha = 0.15 * (1 - i / steps);
    gfx.fillStyle(shadowColor, alpha);

    // 상단
    gfx.fillRect(x + i * 4, y + i * 4, w - i * 8, 4);
    // 하단
    gfx.fillRect(x + i * 4, y + h - (i + 1) * 4, w - i * 8, 4);
    // 좌측
    gfx.fillRect(x + i * 4, y + i * 4 + 4, 4, h - i * 8 - 8);
    // 우측
    gfx.fillRect(x + w - (i + 1) * 4, y + i * 4 + 4, 4, h - i * 8 - 8);
  }
}
```

---

## 5. 문 개폐 애니메이션 (`DoorAnimator`)

plan 31(문/실내)에서 문 개폐 비주얼이 미정의됨.

### 5-1. 문 스프라이트 명세

문: 16×32px, 3프레임 (닫힘/반열림/완전열림)

```typescript
function drawDoorSprite(
  ctx: CanvasRenderingContext2D,
  frame: 0 | 1 | 2,           // 0=닫힘, 1=반열림, 2=열림
  material: 'wood' | 'iron'
): void {
  const W = 16, H = 32;
  const colors = material === 'wood'
    ? { body: '#7a4a20', trim: '#5a3010', knob: '#c8a020' }
    : { body: '#707070', trim: '#404040', knob: '#a0a0a0' };

  if (frame === 0) {
    // 닫힘: 전면 직사각형
    ctx.fillStyle = colors.body;
    ctx.fillRect(1, 0, W - 2, H);
    // 문 판자 패턴
    ctx.fillStyle = colors.trim;
    ctx.fillRect(3, 4,  10, 10);
    ctx.fillRect(3, 18, 10, 10);
    // 손잡이
    ctx.fillStyle = colors.knob;
    ctx.fillRect(10, 14, 3, 4);
  } else if (frame === 1) {
    // 반열림: 원근감 표현 (너비 절반)
    ctx.fillStyle = colors.body;
    ctx.fillRect(1, 0, (W - 2) / 2, H);
    ctx.fillStyle = colors.trim;
    ctx.fillRect(2, 4, 4, 8);
  } else {
    // 완전열림: 세로로 얇게 (벽에 붙어있는 느낌)
    ctx.fillStyle = colors.body;
    ctx.fillRect(1, 0, 3, H);
    ctx.fillStyle = colors.trim;
    ctx.fillRect(2, 0, 1, H);
  }
}
```

### 5-2. 문 개폐 tween

```typescript
class DoorAnimator {
  open(doorSprite: Phaser.GameObjects.Sprite): void {
    // frame 0 → 1 (100ms) → 2 (100ms)
    doorSprite.setFrame(1);
    scene.time.delayedCall(100, () => doorSprite.setFrame(2));

    // 문 열리는 사운드 큐 (plan 26 SoundSystem.play)
    // SoundSystem.play('door_open');

    // 목재 먼지 파티클 2개 (경첩 위치)
    spawnDoorDust(doorSprite.x, doorSprite.y);
  }

  close(doorSprite: Phaser.GameObjects.Sprite): void {
    doorSprite.setFrame(1);
    scene.time.delayedCall(120, () => doorSprite.setFrame(0));

    // 닫힐 때 약한 카메라 흔들림 (plan 50 ScreenShakeSystem)
    ScreenShakeSystem.trigger('door_close');
  }

  private spawnDoorDust(x: number, y: number): void {
    const emitter = scene.add.particles(x, y, 'fx_pixel', {
      tint:    [0xc8a870, 0xe0c090],
      speed:   { min: 10, max: 30 },
      angle:   { min: 150, max: 210 },
      scale:   { start: 0.6, end: 0 },
      lifespan: 400,
      quantity: 3,
      emitting: false
    });
    emitter.explode(3);
    scene.time.delayedCall(500, () => emitter.destroy());
  }
}
```

---

## 6. 깜빡임 개선 (Enhanced Flicker)

plan 32의 단순 사인파 깜빡임을 퍼린 노이즈 기반으로 업그레이드:

```typescript
class FlickerSystem {
  private seeds = new Map<string, number>();

  // 광원 ID별 독립적인 깜빡임 (동기화 방지)
  getFlickerRadius(lightId: string, baseRadius: number, time: number): number {
    if (!this.seeds.has(lightId)) {
      this.seeds.set(lightId, Math.random() * 1000);
    }
    const seed = this.seeds.get(lightId)!;
    const t = time / 1000 + seed;

    // 3개 사인파 중첩으로 불규칙함 표현
    const s1 = Math.sin(t * 2.1) * 0.5;
    const s2 = Math.sin(t * 3.7 + 1.3) * 0.3;
    const s3 = Math.sin(t * 7.3 + 2.7) * 0.2;
    const noise = (s1 + s2 + s3) / 1.0;  // -1 ~ +1

    // 광원별 진폭
    const AMP: Record<LightType, number> = {
      player_torch: 8,
      placed_torch: 6,
      campfire:     14,
      player_body:  0,
    };
    const amp = AMP[getLightType(lightId)] ?? 6;
    return baseRadius + noise * amp;
  }

  // 강한 바람 시 깜빡임 증폭 (weather system 연계)
  getWindMultiplier(weather: WeatherType): number {
    return weather === 'storm' || weather === 'blizzard' ? 1.8 : 1.0;
  }
}
```

---

## 7. 하늘 오브젝트 통합 (`SkyLayer`)

plan 44 getSkyTint + plan 51 stars + 이번 달 → 하나의 SkyLayer 클래스로 정리

```typescript
class SkyLayer {
  private sunSprite: Phaser.GameObjects.Graphics;
  private moonSystem: MoonSystem;
  private starSprites: Phaser.GameObjects.Image[];
  private skyGradient: Phaser.GameObjects.Graphics;

  update(gameHour: number, gameDay: number): void {
    // 1. 하늘 배경 그라디언트 (plan 44 getSkyTint)
    this.updateSkyGradient(gameHour);

    // 2. 태양 위치 (06:00~18:00 호 궤적)
    this.updateSun(gameHour);

    // 3. 달 위치·위상 (18:00~06:00)
    this.moonSystem.update(gameHour, gameDay);

    // 4. 별 가시성 (plan 44 연계)
    const starAlpha = gameHour < 6 ? 0.9 : gameHour < 7 ? 1 - (gameHour - 6) : gameHour > 20 ? gameHour - 20 : 0;
    this.starSprites.forEach(s => s.setAlpha(Math.min(0.9, starAlpha)));
  }

  private updateSun(gameHour: number): void {
    if (gameHour < 6 || gameHour > 18) { this.sunSprite.setVisible(false); return; }
    this.sunSprite.setVisible(true);

    const t = (gameHour - 6) / 12;  // 0~1
    const cam = scene.cameras.main;
    const x = cam.width * 0.1 + cam.width * 0.8 * t;
    const y = cam.height * 0.25 - Math.sin(t * Math.PI) * (cam.height * 0.18);

    this.sunSprite.clear().setPosition(x, y);

    // 태양 크기: 아침·저녁 크게 (신기루), 정오 작게
    const size = 12 + Math.abs(t - 0.5) * 2 * 8;
    // 태양 색: 아침 주황 → 정오 노랑 → 저녁 주황-빨강
    const sunColor = t < 0.5
      ? lerpColor(0xff8020, 0xffe040, t * 2)
      : lerpColor(0xffe040, 0xff4010, (t - 0.5) * 2);

    // 태양 글로우
    this.sunSprite.fillStyle(sunColor, 0.2).fillCircle(0, 0, size * 2);
    this.sunSprite.fillStyle(sunColor, 0.6).fillCircle(0, 0, size * 1.3);
    this.sunSprite.fillStyle(0xffffff, 0.9).fillCircle(0, 0, size);
  }
}
```

---

## 8. 깊이(Depth) 할당

| 오브젝트 | depth |
|----------|-------|
| 하늘 그라디언트 | -2 (plan 44: -1이 별, -2가 가장 뒤) |
| 태양 | 0 |
| 달 | 1 |
| 별 | -1 (plan 44 그대로) |
| 따뜻한 빛 레이어 (ADD) | 49 |
| DarknessLayer | 50 (plan 32 그대로) |
| 달빛 블루 오버레이 | 48 |
| 횃불 불꽃 스프라이트 | 오브젝트 레이어 depth+1 (~31) |
| 횃불 ember 파티클 | 31 |
| 실내 천장 그림자 | 67 (plan 49 roof depth + 2) |

---

## 9. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/systems/SkyLayer.ts` | 하늘·태양·달·별 통합 렌더링 |
| `src/systems/MoonSystem.ts` | 달 위상 계산, 위치 궤적 |
| `src/systems/WarmLightLayer.ts` | 광원 따뜻한 색상 틴트 ADD 레이어 |
| `src/systems/FlickerSystem.ts` | 3중 사인파 깜빡임, 바람 연계 |
| `src/systems/IndoorLightingSystem.ts` | 실내 조명 분위기, 천장 그림자 |
| `src/systems/DoorAnimator.ts` | 문 3프레임 개폐 tween, 먼지 파티클 |
| `src/generators/SpriteGenerator.ts` | drawTorchFlame, drawMoon, drawDoorSprite 추가 |

---

## 10. 버전

`v0.53.0`
