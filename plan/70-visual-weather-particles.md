# Plan 70 — 날씨 파티클 심화 이펙트

## 개요

plan 44(계절·날씨 시스템)·plan 66(구름·하늘)에서 정의한 날씨 상태를  
화면에서 직접 느낄 수 있도록 **비·눈·바람·번개·안개·모래폭풍** 파티클과  
전환 이펙트를 설계한다.  
모든 파티클은 Canvas 2D 또는 Phaser Particle 시스템으로 구현하며  
카메라 스크롤을 따라가지 않는 scrollFactor 0 레이어에 배치한다.

---

## 1. 비 (Rain)

### 1-1. 빗방울 파티클

```typescript
class RainSystem {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private splashEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private intensity: 'light' | 'heavy' = 'light';

  create(scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    // 빗방울: 화면 상단에서 비스듬히 내려옴
    this.emitter = scene.add.particles(0, 0, '__DEFAULT', {
      x: { min: -40, max: W + 40 },
      y: { min: -10, max: 0 },
      speedX: { min: 40, max: 80 },      // 바람에 의해 우측 편향
      speedY: { min: 280, max: 420 },
      scale: { start: 0.15, end: 0.08 },
      alpha: { start: 0.6, end: 0.3 },
      lifespan: { min: 600, max: 900 },
      frequency: 8,   // light 모드
      quantity: 2,
      tint: 0x88aacc,
      rotate: 75,     // 비스듬한 각도
      blendMode: Phaser.BlendModes.NORMAL,
    }).setScrollFactor(0).setDepth(70);

    // 지면 튀김 파티클
    this.splashEmitter = scene.add.particles(0, H - 16, '__DEFAULT', {
      x: { min: 0, max: W },
      speedX: { min: -20, max: 20 },
      speedY: { min: -25, max: -8 },
      scale: { start: 0.2, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 250,
      frequency: 18,
      quantity: 1,
      tint: 0x9ab8d0,
      blendMode: Phaser.BlendModes.NORMAL,
    }).setScrollFactor(0).setDepth(70);
  }

  setIntensity(intensity: 'light' | 'moderate' | 'heavy'): void {
    const cfg: Record<string, { freq: number; qty: number }> = {
      light:    { freq: 12, qty: 1 },
      moderate: { freq: 6,  qty: 2 },
      heavy:    { freq: 3,  qty: 4 },
    };
    this.emitter.setFrequency(cfg[intensity].freq, cfg[intensity].qty);
    this.splashEmitter.setFrequency(cfg[intensity].freq * 1.5, cfg[intensity].qty);
  }

  stop(scene: Phaser.Scene): void {
    scene.tweens.add({
      targets: [this.emitter, this.splashEmitter],
      alpha: 0,
      duration: 2000,
      onComplete: () => {
        this.emitter.destroy();
        this.splashEmitter.destroy();
      },
    });
  }
}
```

### 1-2. 창문 물방울 오버레이 (실내)

```typescript
// 실내 진입 시 화면 유리에 맺힌 빗방울 효과 (depth 72)
class WindowRainDrops {
  private drops: Array<{ x: number; y: number; vy: number; alpha: number }> = [];
  private canvas: Phaser.GameObjects.RenderTexture;

  create(scene: Phaser.Scene, W: number, H: number): void {
    this.canvas = scene.add.renderTexture(0, 0, W, H)
      .setScrollFactor(0).setDepth(72).setAlpha(0.35);

    // 20개 랜덤 물방울 초기화
    for (let i = 0; i < 20; i++) {
      this.drops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vy: 0.3 + Math.random() * 0.5,
        alpha: 0.4 + Math.random() * 0.4,
      });
    }

    scene.events.on('update', this.update, this);
  }

  private update(): void {
    this.canvas.clear();

    // white semi-circle (droplet shape)
    for (const d of this.drops) {
      d.y += d.vy;
      if (d.y > this.canvas.height + 10) {
        d.y = -10;
        d.x = Math.random() * this.canvas.width;
      }

      const gfx = this.canvas.scene.make.graphics({ add: false });
      gfx.fillStyle(0xaaccee, d.alpha);
      gfx.fillEllipse(d.x, d.y, 4, 6);
      this.canvas.draw(gfx, 0, 0);
      gfx.destroy();
    }
  }
}
```

---

## 2. 눈 (Snow)

```typescript
class SnowSystem {
  private flakes: Phaser.GameObjects.Particles.ParticleEmitter;
  private accumGfx: Phaser.GameObjects.Graphics;  // 지면 적설

  create(scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    // 눈송이: 느리고 흔들리며 떨어짐
    this.flakes = scene.add.particles(0, 0, '__DEFAULT', {
      x: { min: -20, max: W + 20 },
      y: { min: -10, max: 0 },
      speedX: { min: -15, max: 15 },
      speedY: { min: 40, max: 90 },
      scale: { start: 0.3, end: 0.1 },
      alpha: { start: 0.85, end: 0.4 },
      lifespan: { min: 3000, max: 5000 },
      frequency: 15,
      quantity: 1,
      tint: 0xddeeff,
      accelerationX: { min: -10, max: 10 },   // 바람 흔들림
      rotate: { min: 0, max: 360 },
      blendMode: Phaser.BlendModes.NORMAL,
    }).setScrollFactor(0).setDepth(70);

    // 지면 쌓임 (흰 줄) — 점진적으로 두꺼워짐
    this.accumGfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(71).setAlpha(0);

    this.growAccumulation(scene, W, H);
  }

  private accumThickness = 0;

  private growAccumulation(scene: Phaser.Scene, W: number, H: number): void {
    scene.tweens.add({
      targets: { t: 0 },
      t: 1,
      duration: 60000,   // 1분에 걸쳐 최대 적설
      onUpdate: (tween) => {
        this.accumThickness = tween.getValue() * 8;   // 최대 8px
        this.accumGfx.clear();
        if (this.accumThickness > 0.5) {
          this.accumGfx.setAlpha(0.7);
          this.accumGfx.fillStyle(0xeef4ff, 1);
          // 화면 하단 불규칙 지면 선
          this.accumGfx.fillRect(0, H - Math.round(this.accumThickness), W, Math.round(this.accumThickness));
        }
      },
    });
  }

  stop(): void {
    this.flakes.destroy();
    this.accumGfx.destroy();
  }
}
```

---

## 3. 바람 (Wind Lines)

```typescript
class WindLineSystem {
  private lines: Array<{
    x: number; y: number; len: number; vy: number; alpha: number; life: number;
  }> = [];
  private gfx: Phaser.GameObjects.Graphics;
  private strength = 0;  // 0~1

  create(scene: Phaser.Scene): void {
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(69);
    scene.events.on('update', (_t: number, delta: number) => this.update(delta, scene));
  }

  setStrength(s: number): void { this.strength = Math.max(0, Math.min(1, s)); }

  private update(delta: number, scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    // 강도에 따라 새 선 생성
    if (Math.random() < this.strength * 0.15) {
      this.lines.push({
        x: -40,
        y: Math.random() * H,
        len: 20 + Math.random() * 60 * this.strength,
        vy: (Math.random() - 0.5) * 0.5,
        alpha: 0.15 + Math.random() * 0.25 * this.strength,
        life: 1.0,
      });
    }

    this.gfx.clear();
    const speed = 400 + this.strength * 300;

    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.x += (speed * delta) / 1000;
      l.y += l.vy;
      l.life -= delta / 600;

      if (l.x > W + 60 || l.life <= 0) {
        this.lines.splice(i, 1);
        continue;
      }

      const alpha = l.alpha * Math.min(1, l.life * 3);
      this.gfx.lineStyle(1, 0xccddee, alpha);
      this.gfx.beginPath();
      this.gfx.moveTo(l.x, l.y);
      this.gfx.lineTo(l.x - l.len, l.y);
      this.gfx.strokePath();
    }
  }
}
```

---

## 4. 번개 (Lightning Flash)

```typescript
class LightningSystem {
  private overlay: Phaser.GameObjects.Rectangle;
  private boltGfx: Phaser.GameObjects.Graphics;

  create(scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    this.overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0xeeeeff, 0)
      .setScrollFactor(0).setDepth(75);

    this.boltGfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(74);
  }

  triggerStrike(scene: Phaser.Scene): void {
    // 1. 화면 플래시 (두 번 깜빡)
    scene.tweens.add({
      targets: this.overlay,
      alpha: 0.55,
      duration: 40,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        scene.time.delayedCall(80, () => {
          scene.tweens.add({
            targets: this.overlay,
            alpha: 0.3,
            duration: 30,
            yoyo: true,
          });
        });
      },
    });

    // 2. 번개 볼트 지그재그
    this.drawBolt(scene);

    // 3. 천둥 카메라 진동
    scene.time.delayedCall(120, () => {
      scene.cameras.main.shake(300, 0.008);
    });
  }

  private drawBolt(scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;

    const startX = W * 0.2 + Math.random() * W * 0.6;
    const startY = 0;
    const endY = scene.cameras.main.height * (0.4 + Math.random() * 0.4);

    this.boltGfx.clear();
    this.boltGfx.lineStyle(2, 0xeeeeff, 0.9);

    // 지그재그 세그먼트
    const segments = 8;
    const points: { x: number; y: number }[] = [{ x: startX, y: startY }];

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = startX + (Math.random() - 0.5) * 50 * (1 - t);
      const y = startY + (endY - startY) * t;
      points.push({ x, y });
    }

    this.boltGfx.strokePoints(points, false);

    // 가지
    const branchIdx = Math.floor(segments * 0.4);
    const bp = points[branchIdx];
    this.boltGfx.lineStyle(1, 0xccccff, 0.5);
    this.boltGfx.beginPath();
    this.boltGfx.moveTo(bp.x, bp.y);
    this.boltGfx.lineTo(bp.x + (Math.random() - 0.5) * 60, bp.y + 80);
    this.boltGfx.strokePath();

    // 0.18초 후 사라짐
    scene.time.delayedCall(180, () => this.boltGfx.clear());
  }
}
```

---

## 5. 안개 (Fog)

```typescript
class FogWeatherSystem {
  private fogLayers: Phaser.GameObjects.RenderTexture[] = [];

  create(scene: Phaser.Scene, density: 'light' | 'thick'): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;
    const alpha = density === 'thick' ? 0.45 : 0.22;

    // 2개 레이어 — 서로 다른 속도로 이동
    for (let i = 0; i < 2; i++) {
      const rt = scene.add.renderTexture(0, 0, W, H)
        .setScrollFactor(0)
        .setDepth(68 + i)
        .setAlpha(0);

      // 랜덤 타원 구름 덩어리로 안개 채우기
      const gfx = scene.make.graphics({ add: false });
      gfx.fillStyle(0xc0ccd8, 1);
      for (let j = 0; j < 12; j++) {
        gfx.fillEllipse(
          Math.random() * W, Math.random() * H,
          80 + Math.random() * 160,
          40 + Math.random() * 80
        );
      }
      rt.draw(gfx, 0, 0);
      gfx.destroy();

      // 페이드인
      scene.tweens.add({ targets: rt, alpha, duration: 4000 });
      this.fogLayers.push(rt);

      // 천천히 이동 (각 레이어 다른 속도)
      const speed = (i + 1) * 0.12;
      scene.events.on('update', (_t: number, delta: number) => {
        rt.x -= speed * (delta / 16.67);
        if (rt.x < -W) rt.x = 0;
      });
    }
  }

  stop(scene: Phaser.Scene): void {
    scene.tweens.add({
      targets: this.fogLayers,
      alpha: 0,
      duration: 3000,
      onComplete: () => this.fogLayers.forEach(l => l.destroy()),
    });
  }
}
```

---

## 6. 모래폭풍 (Sandstorm)

```typescript
class SandstormSystem {
  private particles: Phaser.GameObjects.Particles.ParticleEmitter;
  private overlay: Phaser.GameObjects.Rectangle;
  private dustGfx: Phaser.GameObjects.Graphics;

  create(scene: Phaser.Scene): void {
    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    // 황토색 반투명 오버레이
    this.overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0xc8a050, 0)
      .setScrollFactor(0).setDepth(72);
    scene.tweens.add({ targets: this.overlay, alpha: 0.22, duration: 3000 });

    // 빠른 먼지 파티클 (수평 이동)
    this.particles = scene.add.particles(0, 0, '__DEFAULT', {
      x: { min: -20, max: 0 },
      y: { min: 0, max: H },
      speedX: { min: 350, max: 550 },
      speedY: { min: -30, max: 30 },
      scale: { start: 0.35, end: 0.05 },
      alpha: { start: 0.5, end: 0 },
      lifespan: { min: 600, max: 1000 },
      frequency: 5,
      quantity: 3,
      tint: [0xd4a060, 0xc89040, 0xe0b870],
      blendMode: Phaser.BlendModes.NORMAL,
    }).setScrollFactor(0).setDepth(73);

    // 굵은 먼지 덩어리
    this.dustGfx = scene.add.graphics().setScrollFactor(0).setDepth(71);
    this.animateDustClouds(scene, W, H);
  }

  private animateDustClouds(scene: Phaser.Scene, W: number, H: number): void {
    for (let i = 0; i < 4; i++) {
      const cloud = { x: -120, y: H * (0.2 + i * 0.2), w: 80 + i * 30, h: 30 + i * 10 };
      scene.tweens.add({
        targets: cloud,
        x: W + 120,
        duration: 3000 + i * 500,
        repeat: -1,
        delay: i * 800,
        onUpdate: () => {
          // repaint handled in main update
        },
      });
    }
  }

  stop(scene: Phaser.Scene): void {
    scene.tweens.add({
      targets: [this.overlay, this.particles],
      alpha: 0,
      duration: 3000,
      onComplete: () => {
        this.particles.destroy();
        this.overlay.destroy();
        this.dustGfx.destroy();
      },
    });
  }
}
```

---

## 7. 날씨 전환 매니저

```typescript
class WeatherVisualManager {
  private current: WeatherVisual | null = null;

  // 현재 날씨 → 새 날씨로 크로스페이드
  transition(
    scene: Phaser.Scene,
    toWeather: WeatherType
  ): void {
    // 1. 기존 날씨 페이드아웃
    if (this.current) {
      this.current.stop(scene);
    }

    // 2. 새 날씨 생성
    scene.time.delayedCall(1500, () => {
      switch (toWeather) {
        case 'rain':         this.current = new RainSystem(); break;
        case 'heavy_rain':   this.current = new RainSystem(); break;
        case 'snow':         this.current = new SnowSystem(); break;
        case 'fog':          this.current = new FogWeatherSystem(); break;
        case 'sandstorm':    this.current = new SandstormSystem(); break;
        case 'thunderstorm': this.current = this.setupThunder(scene); break;
        default:             this.current = null;
      }
      this.current?.create(scene);
    });
  }

  private setupThunder(scene: Phaser.Scene): WeatherVisual {
    const rain = new RainSystem();
    const lightning = new LightningSystem();

    // 5~15초 랜덤 간격으로 번개
    const scheduleNext = (): void => {
      const delay = 5000 + Math.random() * 10000;
      scene.time.delayedCall(delay, () => {
        lightning.triggerStrike(scene);
        scheduleNext();
      });
    };

    return {
      create: (s) => { rain.create(s); rain.setIntensity('heavy'); lightning.create(s); scheduleNext(); },
      stop:   (s) => { rain.stop(s); },
    };
  }
}

interface WeatherVisual {
  create(scene: Phaser.Scene): void;
  stop(scene: Phaser.Scene): void;
}
```

---

## 8. 플레이어 날씨 반응 비주얼

```typescript
// 비 맞을 때 캐릭터 위 빗방울 (작은 파티클)
function attachRainDripsToPlayer(
  scene: Phaser.Scene,
  player: PlayerEntity
): void {
  const emitter = scene.add.particles(0, 0, '__DEFAULT', {
    follow: player.sprite,
    offsetY: -10,
    speedX: { min: 10, max: 30 },
    speedY: { min: 20, max: 50 },
    scale: { start: 0.1, end: 0.04 },
    alpha: { start: 0.6, end: 0 },
    lifespan: 200,
    frequency: 60,
    quantity: 1,
    tint: 0x88aacc,
  }).setDepth(player.sprite.depth + 2);

  (player as any).__rainDrips = emitter;
}

// 눈 맞을 때 — 캐릭터에 흰색 점 누적 (tint 살짝 파랗게)
function applySnowCoverEffect(player: PlayerEntity): void {
  player.sprite.setTint(0xddeeff);
}
```

---

## 9. 깊이(Depth) 테이블

| 요소 | Depth | 비고 |
|------|-------|------|
| 바람선 Graphics | 69 | 구름(66) 아래, 캐릭터 위 |
| 안개 레이어 1~2 | 68~69 | scrollFactor 0 |
| 눈송이 / 빗방울 파티클 | 70 | scrollFactor 0 |
| 지면 적설 | 71 | scrollFactor 0 |
| 번개 볼트 | 74 | |
| 화면 번개 플래시 | 75 | |
| 모래폭풍 오버레이 | 72 | |
| 창문 빗방울 오버레이 | 72 | 실내 전용 |

---

## 10. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/fx/weather/RainSystem.ts` | 빗방울 + 튀김 + 창문 물방울 |
| `src/fx/weather/SnowSystem.ts` | 눈송이 + 적설 |
| `src/fx/weather/WindLineSystem.ts` | 바람선 |
| `src/fx/weather/LightningSystem.ts` | 번개 플래시 + 볼트 |
| `src/fx/weather/FogWeatherSystem.ts` | 안개 레이어 |
| `src/fx/weather/SandstormSystem.ts` | 모래폭풍 |
| `src/fx/weather/WeatherVisualManager.ts` | 날씨 전환 컨트롤러 |

---

## 11. 버전

`v0.70.0`
