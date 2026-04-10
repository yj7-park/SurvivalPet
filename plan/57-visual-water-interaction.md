# Plan 57 — 수중·물가 인터랙션 비주얼 (Visual Water Interaction)

## 개요

plan 41(물 타일 4프레임 애니), plan 42(낚시 던지기·찌 애니)에서 다루지 않은  
물속 이동 시 캐릭터 하반신 마스킹, 물 진입/탈출 파티클,  
수면 반사·출렁임, 깊이별 색조 변화, 물가(해변) 거품 애니를 설계한다.

---

## 1. 물 진입·탈출 파티클 (`WaterSplashEffect`)

### 1-1. 진입 (입수) 스플래시

```typescript
function playWaterEntry(scene: Phaser.Scene, x: number, y: number): void {
  // A. 수면 파문 링 2개 (plan 45 rain ripple 재사용 + 크기 확대)
  [0, 120].forEach(delay => {
    scene.time.delayedCall(delay, () => {
      const gfx = scene.add.graphics().setDepth(12);
      scene.tweens.add({
        targets: { r: 0, a: 0.6 }, r: 28, a: 0,
        duration: 500, ease: 'Quad.easeOut',
        onUpdate: (tw, obj) => {
          gfx.clear();
          gfx.lineStyle(1.5, 0x80ccff, obj.a);
          gfx.strokeEllipse(x, y, obj.r * 2, obj.r * 0.6);
        },
        onComplete: () => gfx.destroy()
      });
    });
  });

  // B. 물방울 버스트 8개 (위로 솟구침)
  const emitter = scene.add.particles(x, y, 'fx_pixel', {
    tint:    [0x60b8f0, 0x90d0ff, 0xaaddff],
    speed:   { min: 40, max: 100 },
    angle:   { min: -140, max: -40 },
    gravityY: 180,
    scale:   { start: 1.2, end: 0 },
    alpha:   { start: 0.9, end: 0 },
    lifespan: { min: 300, max: 600 },
    quantity: 8, emitting: false,
    depth:   13
  });
  emitter.explode(8);
  scene.time.delayedCall(700, () => emitter.destroy());
}
```

### 1-2. 탈출 (출수) 물방울

```typescript
function playWaterExit(scene: Phaser.Scene, x: number, y: number): void {
  // 물방울이 캐릭터 몸에서 떨어지는 효과 (아래로 흘러내림)
  for (let i = 0; i < 5; i++) {
    const dx = Phaser.Math.Between(-10, 10);
    const drop = scene.add.graphics()
      .fillStyle(0x60b8f0, 0.7)
      .fillRect(0, 0, 2, 4)
      .setPosition(x + dx, y - 12)
      .setDepth(35);

    scene.tweens.add({
      targets: drop,
      y: drop.y + 20,
      alpha: 0,
      duration: 400 + i * 60,
      delay: i * 50,
      ease: 'Quad.easeIn',
      onComplete: () => drop.destroy()
    });
  }

  // 발밑 작은 파문
  playWaterEntry(scene, x, y + 4);   // 입수 파문 재사용 (작은 크기)
}
```

### 1-3. 이동 중 물 파문 (주기적 발걸음 파문)

```typescript
class WaterWalkRipples {
  private stepTimer = 0;
  private readonly STEP_INTERVAL = 350;   // ms

  update(playerX: number, playerY: number, isInWater: boolean, delta: number): void {
    if (!isInWater) { this.stepTimer = 0; return; }

    this.stepTimer += delta;
    if (this.stepTimer >= this.STEP_INTERVAL) {
      this.stepTimer = 0;
      this.spawnStepRipple(playerX, playerY);
    }
  }

  private spawnStepRipple(x: number, y: number): void {
    const gfx = scene.add.graphics().setDepth(12);
    scene.tweens.add({
      targets: { r: 2, a: 0.5 }, r: 14, a: 0,
      duration: 350, ease: 'Quad.easeOut',
      onUpdate: (tw, obj) => {
        gfx.clear();
        gfx.lineStyle(1, 0x80ccff, obj.a);
        gfx.strokeEllipse(x, y, obj.r * 2, obj.r * 0.5);
      },
      onComplete: () => gfx.destroy()
    });
  }
}
```

---

## 2. 캐릭터 물속 마스킹 (`WaterCharacterMask`)

물속에 있을 때 캐릭터 하반신이 잠긴 것처럼 보이게 처리.

### 2-1. 마스크 방식

Phaser BitmapMask 대신 **두 레이어 분리** 방식:
- 상반신 스프라이트(depth 30): 수면 위
- 하반신 스프라이트(depth 10): 물 타일 아래 → 물 레이어(depth 11)에 가려짐

```typescript
class WaterCharacterMask {
  private upperBody: Phaser.GameObjects.Sprite;  // 상반신만 자른 스프라이트
  private lowerBody: Phaser.GameObjects.Sprite;  // 하반신만 자른 스프라이트

  enterWater(charSprite: Phaser.GameObjects.Sprite): void {
    charSprite.setVisible(false);   // 원본 숨김

    // 스프라이트 절반 높이 기준으로 crop
    const half = charSprite.height / 2;
    this.upperBody = scene.add.sprite(charSprite.x, charSprite.y, charSprite.texture.key)
      .setCrop(0, 0, charSprite.width, half)
      .setDepth(35);   // 수면 위

    this.lowerBody = scene.add.sprite(charSprite.x, charSprite.y, charSprite.texture.key)
      .setCrop(0, half, charSprite.width, half)
      .setAlpha(0.55)   // 반투명 (수면 아래 굴절)
      .setTint(0x80c0f0) // 파란 틴트
      .setDepth(8);    // 물 타일보다 아래

    // 발목 아래 물결 마스크 흔들림 (x offset sine wave)
    scene.tweens.add({
      targets: this.lowerBody,
      x: charSprite.x + 2,
      duration: 600, ease: 'Sine.easeInOut',
      yoyo: true, repeat: -1
    });
  }

  update(x: number, y: number): void {
    this.upperBody?.setPosition(x, y);
    this.lowerBody?.setPosition(x + /* sine offset */ 0, y);
  }

  exitWater(charSprite: Phaser.GameObjects.Sprite): void {
    charSprite.setVisible(true);
    this.upperBody?.destroy(); this.upperBody = null;
    this.lowerBody?.destroy(); this.lowerBody = null;
  }
}
```

### 2-2. 수심별 침잠 깊이

| 수심 (타일 접촉) | 잠기는 비율 | 이동 속도 페널티 |
|----------------|------------|----------------|
| 얕은 물 (1타일) | 25% (발목) | -15% |
| 보통 물 (이동 중) | 45% (무릎) | -30% |
| 깊은 물 (계획 외) | 70% (허리) | -50% |

---

## 3. 수면 반사 오버레이 (`WaterReflectionLayer`)

### 3-1. 하늘 색 반영 반사 줄무늬

plan 44 `getSkyTint()`의 하늘 색을 수면에 반사시킨다.

```typescript
class WaterReflectionLayer {
  private rt: Phaser.GameObjects.RenderTexture;
  private scrollOffset = 0;

  update(delta: number, skyColor: number): void {
    this.scrollOffset = (this.scrollOffset + delta * 0.02) % 8;
    this.rt.clear();

    const gfx = scene.make.graphics({ add: false });
    const cam = scene.cameras.main;
    const W = cam.width, H = cam.height;

    // 수평 줄무늬 (4px 간격, 스크롤)
    // 줄무늬 색: 하늘색 + 약간 밝게
    const r = ((skyColor >> 16) & 0xff);
    const g = ((skyColor >> 8)  & 0xff);
    const b =  (skyColor        & 0xff);
    const lightColor = ((Math.min(255, r+30) << 16) | (Math.min(255, g+30) << 8) | Math.min(255, b+30));

    gfx.lineStyle(1, lightColor, 0.12);
    for (let y = this.scrollOffset; y < H; y += 8) {
      gfx.lineBetween(0, y, W, y);
    }
    this.rt.draw(gfx, 0, 0);
    gfx.destroy();
  }
}
```

### 3-2. 오브젝트 반사 (근사 처리)

물 위에 인접한 나무·건물 → 뒤집힌 반투명 이미지 (세로 뒤집기, alpha 0.2):

```typescript
function drawWaterReflection(
  objectSprite: Phaser.GameObjects.Image,
  waterY: number   // 수면 Y 픽셀
): void {
  const reflY = waterY + (waterY - objectSprite.y);  // 반사 위치

  const refl = scene.add.image(objectSprite.x, reflY, objectSprite.texture.key)
    .setFlipY(true)
    .setAlpha(0.18)
    .setTint(0x80c0ff)
    .setDepth(11)   // 수면과 같은 레이어
    .setScrollFactor(objectSprite.scrollFactorX, objectSprite.scrollFactorY);

  // 수평 흔들림 tween (±3px, 2s)
  scene.tweens.add({
    targets: refl,
    x: refl.x + 3,
    duration: 2000, ease: 'Sine.easeInOut',
    yoyo: true, repeat: -1
  });

  // 오브젝트가 제거되면 반사도 제거
  objectSprite.on(Phaser.GameObjects.Events.DESTROY, () => refl.destroy());
}
```

---

## 4. 물가(해변) 거품 애니메이션 (`ShorelineFoam`)

물 타일과 모래 타일의 경계에 거품 줄무늬 애니메이션.

```typescript
class Shorelinefoam {
  private foamSprites: Phaser.GameObjects.Graphics[] = [];

  // 물-모래 경계 타일 목록을 전달받아 거품 생성
  init(shoreTiles: { wx: number; wy: number; dir: Direction }[]): void {
    shoreTiles.forEach(({ wx, wy, dir }) => {
      this.createFoamSegment(wx, wy, dir);
    });
  }

  private createFoamSegment(wx: number, wy: number, dir: Direction): void {
    const gfx = scene.add.graphics().setDepth(11);
    let phase = Math.random() * Math.PI * 2;

    scene.time.addEvent({
      delay: 50, loop: true,
      callback: () => {
        phase += 0.08;
        const alpha = (Math.sin(phase) * 0.5 + 0.5) * 0.45 + 0.1;
        gfx.clear();
        gfx.fillStyle(0xffffff, alpha);

        // dir에 따라 거품 줄무늬 위치 결정
        switch (dir) {
          case 'south': gfx.fillRect(wx,     wy + 28, 32, 3); break;
          case 'north': gfx.fillRect(wx,     wy + 1,  32, 3); break;
          case 'east':  gfx.fillRect(wx + 28, wy,     3, 32); break;
          case 'west':  gfx.fillRect(wx + 1,  wy,     3, 32); break;
        }
      }
    });
    this.foamSprites.push(gfx);
  }
}
```

---

## 5. 낚시 비주얼 강화 (plan 42 보완)

### 5-1. 낚싯줄 처짐 (베지에 곡선)

```typescript
function updateFishingLine(
  rodTipX: number, rodTipY: number,
  bobberX: number, bobberY: number,
  gfx: Phaser.GameObjects.Graphics
): void {
  gfx.clear();
  gfx.lineStyle(1, 0xd0d0c0, 0.85);

  // 포물선 처짐 (중간 제어점 아래로)
  const midX = (rodTipX + bobberX) / 2;
  const midY = Math.max(rodTipY, bobberY) + 20;   // 아래 처짐

  gfx.beginPath();
  gfx.moveTo(rodTipX, rodTipY);
  gfx.quadraticCurveTo(midX, midY, bobberX, bobberY);
  gfx.strokePath();
}
```

### 5-2. 물고기 낚는 순간 수면 파문 강화

```typescript
function playFishCatchSplash(scene: Phaser.Scene, x: number, y: number): void {
  // 대형 파문 3개 연속
  [0, 100, 220].forEach((delay, i) => {
    scene.time.delayedCall(delay, () => {
      const gfx = scene.add.graphics().setDepth(12);
      const maxR = 20 + i * 10;
      scene.tweens.add({
        targets: { r: 0, a: 0.7 }, r: maxR, a: 0,
        duration: 400, ease: 'Quad.easeOut',
        onUpdate: (tw, obj) => {
          gfx.clear();
          gfx.lineStyle(2, 0x80ccff, obj.a);
          gfx.strokeEllipse(x, y, obj.r * 2, obj.r * 0.55);
        },
        onComplete: () => gfx.destroy()
      });
    });
  });

  // 물고기 점프 (작은 물방울 12개 방사)
  const emitter = scene.add.particles(x, y, 'fx_pixel', {
    tint:    [0x60b8f0, 0x90d0ff, 0xffffff],
    speed:   { min: 60, max: 140 },
    angle:   { min: -160, max: -20 },
    gravityY: 250,
    scale:   { start: 1.5, end: 0 },
    lifespan: { min: 250, max: 500 },
    quantity: 12, emitting: false, depth: 13
  });
  emitter.explode(12);
  scene.time.delayedCall(600, () => emitter.destroy());
}
```

### 5-3. 찌 대기 중 물결 동조

찌(bobber)가 수면 물 타일 애니메이션과 같은 주기로 상하 이동:

```typescript
// plan 42 bobber sine yoyo를 water 애니 프레임 주기(3fps)와 동기화
scene.tweens.add({
  targets: bobberSprite,
  y: bobberSprite.y + 3,
  duration: 333,   // 3fps 주기
  ease: 'Sine.easeInOut',
  yoyo: true, repeat: -1
});
```

---

## 6. 비 올 때 수면 잔물결 강화 (plan 45 연계)

plan 45의 물 슬라이드 RenderTexture alpha 0.08에 더해,  
비가 강할 때 물 타일 위 추가 잔물결:

```typescript
function intensifyWaterRipples(weather: WeatherType): void {
  const rippleFreq = weather === 'storm' ? 80 : weather === 'rain' ? 160 : 0;
  if (rippleFreq === 0) return;

  scene.time.addEvent({
    delay: rippleFreq, loop: true,
    callback: () => {
      // 가시 물 타일 중 랜덤 1개에 작은 파문
      const visibleWaterTile = getRandomVisibleWaterTile();
      if (visibleWaterTile) {
        const gfx = scene.add.graphics().setDepth(12);
        scene.tweens.add({
          targets: { r: 0, a: 0.4 }, r: 8, a: 0,
          duration: 300,
          onUpdate: (tw, obj) => {
            gfx.clear();
            gfx.lineStyle(1, 0xaaddff, obj.a);
            gfx.strokeEllipse(visibleWaterTile.wx + 16, visibleWaterTile.wy + 16, obj.r * 2, obj.r * 0.5);
          },
          onComplete: () => gfx.destroy()
        });
      }
    }
  });
}
```

---

## 7. 깊이(Depth) 할당

| 오브젝트 | depth |
|----------|-------|
| 캐릭터 하반신 (물속) | 8 |
| 수면 반사 레이어 | 11 |
| 물 타일 | 11 |
| 거품 애니메이션 | 11 |
| 파문 링 | 12 |
| 물방울 파티클 | 13 |
| 캐릭터 상반신 (물속) | 35 |
| 낚싯줄 그래픽 | 28 |

---

## 8. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/systems/WaterSplashEffect.ts` | 진입·탈출·걷기 파문 |
| `src/systems/WaterCharacterMask.ts` | 하반신 침수 마스킹 |
| `src/systems/WaterReflectionLayer.ts` | 반사 줄무늬, 오브젝트 반사 |
| `src/systems/ShorelineFoam.ts` | 물가 거품 애니 |
| `src/systems/FishingVisual.ts` | 낚싯줄 베지에, 물고기 낚기 파문, 찌 동조 |

---

## 9. 버전

`v0.57.0`
