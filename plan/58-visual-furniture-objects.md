# Plan 58 — 가구·실내 오브젝트 비주얼 (Visual Furniture & Objects)

## 개요

plan 28(가구 상호작용), plan 13(조리대·작업대), plan 31(문)에서 기능만 정의된  
가구·오브젝트 스프라이트를 설계한다.  
침대·의자·식탁·작업대·조리대·상자·울타리의 스프라이트 명세,  
앉기 애니메이션, 상자 개폐 연출, 상호작용 하이라이트를 포함한다.

---

## 1. 가구 스프라이트 명세 (`FurnitureSpriteGenerator`)

모든 가구는 **32×32px 기본 단위** (일부 2×1, 2×2 타일 크기).  
Canvas 2D API로 절차적 생성, `imageSmoothingEnabled = false`.

### 1-1. 침대 (`bed_wood`, `bed_stone`)

크기: 32×48px (1×1.5 타일)

```typescript
function drawBed(ctx: CanvasRenderingContext2D, material: 'wood' | 'stone'): void {
  const frameColor  = material === 'wood' ? '#6a3a10' : '#7a7870';
  const mattress    = '#e8d8b0';
  const pillow      = '#f8f0e0';
  const blanket     = material === 'wood' ? '#8060a0' : '#6080a0';

  // 침대 프레임
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, 32, 48);

  // 매트리스
  ctx.fillStyle = mattress;
  ctx.fillRect(3, 8, 26, 36);

  // 이불 (하단 2/3)
  ctx.fillStyle = blanket;
  ctx.fillRect(3, 24, 26, 20);

  // 이불 줄무늬 (마름모 패턴)
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(6 + i*8, 24); ctx.lineTo(6 + i*8, 44);
    ctx.stroke();
  }

  // 베개
  ctx.fillStyle = pillow;
  roundRect(ctx, 5, 10, 22, 11, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
  roundRect(ctx, 5, 10, 22, 11, 3); ctx.stroke();

  // 머리판 (상단)
  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, 32, 8);
  // 머리판 장식 홈 2개
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(6, 2, 8, 4);
  ctx.fillRect(18, 2, 8, 4);
}
```

### 1-2. 의자 (`chair_wood`, `chair_stone`)

크기: 16×24px

```typescript
function drawChair(ctx: CanvasRenderingContext2D, material: 'wood' | 'stone'): void {
  const c = material === 'wood'
    ? { body: '#7a4a20', seat: '#9a6030', shadow: '#4a2a10' }
    : { body: '#808070', seat: '#a0a090', shadow: '#505048' };

  // 등받이 (상단)
  ctx.fillStyle = c.body;
  ctx.fillRect(2, 0, 12, 12);
  // 등받이 살
  ctx.fillStyle = c.shadow;
  ctx.fillRect(5, 2, 2, 8);
  ctx.fillRect(9, 2, 2, 8);

  // 좌판
  ctx.fillStyle = c.seat;
  ctx.fillRect(1, 12, 14, 4);

  // 다리 4개
  ctx.fillStyle = c.body;
  ctx.fillRect(2, 16, 3, 8);
  ctx.fillRect(11, 16, 3, 8);
}
```

### 1-3. 식탁 (`table_wood`)

크기: 48×32px (1.5×1 타일)

```typescript
function drawTable(ctx: CanvasRenderingContext2D): void {
  // 상판
  ctx.fillStyle = '#8a5a28';
  roundRect(ctx, 2, 4, 44, 16, 3); ctx.fill();

  // 상판 나뭇결 3개
  ctx.strokeStyle = 'rgba(60,30,8,0.3)'; ctx.lineWidth = 1;
  [10, 24, 38].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x, 19); ctx.stroke();
  });

  // 다리 4개
  ctx.fillStyle = '#6a4018';
  ctx.fillRect(4, 20, 4, 12);
  ctx.fillRect(40, 20, 4, 12);
  ctx.fillRect(13, 20, 4, 10);  // 앞쪽 다리 (원근감, 약간 짧음)
  ctx.fillRect(31, 20, 4, 10);

  // 그림자 (하단 1px 어두운 선)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(2, 19, 44, 2);
}
```

### 1-4. 작업대 (`workbench`)

크기: 48×40px (작업 도구 표면 포함)

```typescript
function drawWorkbench(ctx: CanvasRenderingContext2D): void {
  // 본체
  ctx.fillStyle = '#6a3a10';
  ctx.fillRect(0, 12, 48, 28);

  // 상판 (약간 밝음)
  ctx.fillStyle = '#8a5228';
  ctx.fillRect(0, 8, 48, 10);

  // 상판 나뭇결
  ctx.strokeStyle = 'rgba(50,25,5,0.3)'; ctx.lineWidth = 1;
  [8, 16, 24, 32, 40].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x-2, 18); ctx.stroke();
  });

  // 망치 실루엣 (장식)
  ctx.fillStyle = '#c0a060';
  ctx.fillRect(8, 10, 3, 6);    // 손잡이
  ctx.fillRect(5, 7, 9, 5);     // 머리
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(5, 7, 9, 1);

  // 톱 실루엣
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(28, 9, 14, 2);
  for (let i = 0; i < 6; i++) {
    ctx.fillTriangle?.(28+i*2, 11, 29+i*2, 14, 30+i*2, 11);
    // fallback: fillRect 으로 근사
    ctx.fillRect(28 + i*2, 11, 2, 2);
  }

  // 앞면 서랍 2개
  ctx.fillStyle = '#5a3010';
  ctx.fillRect(4, 16, 16, 8); ctx.fillRect(28, 16, 16, 8);
  ctx.fillStyle = '#c8a040';
  ctx.fillRect(11, 19, 4, 2);  // 손잡이
  ctx.fillRect(35, 19, 4, 2);
}
```

### 1-5. 조리대 (`cooking_station`)

크기: 48×40px

```typescript
function drawCookingStation(ctx: CanvasRenderingContext2D): void {
  // 본체 (석재)
  ctx.fillStyle = '#6a6460';
  ctx.fillRect(0, 10, 48, 30);

  // 상판
  ctx.fillStyle = '#808480';
  ctx.fillRect(0, 6, 48, 10);

  // 조리 홈 (버너 2개)
  ctx.fillStyle = '#3a3430';
  ctx.beginPath();
  ctx.ellipse(14, 11, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.ellipse(34, 11, 9, 5, 0, 0, Math.PI * 2); ctx.fill();

  // 불꽃 표시 (작은 주황 원) — 조리 중일 때만
  // (애니메이션은 FoodCookingEffect에서 처리)
  ctx.fillStyle = '#c0c0b8';
  ctx.fillRect(4, 18, 16, 6); // 냄비 받침
  ctx.fillRect(28, 18, 16, 6);
}
```

### 1-6. 상자 (`chest_wood`) — 2프레임 (닫힘/열림)

크기: 32×28px

```typescript
function drawChest(ctx: CanvasRenderingContext2D, open: boolean): void {
  // 하단 본체
  ctx.fillStyle = '#7a4a18';
  ctx.fillRect(2, 14, 28, 14);

  // 금속 테두리
  ctx.strokeStyle = '#c8a030'; ctx.lineWidth = 1.5;
  ctx.strokeRect(2, 14, 28, 14);
  // 십자 장식
  ctx.beginPath(); ctx.moveTo(16, 14); ctx.lineTo(16, 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2, 21); ctx.lineTo(30, 21); ctx.stroke();

  // 자물쇠
  ctx.fillStyle = '#e0b840';
  ctx.fillRect(13, 19, 6, 5);
  ctx.fillStyle = '#c89020';
  ctx.beginPath();
  ctx.arc(16, 19, 3, Math.PI, 0); ctx.stroke();

  if (!open) {
    // 뚜껑 (닫힘: 살짝 둥근 직사각형)
    ctx.fillStyle = '#8a5528';
    roundRect(ctx, 2, 4, 28, 12, [4, 4, 0, 0]); ctx.fill();
    ctx.strokeStyle = '#c8a030'; ctx.lineWidth = 1.5;
    roundRect(ctx, 2, 4, 28, 12, [4, 4, 0, 0]); ctx.stroke();
    // 뚜껑 나뭇결
    ctx.strokeStyle = 'rgba(60,30,8,0.25)'; ctx.lineWidth = 1;
    [8, 16, 24].forEach(x => {
      ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x, 15); ctx.stroke();
    });
  } else {
    // 뚜껑 열림: 상단으로 90° 회전 표현 (납작한 띠)
    ctx.fillStyle = '#8a5528';
    roundRect(ctx, 2, 0, 28, 5, [2, 2, 0, 0]); ctx.fill();
    ctx.strokeStyle = '#c8a030'; ctx.lineWidth = 1;
    roundRect(ctx, 2, 0, 28, 5, [2, 2, 0, 0]); ctx.stroke();
  }
}
```

---

## 2. 상자 개폐 애니메이션 (`ChestAnimator`)

```typescript
class ChestAnimator {
  open(chestSprite: Phaser.GameObjects.Image): void {
    // 뚜껑 열림 프레임으로 전환
    chestSprite.setTexture('chest_wood_open');

    // scale Y: 1.0 → 0.85 → 1.0 (뚜껑이 열리는 느낌)
    scene.tweens.add({
      targets: chestSprite,
      scaleY: [1.0, 0.85, 1.0],
      duration: 200, ease: 'Quad.easeOut'
    });

    // 먼지 파티클 (상자 앞에서 퍼짐)
    const emitter = scene.add.particles(chestSprite.x, chestSprite.y - 8, 'fx_pixel', {
      tint:    [0xd0b080, 0xe8d090, 0xc0a060],
      speed:   { min: 20, max: 50 },
      angle:   { min: -150, max: -30 },
      scale:   { start: 0.8, end: 0 },
      lifespan: 400, quantity: 5, emitting: false
    }).setDepth(chestSprite.depth + 1);
    emitter.explode(5);
    scene.time.delayedCall(500, () => emitter.destroy());

    // 황금 반짝임 (내용물 암시)
    scene.time.delayedCall(100, () => {
      const sparkle = scene.add.graphics()
        .setPosition(chestSprite.x, chestSprite.y - 4)
        .setDepth(chestSprite.depth + 2);
      sparkle.fillStyle(0xf0c030, 0.8).fillCircle(0, 0, 4);
      scene.tweens.add({
        targets: sparkle, alpha: 0, scaleX: 2.5, scaleY: 2.5,
        duration: 300,
        onComplete: () => sparkle.destroy()
      });
    });
  }

  close(chestSprite: Phaser.GameObjects.Image): void {
    scene.tweens.add({
      targets: chestSprite,
      scaleY: [1.0, 1.1, 1.0],
      duration: 150, ease: 'Quad.easeIn',
      onComplete: () => chestSprite.setTexture('chest_wood')
    });
  }
}
```

---

## 3. 앉기 애니메이션 (`SitAnimator`)

plan 28에서 `scaleY 0.85×` 축소로 명시됨 — tween 구현.

```typescript
class SitAnimator {
  sit(playerSprite: Phaser.GameObjects.Sprite, chair: ChairData): void {
    // 의자 방향으로 플레이어 회전
    const facingDir = getFacingDirection(playerSprite, chair);
    playerSprite.setTexture(`char_sit_${facingDir}`);   // 앉기 전용 idle 프레임

    // Y축 살짝 압축
    scene.tweens.add({
      targets: playerSprite,
      scaleY: 0.85,
      duration: 150, ease: 'Quad.easeOut'
    });

    // 의자 쪽으로 미세 위치 보정 (y +8px)
    scene.tweens.add({
      targets: playerSprite,
      y: chair.worldY + 8,
      duration: 100
    });

    // 앉기 상태 HUD 아이콘 (plan 28 정의)
    showSitStatusHUD();
  }

  stand(playerSprite: Phaser.GameObjects.Sprite): void {
    scene.tweens.add({
      targets: playerSprite,
      scaleY: 1.0,
      duration: 150, ease: 'Back.easeOut'
    });
    playerSprite.setTexture('char_idle');
    hideSitStatusHUD();
  }
}
```

---

## 4. 상호작용 범위 하이라이트 (`InteractionHighlight`)

플레이어가 가구 48px 이내 접근 시 해당 가구를 강조.

```typescript
class InteractionHighlight {
  private outlineGfx: Phaser.GameObjects.Graphics;

  showHighlight(target: Phaser.GameObjects.Image, interactKey = 'E'): void {
    const { x, y, width: w, height: h } = target;
    const depth = target.depth + 0.5;

    // 황금색 점멸 테두리
    this.outlineGfx?.destroy();
    this.outlineGfx = scene.add.graphics().setDepth(depth);
    this.outlineGfx.lineStyle(2, 0xf0c030, 1.0);
    this.outlineGfx.strokeRect(x - w/2 - 2, y - h/2 - 2, w + 4, h + 4);

    // 0.6s yoyo alpha
    scene.tweens.add({
      targets: this.outlineGfx,
      alpha: { from: 1.0, to: 0.3 },
      duration: 600, yoyo: true, repeat: -1
    });

    // [E] 키 힌트 (오브젝트 상단)
    this.keyHint?.destroy();
    this.keyHint = scene.add.text(x, y - h/2 - 14, `[${interactKey}]`, {
      fontSize: '9px', fontFamily: 'Courier New',
      color: '#f0c030', stroke: '#000000', strokeThickness: 2
    }).setDepth(depth + 0.1).setOrigin(0.5);
  }

  hideHighlight(): void {
    this.outlineGfx?.destroy();
    this.keyHint?.destroy();
  }
}
```

---

## 5. 가구 설치 미리보기 (plan 49 보완)

plan 49에서 `setTint(0x88ff88/0xff4444)` 색 지정만 함 → 가구별 footprint 표시 추가.

```typescript
function drawFurniturePlacementPreview(
  gfx: Phaser.GameObjects.Graphics,
  tw: number, th: number,   // 가구 타일 폭·높이 (1×1, 2×1 등)
  worldX: number, worldY: number,
  valid: boolean
): void {
  const color = valid ? 0x40c040 : 0xe03020;
  const alpha = valid ? 0.3 : 0.4;

  gfx.clear();
  gfx.fillStyle(color, alpha);
  gfx.fillRect(worldX, worldY, tw * 32, th * 32);

  gfx.lineStyle(1, color, 0.8);
  gfx.strokeRect(worldX, worldY, tw * 32, th * 32);

  // 격자 (1타일 단위)
  if (tw > 1 || th > 1) {
    gfx.lineStyle(1, color, 0.3);
    for (let c = 1; c < tw; c++) gfx.lineBetween(worldX + c*32, worldY, worldX + c*32, worldY + th*32);
    for (let r = 1; r < th; r++) gfx.lineBetween(worldX, worldY + r*32, worldX + tw*32, worldY + r*32);
  }
}
```

---

## 6. 조리 중 조리대 애니메이션 (`CookingStationEffect`)

```typescript
function startCookingEffect(station: Phaser.GameObjects.Image): void {
  const { x, y } = station;

  // 버너 불꽃 파티클 (2개 버너)
  const emitters = [x - 10, x + 10].map(bx =>
    scene.add.particles(bx, y - 4, 'fx_pixel', {
      tint:    [0xff8010, 0xffb020, 0xffcc40],
      speed:   { min: 8, max: 20 },
      angle:   { min: -110, max: -70 },
      scale:   { start: 0.7, end: 0 },
      alpha:   { start: 0.9, end: 0 },
      lifespan: { min: 200, max: 500 },
      frequency: 100,
      blendMode: Phaser.BlendModes.ADD,
      depth:   station.depth + 1
    })
  );

  // 냄비 뚜껑 흔들림 (증기 올라오는 느낌)
  const lid = scene.add.graphics()
    .setPosition(x - 10, y - 14)
    .setDepth(station.depth + 2);
  lid.fillStyle(0xa0a0b0, 1.0).fillEllipse(0, 0, 18, 6);

  scene.tweens.add({
    targets: lid,
    y: lid.y - 2,
    duration: 300, ease: 'Sine.easeInOut',
    yoyo: true, repeat: -1
  });

  // 증기 파티클
  const steamEmitter = scene.add.particles(x - 10, y - 18, 'fx_pixel', {
    tint:    [0xd0d0d0, 0xe8e8e8],
    speed:   { min: 5, max: 12 },
    angle:   { min: -110, max: -70 },
    scale:   { start: 1.0, end: 2.0 },
    alpha:   { start: 0.5, end: 0 },
    lifespan: 600, frequency: 150,
    depth:   station.depth + 3
  });

  // 요리 완료 시 stopCookingEffect 호출
  station.setData('cookingEmitters', [...emitters, steamEmitter, lid]);
}

function stopCookingEffect(station: Phaser.GameObjects.Image): void {
  const objects: (Phaser.GameObjects.Particles.ParticleEmitter | Phaser.GameObjects.Graphics)[]
    = station.getData('cookingEmitters') ?? [];
  objects.forEach(o => o.destroy());
  station.setData('cookingEmitters', null);
}
```

---

## 7. 울타리 스프라이트 (`fence`)

크기: 32×24px, 4방향 접합 autotile (plan 41 bitmask 방식 재사용)

```typescript
function drawFence(ctx: CanvasRenderingContext2D, mask: number): void {
  // mask: N=1, E=2, S=4, W=8
  ctx.fillStyle = '#7a4a20';

  // 중심 기둥
  ctx.fillRect(13, 4, 6, 20);

  // 연결 방향별 가로대 2개
  if (mask & 2) {  // East
    ctx.fillRect(19, 8, 13, 3);
    ctx.fillRect(19, 14, 13, 3);
  }
  if (mask & 8) {  // West
    ctx.fillRect(0, 8, 13, 3);
    ctx.fillRect(0, 14, 13, 3);
  }
  if (mask & 1) {  // North → 기둥만 위로 연장
    ctx.fillRect(13, 0, 6, 4);
  }
  if (mask & 4) {  // South
    ctx.fillRect(13, 24, 6, 8);
  }
}
```

---

## 8. 깊이(Depth) 할당

| 오브젝트 | depth |
|----------|-------|
| 가구 스프라이트 | 30 + y/TILE_SIZE×0.01 (오브젝트 레이어) |
| 상호작용 하이라이트 테두리 | depth + 0.5 |
| [E] 키 힌트 텍스트 | depth + 0.6 |
| 상자 개폐 파티클 | depth + 1 |
| 조리대 불꽃 파티클 | depth + 1 |
| 냄비 뚜껑 그래픽 | depth + 2 |
| 증기 파티클 | depth + 3 |

---

## 9. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/generators/FurnitureSpriteGenerator.ts` | 가구 전체 Canvas 드로잉 함수 |
| `src/systems/ChestAnimator.ts` | 상자 개폐 tween, 파티클 |
| `src/systems/SitAnimator.ts` | 앉기/서기 scaleY tween |
| `src/systems/InteractionHighlight.ts` | 가구 황금 테두리 + 키 힌트 |
| `src/systems/CookingStationEffect.ts` | 버너 파티클, 냄비 뚜껑 흔들림 |

---

## 10. 버전

`v0.58.0`
