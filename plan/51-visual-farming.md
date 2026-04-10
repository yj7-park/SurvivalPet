# Plan 51 — 농업 비주얼 시스템 (Visual Farming)

## 개요

plan 39에서 구현된 농업 시스템(경작·파종·물주기·수확)의 시각 표현을 설계한다.  
경작지 상태별 타일 외형, 작물 성장 스프라이트, 물주기 파티클, 수확 이펙트, 계절별 색상 변화를 포함한다.

---

## 1. 경작지 타일 스프라이트 (FarmTileRenderer)

### 1-1. 경작지 상태

| 상태 key | 설명 | 색상 팔레트 |
|----------|------|-------------|
| `untilled` | 기본 흙 | plan 41 DIRT_TINTS 동일 |
| `tilled` | 경운된 흙 (고랑 무늬) | 어두운 갈색 0x8a5c28 |
| `tilled_wet` | 물 준 경운 흙 | 짙은 갈색 0x6a3c18, 표면 반짝임 |
| `tilled_dry` | 물 필요 (마른 경운 흙) | 밝은 황토 0xb0804a, 균열 선 |

### 1-2. 경작지 스프라이트 생성 (`drawFarmTile`)

```typescript
function drawFarmTile(
  ctx: CanvasRenderingContext2D,
  state: 'tilled' | 'tilled_wet' | 'tilled_dry',
  season: Season
): void {
  const W = 32, H = 32;

  // 기본 흙 색
  const base = state === 'tilled_wet' ? 0x6a3c18
             : state === 'tilled_dry' ? 0xb0804a
             : 0x8a5c28;
  ctx.fillStyle = hexToRgba(base);
  ctx.fillRect(0, 0, W, H);

  // 고랑 무늬 — 4개 가로 줄
  ctx.strokeStyle = state === 'tilled_wet' ? 'rgba(40,20,8,0.5)' : 'rgba(80,50,20,0.4)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    const y = 4 + row * 8;
    ctx.beginPath();
    ctx.moveTo(2, y);
    ctx.lineTo(W - 2, y);
    ctx.stroke();
  }

  // wet: 표면 반짝임 3개 점
  if (state === 'tilled_wet') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    [[6,6],[14,20],[24,12]].forEach(([x,y]) => {
      ctx.fillRect(x, y, 2, 2);
    });
  }

  // dry: 균열 선 2개 짧은 대각선
  if (state === 'tilled_dry') {
    ctx.strokeStyle = 'rgba(160,100,40,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8,8);  ctx.lineTo(12,14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20,18); ctx.lineTo(26,22); ctx.stroke();
  }

  // 계절별 색조 보정 (plan 41 DIRT_TINTS에 맞춤)
  if (season === 'winter') {
    ctx.fillStyle = 'rgba(200,200,220,0.15)';
    ctx.fillRect(0, 0, W, H);
  }
}
```

---

## 2. 작물 성장 스프라이트 (`CropSpriteGenerator`)

### 2-1. 작물 타입 & 스프라이트 크기

각 작물은 **3단계** 성장 스프라이트 → 4번째 sprite = 수확 가능 상태(흔들림 애니)

| 작물 | ID | 최대 크기(3단계) | 주요 색 |
|------|----|-----------------|---------|
| 밀 | `wheat` | 24×28px | 초록→황금 0xd4b030 |
| 당근 | `carrot` | 16×24px | 주황 0xe06820, 초록 줄기 |
| 감자 | `potato` | 20×20px | 연갈색 잎, 꽃 |
| 호박 | `pumpkin` | 28×22px | 주황 0xe87020, 덩굴 |

### 2-2. 각 작물 3단계 스프라이트 명세

#### 밀 (wheat)

```
stage 1 (새싹): 4×8px 단순 초록 줄기 2~3개
stage 2 (성장): 8×16px 줄기 위 작은 잎 Y-shape
stage 3 (성숙): 12×24px 줄기+이삭 (타원 4개 상단 군집)
harvest: stage 3 + 황금 tint + 이삭 흔들림 yoyo tween
```

```typescript
function drawWheat(ctx: CanvasRenderingContext2D, stage: 1|2|3, harvest: boolean): void {
  const green  = '#4a8a30';
  const yellow = '#d4b030';
  const stemColor = harvest || stage === 3 ? yellow : green;

  if (stage === 1) {
    // 2개 줄기
    ctx.fillStyle = green;
    ctx.fillRect(5, 16, 2, 8); ctx.fillRect(9, 14, 2, 10);
  } else if (stage === 2) {
    ctx.fillStyle = green;
    ctx.fillRect(6, 8, 2, 16);
    // Y자 잎
    ctx.beginPath(); ctx.moveTo(7,10); ctx.lineTo(3,6);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7,10); ctx.lineTo(11,6); ctx.stroke();
  } else {
    // 줄기
    ctx.fillStyle = stemColor;
    ctx.fillRect(6, 8, 2, 18);
    // 이삭 5개 타원
    ctx.fillStyle = harvest ? '#f0c840' : '#a8c040';
    for (let i = 0; i < 5; i++) {
      const ox = 3 + i * 2, oy = 4 + Math.abs(i - 2) * 2;
      ctx.beginPath(); ctx.ellipse(ox, oy, 2, 4, 0.2, 0, Math.PI * 2); ctx.fill();
    }
  }
}
```

#### 당근 (carrot)

```
stage 1: 2줄기 초록 잎 (8×10px)
stage 2: 4줄기 잎 + 땅속 주황 힌트 (12×18px)
stage 3: 풍성한 잎 + 도출된 당근 몸통 삼각 (16×24px)
harvest: 주황 강조 tint, 잎 좌우 흔들림
```

#### 감자 (potato)

```
stage 1: 쌍엽 초록 (10×8px)
stage 2: 3~4잎 군 (16×14px)
stage 3: 풍성한 잎 + 작은 흰 꽃 (18×20px)
harvest: 꽃 노랑→흰 점멸 (알파 0.6↔1.0 yoyo 1.2s)
```

#### 호박 (pumpkin)

```
stage 1: 덩굴 줄기 + 잎 1개 (10×8px)
stage 2: 덩굴 확장 + 잎 3개 (22×12px)
stage 3: 덩굴 + 호박 (주황 원형 + 세그먼트 선) (28×22px)
harvest: 호박 반짝임 하이라이트 점 + 흔들 tween
```

### 2-3. 성장 단계 tween (CropGrowthAnimator)

```typescript
class CropGrowthAnimator {
  // 새 단계 진입 시 scale punch 효과
  onStageAdvance(cropSprite: Phaser.GameObjects.Image): void {
    // 1. 순간 scale 0.6 → 1.2 → 1.0 (0.4s, Back.easeOut)
    scene.tweens.add({
      targets: cropSprite,
      scaleX: [0.6, 1.2, 1.0],
      scaleY: [0.6, 1.2, 1.0],
      duration: 400,
      ease: 'Back.easeOut'
    });
    // 2. 초록 파티클 2~4개 위로 퍼짐
    emitGrowParticles(cropSprite.x, cropSprite.y);
  }

  // 수확 가능 상태 흔들림 (무한 반복)
  onHarvestReady(cropSprite: Phaser.GameObjects.Image): void {
    scene.tweens.add({
      targets: cropSprite,
      angle: { from: -4, to: 4 },
      duration: 800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }

  private emitGrowParticles(x: number, y: number): void {
    const emitter = scene.add.particles(x, y, 'fx_pixel', {
      tint:      [0x60c040, 0x80d060, 0x40a020],
      speed:     { min: 20, max: 60 },
      angle:     { min: -90, max: -30 },   // 위쪽 방향
      scale:     { start: 0.8, end: 0 },
      alpha:     { start: 1.0, end: 0 },
      lifespan:  500,
      quantity:  3,
      emitting:  false
    });
    emitter.explode(3);
    scene.time.delayedCall(600, () => emitter.destroy());
  }
}
```

---

## 3. 물주기 파티클 (`playWaterAnimation`)

```typescript
function playWaterAnimation(scene: Phaser.Scene, tileWorldX: number, tileWorldY: number): void {
  // 3개 물방울 호 궤적 (watering_can 앞에서 tile로)
  const drops = 5;
  for (let i = 0; i < drops; i++) {
    const delay = i * 60;
    const drop = scene.add.graphics().fillStyle(0x4090e0, 0.9).fillRect(0, 0, 3, 5);
    drop.setPosition(tileWorldX - 20 + i * 4, tileWorldY - 16);
    drop.setDepth(55); // HUD 아래, 파티클 위

    scene.tweens.add({
      targets: drop,
      x: tileWorldX + Phaser.Math.Between(-6, 6),
      y: tileWorldY + 4,
      duration: 300,
      delay,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // 착지 시 물방울 퍼짐 2개
        spawnWaterSplash(scene, drop.x, drop.y);
        drop.destroy();
      }
    });
  }

  // 착지 후 tilled_wet 타일로 1px dark overlay
  scene.time.delayedCall(drops * 60 + 300, () => {
    refreshFarmTileSprite(tileWorldX, tileWorldY, 'tilled_wet');
  });
}

function spawnWaterSplash(scene: Phaser.Scene, x: number, y: number): void {
  const emitter = scene.add.particles(x, y, 'fx_pixel', {
    tint:     [0x60b0f0, 0x80c8ff, 0xaaddff],
    speed:    { min: 15, max: 40 },
    angle:    { min: -150, max: -30 },
    scale:    { start: 0.6, end: 0 },
    alpha:    { start: 0.9, end: 0 },
    lifespan: 300,
    quantity: 4,
    emitting: false
  });
  emitter.explode(4);
  scene.time.delayedCall(400, () => emitter.destroy());
}
```

---

## 4. 수확 이펙트 (`playHarvestEffect`)

```typescript
const HARVEST_COLORS: Record<CropType, number> = {
  wheat:   0xf0c030,
  carrot:  0xe06820,
  potato:  0xc8d080,
  pumpkin: 0xe87020,
};

function playHarvestEffect(
  scene: Phaser.Scene,
  cropType: CropType,
  worldX: number,
  worldY: number
): void {
  const color = HARVEST_COLORS[cropType];

  // 1. 작물 스프라이트 scale punch up + fade out
  // (CropSprite는 ObjectLayer에서 관리)
  scene.tweens.add({
    targets: getCropSprite(worldX, worldY),
    scaleX: 1.5, scaleY: 1.5,
    alpha: 0,
    duration: 250,
    ease: 'Quad.easeOut',
    onComplete: (tween, [spr]) => spr.destroy()
  });

  // 2. 파티클 버스트 6~8개 (작물 색)
  const emitter = scene.add.particles(worldX, worldY, 'fx_pixel', {
    tint:     [color, 0xffffff, color],
    speed:    { min: 40, max: 100 },
    angle:    { min: 0, max: 360 },
    scale:    { start: 1.2, end: 0 },
    alpha:    { start: 1.0, end: 0 },
    lifespan: 500,
    quantity: 7,
    emitting: false
  });
  emitter.explode(7);

  // 3. 수확물 아이콘 팝업 (plan 49 showXpGain 스타일)
  const cropName: Record<CropType, string> = {
    wheat: '🌾 밀', carrot: '🥕 당근', potato: '🥔 감자', pumpkin: '🎃 호박'
  };
  const popup = scene.add.text(worldX, worldY - 8, cropName[cropType], {
    fontSize: '11px', fontFamily: 'Courier New',
    color: '#ffffff', stroke: '#000000', strokeThickness: 2
  }).setDepth(90).setOrigin(0.5);

  scene.tweens.add({
    targets: popup,
    y: popup.y - 24,
    alpha: { from: 1, to: 0 },
    duration: 700,
    ease: 'Quad.easeOut',
    onComplete: () => { popup.destroy(); emitter.destroy(); }
  });

  // 4. 경작지를 tilled(마른) 상태로 즉시 전환
  scene.time.delayedCall(250, () => refreshFarmTileSprite(worldX, worldY, 'tilled'));
}
```

---

## 5. 계절별 작물 색상 팔레트

```typescript
const CROP_SEASON_TINT: Record<Season, number> = {
  spring: 0xffffff,   // 원색 그대로
  summer: 0xeeff88,   // 살짝 황록 강조
  autumn: 0xffcc66,   // 주황빛 따뜻한 톤
  winter: 0xaabbcc,   // 청회색 (생육 불가 상태는 alpha 0.5)
};

// winter에서 작물 성장 없음 → 있는 작물은 반투명 + 고사 표시
function applyWinterCropEffect(cropSprite: Phaser.GameObjects.Image): void {
  cropSprite.setAlpha(0.45);
  cropSprite.setTint(0x8899aa);
  // "고사" 텍스트 레이블 (소형)
  if (!cropSprite.getData('winterLabel')) {
    const lbl = scene.add.text(cropSprite.x, cropSprite.y - 12, '고사', {
      fontSize: '8px', fontFamily: 'Courier New', color: '#aaaacc'
    }).setDepth(cropSprite.depth + 1).setOrigin(0.5);
    cropSprite.setData('winterLabel', lbl);
  }
}
```

---

## 6. 경작지 필드 오버뷰 (Farm Plot Border)

### 경작지 경계 표시

```typescript
class FarmPlotBorder {
  // 경운된 타일 그룹 주변 점선 테두리
  drawFarmBorder(tiledPositions: { tx: number; ty: number }[]): void {
    const gfx = scene.add.graphics().setDepth(22); // 타일 위, 오브젝트 아래

    gfx.lineStyle(1, 0xa06030, 0.5);

    // 외곽 경계 세그먼트만 그리기 (인접하지 않은 변만)
    for (const { tx, ty } of tiledPositions) {
      const wx = tx * 32, wy = ty * 32;
      const neighbors = [
        { dx: 0, dy: -1, sx: wx,    sy: wy,    ex: wx+32, ey: wy    }, // top
        { dx: 0, dy:  1, sx: wx,    sy: wy+32, ex: wx+32, ey: wy+32 }, // bottom
        { dx:-1, dy:  0, sx: wx,    sy: wy,    ex: wx,    ey: wy+32 }, // left
        { dx: 1, dy:  0, sx: wx+32, sy: wy,    ex: wx+32, ey: wy+32 }, // right
      ];
      for (const { dx, dy, sx, sy, ex, ey } of neighbors) {
        const isNeighbor = tiledPositions.some(p => p.tx === tx + dx && p.ty === ty + dy);
        if (!isNeighbor) {
          // 점선 효과: 4px 선, 4px 공백
          drawDashedLine(gfx, sx, sy, ex, ey, 4, 4);
        }
      }
    }
  }

  private drawDashedLine(
    gfx: Phaser.GameObjects.Graphics,
    x1: number, y1: number, x2: number, y2: number,
    dashLen: number, gapLen: number
  ): void {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    const ux = dx/len, uy = dy/len;
    let pos = 0;
    let drawing = true;
    while (pos < len) {
      const segLen = Math.min(drawing ? dashLen : gapLen, len - pos);
      if (drawing) {
        gfx.beginPath();
        gfx.moveTo(x1 + ux*pos, y1 + uy*pos);
        gfx.lineTo(x1 + ux*(pos+segLen), y1 + uy*(pos+segLen));
        gfx.strokePath();
      }
      pos += segLen;
      drawing = !drawing;
    }
  }
}
```

---

## 7. 물 고갈 경고 시각 (`DryWarningIndicator`)

```typescript
// 물주기 필요한 작물 위에 물방울 아이콘 (역삼각형 파란색) blink
class DryWarningIndicator {
  private indicators = new Map<string, Phaser.GameObjects.Graphics>();

  show(cropKey: string, worldX: number, worldY: number): void {
    if (this.indicators.has(cropKey)) return;
    const gfx = scene.add.graphics().setDepth(72); // 캐릭터 위
    gfx.fillStyle(0x4090e0, 0.9);
    // 물방울 역삼각형 (10×12px)
    gfx.fillTriangle(worldX - 5, worldY - 24, worldX + 5, worldY - 24, worldX, worldY - 14);
    // 상단 원
    gfx.fillCircle(worldX, worldY - 26, 4);

    // 깜빡임 tween 1s yoyo
    scene.tweens.add({
      targets: gfx, alpha: { from: 1.0, to: 0.3 },
      duration: 800, yoyo: true, repeat: -1
    });
    this.indicators.set(cropKey, gfx);
  }

  hide(cropKey: string): void {
    const gfx = this.indicators.get(cropKey);
    if (gfx) { gfx.destroy(); this.indicators.delete(cropKey); }
  }
}
```

---

## 8. 농업 UI 통합 (HUD 보완)

### 8-1. 경작 도구 선택 시 커서 변경

```typescript
// plan 43 UIRenderer 확장
function updateFarmingCursor(activeTool: ItemId | null): void {
  const canvas = document.querySelector('canvas')!;
  switch (activeTool) {
    case 'hoe':           canvas.style.cursor = 'crosshair'; break;
    case 'watering_can':  canvas.style.cursor = 'cell';       break;
    default:              canvas.style.cursor = 'default';
  }
}
```

### 8-2. 수확 가능 작물 수 HUD 뱃지

```typescript
// plan 43 HUD 영역에 추가
function drawHarvestBadge(ctx: CanvasRenderingContext2D, count: number): void {
  if (count === 0) return;
  // 오른쪽 상단 미니맵 옆 (plan 43 기준 x:right-60, y:10)
  ctx.fillStyle = '#d4b030';
  roundRect(ctx, HUD_RIGHT - 56, 8, 48, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#1a1008';
  ctx.font = 'bold 10px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(`🌾 ${count}`, HUD_RIGHT - 32, 21);
}
```

---

## 9. 깊이(Depth) 할당

| 오브젝트 | depth |
|----------|-------|
| 경작지 타일 오버레이 | 3 (terrain 위, decor 아래) |
| 경작지 경계선(점선) | 22 |
| 작물 스프라이트 | 30 (오브젝트 레이어) |
| 물주기 물방울 | 55 |
| 물 고갈 경고 아이콘 | 72 |
| 수확 팝업 텍스트 | 90 |

---

## 10. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/systems/FarmingVisualSystem.ts` | FarmPlotBorder, CropGrowthAnimator, DryWarningIndicator |
| `src/generators/CropSpriteGenerator.ts` | drawWheat, drawCarrot, drawPotato, drawPumpkin (각 3단계) |
| `src/generators/FarmTileGenerator.ts` | drawFarmTile (3 상태) |
| `src/systems/FarmingSystem.ts` | playWaterAnimation, playHarvestEffect 호출 통합 |
| `src/ui/HUDRenderer.ts` | drawHarvestBadge 추가 |

---

## 11. 버전

`v0.51.0`
