# 설계 45 — 날씨 비주얼 파티클 시스템

> **전제 조건**: 01~44 단계 완료 상태.
> plan 08(날씨 시스템), plan 09(기본 파티클), plan 35(날씨 패널티)를 기반으로
> 각 날씨 유형의 화면 전체 비주얼 파티클을 상세히 확정한다.

---

## 1. 이번 단계 목표

1. **비** — 빗방울 낙하 파티클 + 지면 파문 + 유리창 빗물 효과
2. **눈** — 눈송이 낙하 + 지면 쌓임 (plan 41 연동)
3. **안개** — 화면 전체 흐림 오버레이 + 흐르는 안개 레이어
4. **폭풍** — 강한 비 + 번개 + 화면 흔들림
5. **블리자드** — 폭설 + 수평 강풍 + 화면 채도 감소
6. **낙엽** — 가을 낙엽이 흩날리는 연출
7. **날씨 전환** — 날씨 변경 시 파티클 부드럽게 교체

---

## 2. 파티클 시스템 구조

### 2-1. WeatherParticleSystem 기본 설계

```typescript
export class WeatherParticleSystem {
  private emitters: Map<WeatherType, Phaser.GameObjects.Particles.ParticleEmitter[]>;
  private overlays:  Map<WeatherType, Phaser.GameObjects.GameObject>;
  private current:   WeatherType = 'clear';
  private intensity: number = 0;    // 0~1, 날씨 강도 (전환 중 보간)

  setWeather(type: WeatherType, fadeDuration: number): void
  update(delta: number, cameraX: number, cameraY: number): void
  setIndoor(indoor: boolean): void   // 실내 시 파티클 숨김
}
```

파티클은 카메라 고정 좌표계(UI 레이어)에 렌더:
```typescript
// 카메라 스크롤과 무관하게 화면에 고정
emitter.setScrollFactor(0);
emitter.setDepth(50);   // 타일·캐릭터 위, UI 아래
```

---

## 3. 비 (Rain)

### 3-1. 빗방울 파티클

```typescript
// 파티클 텍스처: 1×6px 흰 직선 (약간 투명)
// SpriteGenerator에서 'fx_raindrop' 키로 생성
function createRainDrop(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createLinearGradient(0, 0, 0, 6);
  grad.addColorStop(0, 'rgba(180,210,255,0.0)');
  grad.addColorStop(1, 'rgba(180,210,255,0.8)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, 6);
}

const rainConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
  x: { min: -50, max: 850 },    // 화면 전체 폭 + 여유
  y: -10,                        // 화면 상단 밖에서 생성
  speedX: { min: -30, max: -10 },// 약간 왼쪽으로 (바람)
  speedY: { min: 380, max: 460 },// 빠르게 낙하
  angle: { min: 75, max: 80 },   // 거의 수직, 약간 기울어짐
  scale: { min: 0.8, max: 1.2 },
  alpha: { min: 0.4, max: 0.7 },
  lifespan: { min: 800, max: 1200 },
  quantity: 4,                   // 매 프레임 4개 생성
  frequency: 16,                 // 16ms마다 (60fps)
  blendMode: Phaser.BlendModes.ADD,
};
```

### 3-2. 지면 파문 (빗방울 착지)

```typescript
// 착지 위치: 빗방울 lifespan 종료 지점 (화면 하단 근처)
// 파문: 투명 원 → scale 0.2→1.5, alpha 0.5→0, 400ms
// 물 타일 위에서만 강조 (흰 파문), 흙 타일은 작은 먼지 파문

const rippleConfig = {
  scale:   { start: 0.15, end: 1.2 },
  alpha:   { start: 0.45, end: 0.0 },
  lifespan: 380,
  quantity: 1,
  frequency: 40,   // 빗방울의 1/2.5 빈도
  tint: 0xaaccff,
};
```

### 3-3. 빗물 오버레이 (유리창 효과)

```typescript
// 화면 전체에 세로 물줄기 몇 가닥이 흘러내리는 효과
// RenderTexture에 매 0.3초마다 랜덤 위치에 세로 선 그리기
// alpha 0.06~0.12 (매우 미세하게)
const waterSlide = scene.add.renderTexture(0, 0, 800, 600)
  .setScrollFactor(0).setDepth(49).setAlpha(0.08);

scene.time.addEvent({
  delay: 300, loop: true,
  callback: () => {
    const gfx = scene.make.graphics({ add: false });
    gfx.fillStyle(0xaaddff, 1.0);
    const x = Phaser.Math.Between(0, 800);
    const len = Phaser.Math.Between(30, 80);
    gfx.fillRect(x, Phaser.Math.Between(0, 400), 1, len);
    waterSlide.draw(gfx); gfx.destroy();
    // 오래된 흔적 서서히 지우기
    waterSlide.setAlpha(Math.max(0.04, waterSlide.alpha - 0.005));
  },
});
```

---

## 4. 눈 (Snow)

### 4-1. 눈송이 파티클

```typescript
// 텍스처: 4×4px 흰 다이아몬드 (6각 눈송이 근사)
function createSnowflake(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = 'rgba(220,235,255,0.9)';
  ctx.beginPath();
  ctx.moveTo(2, 0); ctx.lineTo(4, 2);
  ctx.lineTo(2, 4); ctx.lineTo(0, 2);
  ctx.closePath(); ctx.fill();
}

const snowConfig = {
  x: { min: -20, max: 840 },
  y: -10,
  speedX: { min: -15, max: 15 },  // 좌우 흔들림
  speedY: { min: 40, max: 90 },   // 비보다 느리게
  rotate: { min: -60, max: 60 },  // 회전하며 낙하
  scale: { min: 0.6, max: 1.8 },  // 크기 다양
  alpha: { min: 0.5, max: 0.95 },
  lifespan: { min: 3000, max: 5000 },
  quantity: 2,
  frequency: 30,
  // 좌우 흔들림 (사인파 적용)
  gravityX: 0,  gravityY: 20,
};

// 눈송이 흔들림: 매 프레임 sin(time + id) × 8 로 x 오프셋
emitter.forEachAlive((particle) => {
  particle.x += Math.sin((scene.time.now * 0.001) + particle.angle) * 0.3;
});
```

---

## 5. 안개 (Fog)

### 5-1. 흐름 안개 레이어 (2레이어 교차)

```typescript
// 안개: 큰 반투명 흰색 구름 텍스처가 천천히 흘러감
// 텍스처: 256×128px 그라디언트 타원 구름 (alpha 0~0.4~0)
function createFogTexture(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createRadialGradient(128, 64, 0, 128, 64, 128);
  grad.addColorStop(0,   'rgba(220,225,230, 0.38)');
  grad.addColorStop(0.5, 'rgba(210,218,225, 0.18)');
  grad.addColorStop(1,   'rgba(200,210,220, 0.00)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);
}

// 레이어 A: 오른쪽으로 천천히 이동 (8px/s)
// 레이어 B: 왼쪽으로 천천히 이동 (5px/s), 세로 오프셋 +60px
// 두 레이어가 교차하며 자연스러운 안개 흐름 연출
scene.tweens.add({
  targets: fogLayerA,
  x: '+=800',
  duration: 100_000,
  repeat: -1,
  onRepeat: () => { fogLayerA.x -= 800; },
});
```

### 5-2. 안개 전체 오버레이

```typescript
// 화면 전체 반투명 회청색 오버레이
const fogOverlay = scene.add.rectangle(400, 300, 800, 600, 0xc8d0d8)
  .setScrollFactor(0).setAlpha(0.28).setDepth(48);

// 안개 강도에 따라 alpha 0.15~0.35
```

---

## 6. 폭풍 (Storm)

### 6-1. 강한 비 + 바람

```typescript
// 비보다 2배 많은 빗방울 + 더 기울어진 각도
const stormRainConfig = {
  ...rainConfig,
  speedX: { min: -120, max: -80 },  // 강한 바람
  speedY: { min: 500, max: 620 },
  angle:  { min: 55, max: 65 },     // 더 기울어짐
  quantity: 10,                      // 5배 밀도
  alpha: { min: 0.5, max: 0.85 },
};
```

### 6-2. 번개

```typescript
// 15~45초 랜덤 간격으로 번개 발생
function triggerLightning(): void {
  // 1. 화면 전체 흰색 플래시 (2단계: 강→약)
  scene.cameras.main.flash(80,  255, 255, 255, false);
  scene.time.delayedCall(120, () => {
    scene.cameras.main.flash(40, 255, 255, 255, false);
  });

  // 2. 번개 선: 화면 상단에서 지면까지 지그재그
  const boltGfx = scene.add.graphics().setScrollFactor(0).setDepth(60);
  const startX = Phaser.Math.Between(100, 700);
  drawLightningBolt(boltGfx, startX, 0, startX + Phaser.Math.Between(-60, 60), 600);
  scene.time.delayedCall(120, () => boltGfx.destroy());

  // 3. 천둥: SoundSystem에 트리거
  scene.time.delayedCall(Phaser.Math.Between(200, 800), () => {
    soundSystem.playSFX('thunder');
  });

  // 4. 다음 번개 예약
  scene.time.delayedCall(Phaser.Math.Between(15_000, 45_000), triggerLightning);
}

function drawLightningBolt(
  gfx: Phaser.GameObjects.Graphics,
  x1: number, y1: number, x2: number, y2: number,
  depth = 0,
): void {
  if (depth > 4 || Math.abs(y2 - y1) < 20) {
    gfx.lineStyle(depth === 0 ? 3 : 1, 0xffffff, depth === 0 ? 0.9 : 0.5);
    gfx.beginPath(); gfx.moveTo(x1, y1); gfx.lineTo(x2, y2); gfx.strokePath();
    return;
  }
  const mx = (x1 + x2) / 2 + Phaser.Math.Between(-40, 40);
  const my = (y1 + y2) / 2;
  drawLightningBolt(gfx, x1, y1, mx, my, depth + 1);
  drawLightningBolt(gfx, mx, my, x2, y2, depth + 1);
}
```

### 6-3. 폭풍 화면 흔들림

```typescript
// 폭풍 중 카메라 미세 흔들림 (지속적)
let stormShakeTimer = 0;
// update():
stormShakeTimer += delta;
if (stormShakeTimer > Phaser.Math.Between(2000, 5000)) {
  scene.cameras.main.shake(300, 0.002);
  stormShakeTimer = 0;
}
```

---

## 7. 블리자드 (Blizzard)

### 7-1. 수평 강풍 눈 파티클

```typescript
const blizzardConfig = {
  x: 850,             // 화면 오른쪽 밖에서 생성
  y: { min: 0, max: 600 },
  speedX: { min: -600, max: -400 },  // 강한 왼쪽 바람
  speedY: { min: -30,  max: 80 },
  scale: { min: 0.4, max: 1.2 },
  alpha: { min: 0.4, max: 0.8 },
  lifespan: { min: 1200, max: 2000 },
  quantity: 8,
  frequency: 16,
  tint: [0xffffff, 0xddeeff],
};
```

### 7-2. 채도 감소 오버레이

```typescript
// 블리자드: 화면 전체 회청색 오버레이 (채도 감소 근사)
const blizzardOverlay = scene.add.rectangle(400, 300, 800, 600, 0xb0c0d8)
  .setScrollFactor(0).setAlpha(0.20).setDepth(48);

// postFX 지원 시: 카메라 채도 감소
if (scene.cameras.main.postFX) {
  scene.cameras.main.postFX.addColorMatrix().saturate(-0.4);
}
```

---

## 8. 낙엽 (Leaves — 가을 날씨)

```typescript
// 텍스처: 6×5px 타원 (주황/갈색 랜덤)
const leafColors = [0xc86010, 0xe88030, 0xa04808, 0xdd6020, 0xf0a030];

const leafConfig = {
  x: { min: -20, max: 840 },
  y: -10,
  speedX: { min: -40, max: 20 },
  speedY: { min: 30, max: 70 },
  rotate: { min: -180, max: 180 },
  rotateSpeed: { min: -2, max: 2 },   // 회전하며 낙하
  scale: { min: 0.7, max: 1.4 },
  alpha: { min: 0.6, max: 0.9 },
  lifespan: { min: 4000, max: 7000 },
  quantity: 1,
  frequency: 200,   // 드문드문 (낙엽은 비보다 훨씬 적게)
  tint: leafColors,
};

// 낙엽 흔들림: 좌우 사인파
emitter.forEachAlive((p) => {
  p.x += Math.sin(scene.time.now * 0.0008 + p.lifeT * 10) * 0.6;
});
```

---

## 9. 날씨 전환

```typescript
// 날씨 변경 시 기존 파티클 서서히 줄이고 새 파티클 늘림
function changeWeather(from: WeatherType, to: WeatherType, duration: number): void {
  // 기존 이미터 quantity를 0으로 서서히 감소
  scene.tweens.add({
    targets: { q: currentQuantity },
    q: 0, duration: duration / 2,
    onUpdate: (tween, target) => setEmitterQuantity(from, target.q),
    onComplete: () => stopEmitter(from),
  });
  // 새 이미터 quantity를 목표값으로 증가
  startEmitter(to, 0);
  scene.tweens.add({
    targets: { q: 0 },
    q: TARGET_QUANTITY[to], duration: duration / 2, delay: duration / 4,
    onUpdate: (tween, target) => setEmitterQuantity(to, target.q),
  });
}
```

---

## 10. 실내 처리

```typescript
// 실내 진입 시 모든 날씨 파티클 즉시 숨김
weatherSystem.setIndoor(true);
// → 모든 emitter.stop() + overlay.setVisible(false)

// 실외 나갈 시 즉시 재개
weatherSystem.setIndoor(false);
// → 현재 날씨 파티클 restart()
```

---

## 11. 스프라이트 추가 목록

| 키 | 크기 | 설명 |
|----|------|------|
| `fx_raindrop` | 1×6 | 빗방울 |
| `fx_snowflake` | 4×4 | 눈송이 다이아몬드 |
| `fx_fog_cloud` | 256×128 | 안개 구름 그라디언트 |
| `fx_leaf_fall` | 6×5 | 낙엽 타원 (4색 변형) |

---

## 12. 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/systems/WeatherParticleSystem.ts` | 신규: 모든 날씨 파티클 통합 |
| `src/world/SpriteGenerator.ts` | 날씨 파티클 텍스처 4종 추가 |
| `src/systems/WeatherSystem.ts` | WeatherParticleSystem 호출 연결 |
| `src/systems/SoundSystem.ts` | 번개 천둥 SFX 트리거 추가 |
| `src/scenes/GameScene.ts` | WeatherParticleSystem 통합, 실내 판정 연동 |

---

## 13. 확정 규칙

- 날씨 파티클은 카메라 스크롤 무관 (UI 좌표계 고정 — `setScrollFactor(0)`)
- 실내에서는 모든 날씨 파티클·오버레이 즉시 비표시
- 번개는 폭풍 날씨에서만 발생, 블리자드에서는 없음
- 낙엽 파티클은 가을 날씨(plan 08 `leaves` 타입)에서 상시 재생
- 날씨 전환 시 이전 파티클 페이드아웃 + 새 파티클 페이드인 겹침 (duration / 2 오버랩)
- 모바일(plan 38)에서 파티클 quantity 50% 감소 (`isTouchDevice` 기준)
- 맑음·흐림에는 파티클 없음 — 흐림은 하늘 색조만 변경 (plan 44 연동)
