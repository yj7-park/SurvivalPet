# Plan 80 — 환경 파티클·분위기 비주얼

## 목표
맵 생물군계별 주변 파티클(반딧불, 낙엽, 먼지, 물방울, 불꽃 등),
시간대별 빛 효과, 계절감 연출 등 게임 세계에 생동감을 더한다.

## 버전
`v0.80.0`

## 대상 파일
- `src/rendering/AmbientParticleSystem.ts` (신규)
- `src/rendering/BiomeAmbience.ts` (신규)
- `src/rendering/TimeOfDayRenderer.ts` (보완)

---

## 1. 환경 파티클 타입 및 설정

```typescript
// src/rendering/AmbientParticleSystem.ts

export type AmbientType =
  | 'firefly'       // 반딧불 (숲, 밤)
  | 'leaf_fall'     // 낙엽 (가을 숲)
  | 'dust_mote'     // 먼지 부유 (동굴, 실내)
  | 'water_drip'    // 물방울 (동굴, 비)
  | 'ember'         // 불씨 (화롯불 근처, 화산)
  | 'petal'         // 꽃잎 (봄 초원)
  | 'snow_drift'    // 눈 날림 (겨울 필드)
  | 'mist_wisp'     // 안개 조각 (습지, 새벽)
  | 'bubble'        // 물방울 (수중, 강가)
  | 'spore';        // 포자 (버섯 숲)

const AMBIENT_CONFIG: Record<AmbientType, {
  count: number;
  color: number;
  size: [number, number];  // [min, max]
  speed: [number, number]; // [min, max] px/s
  life:  [number, number]; // [min, max] ms
  alpha: [number, number]; // [min, max]
}> = {
  firefly:    { count: 18, color: 0xaaffaa, size: [2, 3],  speed: [8, 18],  life: [3000, 6000], alpha: [0.5, 1.0] },
  leaf_fall:  { count: 20, color: 0xcc8833, size: [3, 6],  speed: [20, 40], life: [4000, 7000], alpha: [0.6, 0.9] },
  dust_mote:  { count: 30, color: 0xddccaa, size: [1, 2],  speed: [3,  10], life: [5000, 9000], alpha: [0.2, 0.5] },
  water_drip: { count: 12, color: 0x88aaff, size: [2, 3],  speed: [60, 90], life: [800,  1200], alpha: [0.5, 0.8] },
  ember:      { count: 15, color: 0xff6622, size: [2, 4],  speed: [15, 35], life: [1500, 3000], alpha: [0.6, 1.0] },
  petal:      { count: 16, color: 0xffaacc, size: [3, 5],  speed: [12, 25], life: [4000, 7000], alpha: [0.5, 0.9] },
  snow_drift: { count: 25, color: 0xeeeeff, size: [2, 4],  speed: [10, 30], life: [5000, 8000], alpha: [0.4, 0.8] },
  mist_wisp:  { count: 10, color: 0xaabbcc, size: [8, 16], speed: [4,  10], life: [6000,10000], alpha: [0.1, 0.3] },
  bubble:     { count: 14, color: 0x88ccff, size: [2, 5],  speed: [10, 20], life: [2000, 4000], alpha: [0.3, 0.6] },
  spore:      { count: 20, color: 0xaaffdd, size: [1, 3],  speed: [5,  15], life: [4000, 7000], alpha: [0.3, 0.7] },
};
```

---

## 2. AmbientParticleSystem 클래스

```typescript
interface AmbientParticle {
  x: number; y: number;
  vx: number; vy: number;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
  color: number;
  angle: number;     // 낙엽·꽃잎 회전
  spin: number;      // 회전 속도
  phase: number;     // 반딧불 빛 위상
}

export class AmbientParticleSystem {
  private scene: Phaser.Scene;
  private particles: AmbientParticle[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  private type: AmbientType;
  private cfg: typeof AMBIENT_CONFIG[AmbientType];
  private spawnArea: { x: number; y: number; w: number; h: number };
  private active = true;

  constructor(
    scene: Phaser.Scene,
    type: AmbientType,
    spawnArea: { x: number; y: number; w: number; h: number },
  ) {
    this.scene = scene;
    this.type = type;
    this.cfg = AMBIENT_CONFIG[type];
    this.spawnArea = spawnArea;

    this.gfx = scene.add.graphics().setDepth(30);

    // 초기 파티클 스폰 (화면 전체에 분산)
    for (let i = 0; i < this.cfg.count; i++) {
      this.particles.push(this._spawn(true));
    }
  }

  private _spawn(initialScatter = false): AmbientParticle {
    const cfg = this.cfg;
    const sa  = this.spawnArea;

    const life = Phaser.Math.Between(cfg.life[0], cfg.life[1]);
    return {
      x: sa.x + Math.random() * sa.w,
      y: initialScatter
        ? sa.y + Math.random() * sa.h
        : (this.type === 'water_drip' || this.type === 'leaf_fall'
           ? sa.y
           : sa.y + sa.h),  // 위 또는 아래에서 시작
      vx: (Math.random() - 0.5) * cfg.speed[1] * 0.3,
      vy: this._baseVY(),
      alpha: Phaser.Math.FloatBetween(cfg.alpha[0], cfg.alpha[1]),
      size:  Phaser.Math.Between(cfg.size[0], cfg.size[1]),
      life,
      maxLife: life,
      color: cfg.color,
      angle: Math.random() * Math.PI * 2,
      spin:  (Math.random() - 0.5) * 0.06,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private _baseVY(): number {
    const cfg = this.cfg;
    const spd = Phaser.Math.FloatBetween(cfg.speed[0], cfg.speed[1]) / 1000;
    switch (this.type) {
      case 'ember':      return -spd;          // 위로
      case 'bubble':     return -spd;
      case 'firefly':    return (Math.random() - 0.5) * spd;
      case 'mist_wisp':  return (Math.random() - 0.5) * spd * 0.5;
      default:           return spd;           // 아래로
    }
  }

  update(delta: number, camX: number, camY: number): void {
    if (!this.active) return;

    this.gfx.clear();

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.particles[i] = this._spawn();
        continue;
      }

      const progress = 1 - p.life / p.maxLife;

      // 타입별 이동 패턴
      switch (this.type) {
        case 'firefly':
          // 사인 곡선 부유
          p.x += p.vx * delta * 0.001 + Math.sin(p.phase + progress * Math.PI * 4) * 0.3;
          p.y += p.vy * delta * 0.001 + Math.cos(p.phase + progress * Math.PI * 3) * 0.2;
          break;
        case 'leaf_fall':
        case 'petal':
          // 좌우 흔들리며 낙하
          p.x += p.vx * delta * 0.001 + Math.sin(p.phase + progress * Math.PI * 6) * 0.6;
          p.y += p.vy * delta * 0.001;
          p.angle += p.spin;
          break;
        case 'ember':
          // 위로 올라가며 좌우 흔들
          p.x += p.vx * delta * 0.001 + (Math.random() - 0.5) * 0.4;
          p.y += p.vy * delta * 0.001;
          break;
        default:
          p.x += p.vx * delta * 0.001;
          p.y += p.vy * delta * 0.001;
      }

      // 페이드 인/아웃
      const lifeRatio = p.life / p.maxLife;
      const fadeIn  = Math.min(1, (1 - lifeRatio) * 8);
      const fadeOut = Math.min(1, lifeRatio * 5);
      const alpha   = p.alpha * Math.min(fadeIn, fadeOut);

      // 반딧불: 깜빡임 맥동
      const finalAlpha = this.type === 'firefly'
        ? alpha * (0.5 + 0.5 * Math.sin(p.phase + progress * Math.PI * 8))
        : alpha;

      // 스크린 좌표로 변환
      const sx = p.x - camX;
      const sy = p.y - camY;

      // 드로우
      this.gfx.fillStyle(p.color, finalAlpha);
      switch (this.type) {
        case 'leaf_fall':
        case 'petal': {
          // 작은 타원 (회전)
          const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
          const hw = p.size * 1.5, hh = p.size * 0.8;
          // 간단 타원 근사: 회전 변환된 점들
          this.gfx.fillEllipse(sx, sy, hw * 2, hh * 2);
          break;
        }
        case 'mist_wisp':
          this.gfx.fillStyle(p.color, finalAlpha * 0.5);
          this.gfx.fillCircle(sx, sy, p.size);
          break;
        case 'water_drip':
          // 세로로 긴 물방울
          this.gfx.fillRect(sx - 1, sy - p.size, 2, p.size * 2);
          break;
        default:
          this.gfx.fillCircle(sx, sy, p.size);
      }
    }
  }

  pause(): void  { this.active = false; }
  resume(): void { this.active = true; }

  destroy(): void {
    this.gfx.destroy();
    this.particles.length = 0;
  }
}
```

---

## 3. 생물군계별 환경 파티클 관리자

```typescript
// src/rendering/BiomeAmbience.ts

export type BiomeType =
  | 'forest' | 'desert' | 'cave' | 'swamp'
  | 'mountain' | 'beach' | 'mushroom_forest' | 'ruins';

const BIOME_AMBIENTS: Record<BiomeType, AmbientType[]> = {
  forest:          ['leaf_fall', 'firefly'],
  desert:          ['dust_mote'],
  cave:            ['dust_mote', 'water_drip'],
  swamp:           ['mist_wisp', 'bubble'],
  mountain:        ['snow_drift', 'dust_mote'],
  beach:           ['petal', 'bubble'],
  mushroom_forest: ['spore', 'mist_wisp'],
  ruins:           ['dust_mote', 'leaf_fall'],
};

export class BiomeAmbience {
  private scene: Phaser.Scene;
  private systems: AmbientParticleSystem[] = [];
  private currentBiome: BiomeType | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** 생물군계 전환 (크로스페이드) */
  setBiome(biome: BiomeType, camW: number, camH: number): void {
    if (this.currentBiome === biome) return;
    this.currentBiome = biome;

    // 기존 시스템 페이드 아웃 후 제거
    const oldSystems = [...this.systems];
    this.systems = [];

    this.scene.time.delayedCall(600, () => {
      oldSystems.forEach(s => s.destroy());
    });
    oldSystems.forEach(s => s.pause());

    // 새 시스템 생성
    const types = BIOME_AMBIENTS[biome] ?? [];
    const area = {
      x: this.scene.cameras.main.scrollX - 64,
      y: this.scene.cameras.main.scrollY - 64,
      w: camW + 128,
      h: camH + 128,
    };

    for (const type of types) {
      this.systems.push(new AmbientParticleSystem(this.scene, type, area));
    }
  }

  update(delta: number): void {
    const cam = this.scene.cameras.main;
    for (const sys of this.systems) {
      sys.update(delta, cam.scrollX, cam.scrollY);
    }
  }

  destroy(): void {
    this.systems.forEach(s => s.destroy());
    this.systems.length = 0;
  }
}
```

---

## 4. 시간대별 태양빛 샤프트

```typescript
// src/rendering/TimeOfDayRenderer.ts (추가)

export function drawSunbeam(
  scene: Phaser.Scene,
  camX: number,
  camY: number,
  camW: number,
  camH: number,
  timeOfDay: number,  // 0~24 (시간)
): Phaser.GameObjects.Graphics | null {
  // 오전 8~10시, 오후 15~17시만 햇살 표시
  const isGoldenHour =
    (timeOfDay >= 7 && timeOfDay <= 10) ||
    (timeOfDay >= 15 && timeOfDay <= 18);
  if (!isGoldenHour) return null;

  const morning  = timeOfDay <= 10;
  const angle    = morning ? -0.3 : 0.3;  // 광선 기울기
  const alpha    = morning
    ? Math.min(0.07, (timeOfDay - 7) / 3 * 0.07)
    : Math.min(0.07, (18 - timeOfDay) / 3 * 0.07);

  const gfx = scene.add.graphics().setDepth(29).setScrollFactor(0);

  // 3개의 넓은 광선
  for (let i = 0; i < 3; i++) {
    const startX = camW * (0.1 + i * 0.35);
    const width  = 60 + i * 30;
    const color  = morning ? 0xffeeaa : 0xffaa66;

    gfx.fillStyle(color, alpha - i * 0.015);
    gfx.fillPoints([
      { x: startX - width / 2 + angle * camH, y: 0 },
      { x: startX + width / 2 + angle * camH, y: 0 },
      { x: startX + width / 2 + angle * camH + Math.sin(angle) * camH, y: camH },
      { x: startX - width / 2 + angle * camH + Math.sin(angle) * camH, y: camH },
    ], true);
  }

  return gfx;
}

/** 저녁노을 수평선 그라데이션 오버레이 */
export function drawSunsetGlow(
  scene: Phaser.Scene,
  camW: number,
  camH: number,
  timeOfDay: number,
): void {
  const isSunset = timeOfDay >= 17 && timeOfDay <= 20;
  if (!isSunset) return;

  const t = (timeOfDay - 17) / 3;  // 0→1
  const alpha = Math.sin(t * Math.PI) * 0.12;

  // 하단 글로우
  const gfx = scene.add.graphics().setDepth(28).setScrollFactor(0);
  gfx.fillGradientStyle(0xff6622, 0xff6622, 0x000000, 0x000000, alpha, alpha, 0, 0);
  gfx.fillRect(0, camH * 0.5, camW, camH * 0.5);

  scene.time.delayedCall(50, () => gfx.destroy());
}
```

---

## 5. 실내 광원 공기 먼지

```typescript
// src/rendering/AmbientParticleSystem.ts (추가)

/** 화롯불·모닥불 주변 불씨 파티클 (월드 좌표 고정) */
export function attachEmberEffect(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
): { system: AmbientParticleSystem; stop: () => void } {
  const system = new AmbientParticleSystem(scene, 'ember', {
    x: worldX - 20,
    y: worldY - 10,
    w: 40,
    h: 10,
  });

  let active = true;
  const updateFn = (time: number, delta: number) => {
    if (!active) return;
    const cam = scene.cameras.main;
    system.update(delta, cam.scrollX, cam.scrollY);
  };
  scene.events.on('update', updateFn);

  return {
    system,
    stop: () => {
      active = false;
      scene.events.off('update', updateFn);
      system.destroy();
    },
  };
}
```

---

## 6. 깊이(Depth) 테이블

| 레이어              | depth |
|---------------------|-------|
| 저녁노을 글로우      | 28    |
| 햇살 샤프트          | 29    |
| 환경 파티클          | 30    |
| 반딧불·불씨          | 30    |

---

## 7. 사용 예시

```typescript
// GameScene.ts 초기화
const biomeAmbience = new BiomeAmbience(this);
biomeAmbience.setBiome('forest', 800, 600);

// 매 프레임
biomeAmbience.update(delta);
drawSunsetGlow(this, 800, 600, this.gameTime.hour);

// 모닥불 설치 시
const { stop } = attachEmberEffect(this, campfire.x, campfire.y);
// 모닥불 소화 시
stop();

// 맵 전환 시 생물군계 교체
biomeAmbience.setBiome('cave', 800, 600);
```
