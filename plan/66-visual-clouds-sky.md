# Plan 66 — 구름·하늘 디테일 비주얼 (Visual Clouds & Sky Detail)

## 개요

plan 44(하늘 색조·별), plan 53(태양·달)에서 다루지 않은  
**구름 스프라이트**, **구름 움직임**, **지상 구름 그림자**,  
**일출·일몰 빛 줄기**, **폭풍 먹구름** 등 하늘 분위기를 완성한다.

---

## 1. 구름 스프라이트 (`CloudSpriteGenerator`)

### 1-1. 구름 타입 정의

| 타입 | 크기 | 특징 |
|------|------|------|
| `cumulus_small` | 64×28px | 뭉게구름 소형 |
| `cumulus_large` | 120×44px | 뭉게구름 대형 |
| `cirrus`        | 96×18px | 새털구름 (얇고 길게) |
| `storm_cloud`   | 160×56px | 먹구름 (어둡고 납작) |

### 1-2. 구름 스프라이트 생성

```typescript
function drawCloud(
  ctx: CanvasRenderingContext2D,
  type: CloudType,
  tint: CloudTint   // 'day' | 'sunset' | 'dawn' | 'storm'
): void {
  const configs: Record<CloudType, { W: number; H: number }> = {
    cumulus_small: { W: 64,  H: 28 },
    cumulus_large: { W: 120, H: 44 },
    cirrus:        { W: 96,  H: 18 },
    storm_cloud:   { W: 160, H: 56 },
  };
  const { W, H } = configs[type];

  const cloudColors: Record<CloudTint, { body: string; shadow: string; highlight: string }> = {
    day:    { body: '#f8f8f8', shadow: 'rgba(180,180,200,0.6)', highlight: 'rgba(255,255,255,0.9)' },
    sunset: { body: '#f0c080', shadow: 'rgba(200,100,60,0.6)',  highlight: 'rgba(255,220,140,0.9)' },
    dawn:   { body: '#e8b0c0', shadow: 'rgba(180,100,140,0.5)', highlight: 'rgba(255,200,220,0.9)' },
    storm:  { body: '#606070', shadow: 'rgba(40,40,50,0.8)',    highlight: 'rgba(90,90,100,0.6)'  },
  };
  const c = cloudColors[tint];

  if (type === 'cirrus') {
    // 새털구름: 얇은 호들을 겹쳐서
    for (let i = 0; i < 4; i++) {
      const cx = W * (0.15 + i * 0.22), cy = H * 0.5;
      const rx = W * 0.14, ry = H * 0.35;
      ctx.fillStyle = c.body;
      ctx.globalAlpha = 0.5 - i * 0.05;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, -0.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (type === 'storm_cloud') {
    // 먹구름: 납작한 층 + 아래쪽 평평
    ctx.fillStyle = c.shadow;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);
    // 상단 울퉁불퉁 실루엣
    ctx.fillStyle = c.body;
    const bumps = [
      { x: W*0.05, r: H*0.35 }, { x: W*0.2,  r: H*0.40 },
      { x: W*0.38, r: H*0.45 }, { x: W*0.55, r: H*0.38 },
      { x: W*0.72, r: H*0.42 }, { x: W*0.88, r: H*0.32 },
    ];
    bumps.forEach(b => {
      ctx.beginPath(); ctx.arc(b.x, H*0.5, b.r, Math.PI, 0, false); ctx.fill();
    });
    // 하이라이트 (상단)
    ctx.fillStyle = 'rgba(100,100,110,0.3)';
    ctx.fillRect(0, 0, W, H * 0.15);
    return;
  }

  // cumulus 공통
  // 1. 그림자 층 (약간 아래)
  ctx.fillStyle = c.shadow;
  ctx.beginPath();
  ctx.ellipse(W*0.5, H*0.72, W*0.42, H*0.22, 0, 0, Math.PI*2); ctx.fill();

  // 2. 본체 (여러 원 오버랩)
  ctx.fillStyle = c.body;
  const blobCount = type === 'cumulus_large' ? 6 : 4;
  for (let i = 0; i < blobCount; i++) {
    const cx = W * (0.12 + i * (0.76 / (blobCount - 1)));
    const cy = H * 0.52;
    const r  = type === 'cumulus_large'
      ? H * (0.28 + (i === 1 || i === 3 ? 0.14 : 0))
      : H * (0.30 + (i === 1 ? 0.15 : 0));
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
  }
  // 상단 하이라이트 블롭
  ctx.fillStyle = c.highlight;
  ctx.beginPath();
  ctx.ellipse(W * 0.38, H * 0.28,
    type === 'cumulus_large' ? W*0.16 : W*0.12,
    type === 'cumulus_large' ? H*0.22 : H*0.18,
    -0.3, 0, Math.PI*2); ctx.fill();
}
```

---

## 2. 구름 레이어 시스템 (`CloudLayerSystem`)

### 2-1. 2개 깊이 레이어 (원근감 패럴랙스)

```typescript
interface CloudInstance {
  id:       string;
  type:     CloudType;
  x:        number;    // 월드 X (매우 큰 값, 하늘 전체)
  y:        number;    // 화면 Y (고정 범위 내 랜덤)
  speed:    number;    // px/s
  alpha:    number;
  scale:    number;
  layer:    0 | 1;     // 0 = 먼 레이어, 1 = 가까운 레이어
  tint:     CloudTint;
}

class CloudLayerSystem {
  private clouds: CloudInstance[] = [];
  private readonly SPAWN_INTERVAL = 8000;   // 8s마다 새 구름
  private readonly LAYER_CONFIGS = [
    { speedMin: 8,  speedMax: 14, yMin: 20,  yMax: 60,  alphaMin: 0.5, alphaMax: 0.7, scale: 0.7, depth: 2 },
    { speedMin: 18, speedMax: 26, yMin: 50,  yMax: 110, alphaMin: 0.7, alphaMax: 0.9, scale: 1.0, depth: 3 },
  ];

  init(cam: Phaser.Cameras.Scene2D.Camera): void {
    // 초기 구름 8~12개 랜덤 배치
    const count = Phaser.Math.Between(8, 12);
    for (let i = 0; i < count; i++) {
      this.spawnCloud(cam, Phaser.Math.Between(0, cam.width));
    }
    // 주기적 추가 생성
    scene.time.addEvent({
      delay: this.SPAWN_INTERVAL, loop: true,
      callback: () => this.spawnCloud(cam, cam.width + 60)
    });
  }

  private spawnCloud(cam: Phaser.Cameras.Scene2D.Camera, startX: number): void {
    const layer = (Math.random() < 0.4 ? 0 : 1) as 0 | 1;
    const cfg   = this.LAYER_CONFIGS[layer];
    const types: CloudType[] = ['cumulus_small', 'cumulus_large', 'cirrus'];
    const type  = types[Math.floor(Math.random() * types.length)];

    const inst: CloudInstance = {
      id:    Math.random().toString(36).slice(2),
      type,
      x:     startX,
      y:     cfg.yMin + Math.random() * (cfg.yMax - cfg.yMin),
      speed: cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin),
      alpha: cfg.alphaMin + Math.random() * (cfg.alphaMax - cfg.alphaMin),
      scale: cfg.scale * (0.85 + Math.random() * 0.30),
      layer,
      tint:  this.getCurrentTint(),
    };
    this.clouds.push(inst);
    this.createCloudSprite(inst, cfg.depth);
  }

  update(delta: number, gameHour: number): void {
    const newTint = this.getCurrentTint(gameHour);
    this.clouds.forEach(cloud => {
      cloud.x -= cloud.speed * (delta / 1000);
      const sprite = this.getSprite(cloud.id);
      if (sprite) {
        sprite.setX(cloud.x);
        // 화면 밖으로 나가면 제거
        if (cloud.x < -200) {
          sprite.destroy();
          this.clouds = this.clouds.filter(c => c.id !== cloud.id);
        }
      }
      // tint 변경 시 텍스처 재생성 (느리므로 변경 시에만)
      if (cloud.tint !== newTint) {
        cloud.tint = newTint;
        this.updateCloudTexture(cloud);
      }
    });
  }

  getCurrentTint(gameHour = getCurrentGameHour()): CloudTint {
    if (gameHour >= 5.5 && gameHour < 7.5)  return 'dawn';
    if (gameHour >= 7.5 && gameHour < 17.5) return 'day';
    if (gameHour >= 17.5 && gameHour < 20)  return 'sunset';
    return 'day';
  }
}
```

### 2-2. 날씨별 구름 조정

```typescript
function applyWeatherClouds(weather: WeatherType): void {
  switch (weather) {
    case 'clear':
      setMaxClouds(4);
      break;
    case 'cloudy':
      setMaxClouds(10);
      break;
    case 'rain':
    case 'storm':
      // 먹구름으로 교체 (기존 구름 fadeOut → storm_cloud fadeIn)
      replaceWithStormClouds();
      setMaxClouds(14);
      break;
    case 'blizzard':
      // 짙은 회색 + 빠른 속도
      setStormCloudSpeed(1.8);
      setMaxClouds(16);
      break;
    case 'fog':
      // 구름 숨김 (안개가 덮음)
      setMaxClouds(0);
      break;
  }
}

function replaceWithStormClouds(): void {
  cloudLayer.clouds.forEach(cloud => {
    const sprite = cloudLayer.getSprite(cloud.id);
    scene.tweens.add({
      targets: sprite, alpha: 0, duration: 3000,
      onComplete: () => {
        cloud.type = 'storm_cloud';
        cloud.tint = 'storm';
        cloudLayer.updateCloudTexture(cloud);
        scene.tweens.add({ targets: sprite, alpha: cloud.alpha, duration: 3000 });
      }
    });
  });
}
```

---

## 3. 지상 구름 그림자 (`CloudShadowLayer`)

구름이 지나가는 위치 아래 지면에 흐릿한 타원 그림자:

```typescript
class CloudShadowLayer {
  private shadowGfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.shadowGfx = scene.add.graphics()
      .setDepth(4)   // 지면 타일 위, 오브젝트 아래
      .setScrollFactor(1);
  }

  update(clouds: CloudInstance[], cam: Phaser.Cameras.Scene2D.Camera): void {
    this.shadowGfx.clear();

    clouds.forEach(cloud => {
      if (cloud.tint === 'storm') return;    // 폭풍 구름은 별도 처리

      // 구름 화면 좌표 → 지면 투영 (약간 오른쪽 아래)
      const shadowX = cam.scrollX + cloud.x + 30;
      const shadowY = cam.scrollY + 120 + cloud.layer * 40;   // 고도 반영
      const w = (cloud.type === 'cumulus_large' ? 120 : 64) * cloud.scale;
      const h = w * 0.25;

      this.shadowGfx.fillStyle(0x000000, 0.06 * cloud.alpha);
      this.shadowGfx.fillEllipse(shadowX, shadowY, w, h);
    });
  }
}
```

---

## 4. 일출·일몰 빛 줄기 (`SunRayEffect`)

```typescript
class SunRayEffect {
  private rayGfx: Phaser.GameObjects.Graphics;
  private angle = 0;

  update(gameHour: number, sunX: number, sunY: number): void {
    // 일출(6~8시) / 일몰(17~19시) 구간만 활성
    const isDawnOrDusk =
      (gameHour >= 6 && gameHour < 8) || (gameHour >= 17 && gameHour < 19);

    if (!isDawnOrDusk) { this.rayGfx.setVisible(false); return; }
    this.rayGfx.setVisible(true);

    // 강도: 0.0~1.0 (양 끝 구간에서 최대)
    const t = gameHour < 12
      ? 1 - Math.abs((gameHour - 7) / 1)    // 일출 피크 7시
      : 1 - Math.abs((gameHour - 18) / 1);  // 일몰 피크 18시
    const intensity = Math.max(0, Math.min(1, t));

    this.angle += 0.3;   // 천천히 회전 (대기 산란 느낌)

    this.rayGfx.clear();
    const RAY_COUNT = 8;
    for (let i = 0; i < RAY_COUNT; i++) {
      const baseAngle = (i / RAY_COUNT) * Math.PI * 2 + this.angle * Math.PI / 180;
      const rayAlpha = (0.04 + Math.random() * 0.03) * intensity;
      const rayLen   = 200 + Math.random() * 80;
      const rayWidth = 18 + Math.random() * 14;

      // 태양에서 바깥으로 퍼지는 삼각형
      const ex1 = sunX + Math.cos(baseAngle - 0.08) * rayLen;
      const ey1 = sunY + Math.sin(baseAngle - 0.08) * rayLen;
      const ex2 = sunX + Math.cos(baseAngle + 0.08) * rayLen;
      const ey2 = sunY + Math.sin(baseAngle + 0.08) * rayLen;

      const rayColor = gameHour < 12 ? 0xffe080 : 0xff9040;
      this.rayGfx.fillStyle(rayColor, rayAlpha);
      this.rayGfx.fillTriangle(sunX, sunY, ex1, ey1, ex2, ey2);
    }
  }
}
```

---

## 5. 달무리 (Moon Halo)

```typescript
// plan 53 MoonSystem 확장 — 달 주변 무리
function drawMoonHalo(
  gfx: Phaser.GameObjects.Graphics,
  moonX: number, moonY: number,
  phase: number   // 0.3~0.7(보름달 근처) 구간에서만 표시
): void {
  const strength = Math.max(0, 1 - Math.abs(phase - 0.5) * 4);  // 보름달 근처 최대
  if (strength < 0.1) return;

  // 3개 동심원 (희미한 무지개빛)
  const haloDef = [
    { r: 26, color: 0xffeedd, alpha: 0.12 },
    { r: 32, color: 0xddeeff, alpha: 0.08 },
    { r: 38, color: 0xffeedd, alpha: 0.05 },
  ];
  haloDef.forEach(h => {
    gfx.lineStyle(3, h.color, h.alpha * strength);
    gfx.strokeCircle(moonX, moonY, h.r);
  });
}
```

---

## 6. 무지개 (Rainbow — 비 갠 직후)

```typescript
function showRainbow(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  const cx = cam.width * 0.6, cy = cam.height * 0.55;
  const gfx = scene.add.graphics()
    .setScrollFactor(0).setDepth(6).setAlpha(0);

  const RAINBOW_COLORS = [0xff2020, 0xff8020, 0xffc020, 0x40c020, 0x2080ff, 0x8020ff];
  RAINBOW_COLORS.forEach((color, i) => {
    gfx.lineStyle(4, color, 0.18);
    gfx.beginPath();
    gfx.arc(cx, cy, 120 + i * 8, Math.PI * 0.9, Math.PI * 2.1, false);
    gfx.strokePath();
  });

  // 비 종료 후 20s 동안 표시
  scene.tweens.add({ targets: gfx, alpha: 1, duration: 3000 });
  scene.time.delayedCall(20000, () => {
    scene.tweens.add({ targets: gfx, alpha: 0, duration: 5000,
      onComplete: () => gfx.destroy() });
  });
}
```

---

## 7. 하늘 오브젝트 깊이 통합 (plan 53 SkyLayer 확장)

```typescript
// plan 53 SkyLayer.update()에 추가
class SkyLayer {
  private cloudSystem:  CloudLayerSystem;
  private cloudShadow:  CloudShadowLayer;
  private sunRayEffect: SunRayEffect;

  update(gameHour: number, gameDay: number, weather: WeatherType): void {
    this.updateSkyGradient(gameHour);          // plan 44
    this.updateSun(gameHour);                  // plan 53
    this.moonSystem.update(gameHour, gameDay); // plan 53
    this.cloudSystem.update(scene.game.loop.delta, gameHour);
    this.cloudShadow.update(this.cloudSystem.clouds, scene.cameras.main);
    this.sunRayEffect.update(gameHour, this.getSunPosition(gameHour));
    applyWeatherClouds(weather);
  }
}
```

---

## 8. 깊이(Depth) 할당

| 오브젝트 | depth | ScrollFactor |
|----------|-------|--------------|
| 하늘 그라디언트 | -2 | 0 |
| 태양 | 0 | 0 |
| 달 | 1 | 0 |
| 구름 먼 레이어 | 2 | 0 |
| 구름 가까운 레이어 | 3 | 0 |
| 지상 구름 그림자 | 4 | 1 |
| 빛 줄기 | 5 | 0 |
| 무지개 | 6 | 0 |
| 달무리 | 1.5 | 0 |
| 별 | -1 (plan 44) | 0 |

---

## 9. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/generators/CloudSpriteGenerator.ts` | 4종 구름 Canvas 드로잉 |
| `src/systems/CloudLayerSystem.ts` | 구름 인스턴스 관리, 패럴랙스 이동 |
| `src/systems/CloudShadowLayer.ts` | 지상 그림자 타원 |
| `src/systems/SunRayEffect.ts` | 빛 줄기 삼각형 회전 |
| `src/systems/SkyLayer.ts` | plan 53 확장 — 통합 업데이트 |
| `src/systems/WeatherVisual.ts` | showRainbow, 먹구름 교체 |

---

## 10. 버전

`v0.66.0`
