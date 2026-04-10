# Plan 63 — 아이템 드롭·루트 비주얼 (Visual Loot & Drop Effects)

## 개요

plan 16(드랍·루팅 시스템)·plan 47(아이템 아이콘)에서  
지면 hover 애니는 설계됐으나 **적 처치 드롭 낙하**, **픽업 당김**, **소멸 효과**,  
**희귀도별 글로우·파티클**이 없다.  
적 사망 위치에서 아이템이 퍼져 떨어지고, 플레이어 접근 시 자동 흡입되며,  
소멸 타이머 종료 시 자연스럽게 사라지는 전체 라이프사이클을 설계한다.

---

## 1. 드롭 낙하 애니메이션 (`DropSpawnEffect`)

### 1-1. 단일 아이템 드롭

적 처치 위치 → 방사형으로 퍼져 바닥에 착지:

```typescript
interface DropLaunchParams {
  itemId:   string;
  fromX:    number;
  fromY:    number;
  targetX:  number;   // 착지 목표 (랜덤 오프셋)
  targetY:  number;
  rarity:   ItemRarity;
  delay:    number;   // ms (여러 개 순차 드롭)
}

function spawnDropItem(scene: Phaser.Scene, p: DropLaunchParams): void {
  const icon = scene.add.image(p.fromX, p.fromY, `icon_${p.itemId}`)
    .setDepth(40)
    .setScale(0.9)
    .setAlpha(0);

  // --- 1. 잠깐 scale 팝업 (0→1.2→1.0, 0.15s) ---
  scene.tweens.add({
    targets: icon,
    alpha: { from: 0, to: 1 },
    scaleX: [0, 1.3, 1.0],
    scaleY: [0, 1.3, 1.0],
    delay: p.delay,
    duration: 150,
    ease: 'Back.easeOut'
  });

  // --- 2. 포물선 호 날아가기 (0.4s Quad.easeOut) ---
  const startX = p.fromX, startY = p.fromY;
  const endX   = p.targetX, endY = p.targetY;
  const peakY  = Math.min(startY, endY) - Phaser.Math.Between(20, 40);

  scene.tweens.add({
    targets: { t: 0 }, t: 1,
    delay: p.delay,
    duration: 400,
    ease: 'Quad.easeOut',
    onUpdate: (tw, obj) => {
      const t = obj.t;
      icon.x = startX + (endX - startX) * t;
      icon.y = startY + (endY - startY) * t
             + (peakY - startY) * 4 * t * (1 - t);
      icon.angle = t * 180;  // 회전으로 떨어지는 느낌
    },
    onComplete: () => {
      icon.angle = 0;
      playDropLandEffect(scene, endX, endY, p.rarity);
      startGroundItemHover(icon, p.rarity);   // plan 47 hover 연결
    }
  });
}
```

### 1-2. 복수 아이템 방사형 드롭

```typescript
function spawnMultiDrop(
  scene: Phaser.Scene,
  drops: { itemId: string; amount: number; rarity: ItemRarity }[],
  fromX: number, fromY: number
): void {
  drops.forEach((drop, i) => {
    // 방사형 각도
    const angle  = (i / drops.length) * Math.PI * 2;
    const spread = Phaser.Math.Between(20, 48);
    const tx = fromX + Math.cos(angle) * spread;
    const ty = fromY + Math.sin(angle) * spread * 0.6;   // 등축 투영

    spawnDropItem(scene, {
      itemId:  drop.itemId,
      fromX,   fromY,
      targetX: tx,
      targetY: ty,
      rarity:  drop.rarity,
      delay:   i * 60   // 60ms 간격 순차 등장
    });
  });

  // 드롭 시작점 폭발 파티클 (적 사망 위치)
  playDropExplosion(scene, fromX, fromY);
}
```

### 1-3. 착지 이펙트 (`playDropLandEffect`)

```typescript
function playDropLandEffect(
  scene: Phaser.Scene,
  x: number, y: number,
  rarity: ItemRarity
): void {
  const rarityColors: Record<ItemRarity, number> = {
    common:   0xd0d0d0,
    uncommon: 0x40c040,
    rare:     0x4060e0,
    epic:     0xc040c0,
  };
  const color = rarityColors[rarity];

  // 먼지 파티클 3개 (착지 충격)
  const emitter = scene.add.particles(x, y, 'fx_pixel', {
    tint:    [color, 0xffffff],
    speed:   { min: 20, max: 50 },
    angle:   { min: -150, max: -30 },
    scale:   { start: 0.8, end: 0 },
    lifespan: 300,
    quantity: 3,
    emitting: false,
    depth:   41
  });
  emitter.explode(3);
  scene.time.delayedCall(400, () => emitter.destroy());

  // 착지 링 (희귀도 색상)
  const gfx = scene.add.graphics().setDepth(39);
  scene.tweens.add({
    targets: { r: 2, a: 0.7 }, r: 16, a: 0,
    duration: 250, ease: 'Quad.easeOut',
    onUpdate: (tw, obj) => {
      gfx.clear();
      gfx.lineStyle(1.5, color, obj.a);
      gfx.strokeEllipse(x, y, obj.r * 2, obj.r * 0.6);
    },
    onComplete: () => gfx.destroy()
  });
}
```

### 1-4. 드롭 폭발 연출

```typescript
function playDropExplosion(scene: Phaser.Scene, x: number, y: number): void {
  // 황금 버스트 6개
  const emitter = scene.add.particles(x, y, 'fx_pixel', {
    tint:    [0xf0c030, 0xffd060, 0xffffff],
    speed:   { min: 40, max: 100 },
    angle:   { min: 0, max: 360 },
    scale:   { start: 1.3, end: 0 },
    lifespan: 400,
    quantity: 6,
    emitting: false,
    depth:   42
  });
  emitter.explode(6);
  scene.time.delayedCall(500, () => emitter.destroy());
}
```

---

## 2. 희귀도별 지면 글로우 강화 (plan 47 보완)

plan 47에서 non-common 아이템에 "glow ring" 언급 → 상세 구현.

```typescript
function createRarityGlow(
  scene: Phaser.Scene,
  icon: Phaser.GameObjects.Image,
  rarity: ItemRarity
): Phaser.GameObjects.Graphics {
  if (rarity === 'common') return;

  const GLOW_CONFIGS: Record<Exclude<ItemRarity,'common'>, {
    innerColor: number; outerColor: number;
    pulseMin: number; pulseMax: number;
  }> = {
    uncommon: { innerColor: 0x40c040, outerColor: 0x206020, pulseMin: 0.3, pulseMax: 0.7 },
    rare:     { innerColor: 0x4080ff, outerColor: 0x203080, pulseMin: 0.4, pulseMax: 0.8 },
    epic:     { innerColor: 0xd060ff, outerColor: 0x602080, pulseMin: 0.5, pulseMax: 1.0 },
  };
  const cfg = GLOW_CONFIGS[rarity];
  const gfx = scene.add.graphics().setDepth(icon.depth - 0.5);

  // glow 그래픽 업데이트 함수 (매 프레임 icon 위치 추적)
  const update = () => {
    gfx.clear();
    const t = Date.now() / 1000;
    const pulseFactor = (Math.sin(t * 2.5) + 1) / 2;   // 0~1
    const alpha = cfg.pulseMin + pulseFactor * (cfg.pulseMax - cfg.pulseMin);

    // 외부 글로우 (큰 원, 흐릿)
    gfx.fillStyle(cfg.outerColor, alpha * 0.4);
    gfx.fillCircle(icon.x, icon.y, 14);
    // 내부 글로우 (작은 원, 선명)
    gfx.fillStyle(cfg.innerColor, alpha * 0.6);
    gfx.fillCircle(icon.x, icon.y, 8);
  };

  scene.events.on(Phaser.Scenes.Events.UPDATE, update);
  // icon 삭제 시 gfx도 정리
  icon.on(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, update);
    gfx.destroy();
  });

  return gfx;
}
```

### Epic 아이템 파티클 루프

```typescript
function createEpicIdleParticles(
  scene: Phaser.Scene, icon: Phaser.GameObjects.Image
): void {
  const emitter = scene.add.particles(icon.x, icon.y, 'fx_pixel', {
    tint:    [0xd060ff, 0xff80ff, 0xffffff],
    speed:   { min: 10, max: 30 },
    angle:   { min: 0, max: 360 },
    scale:   { start: 0.6, end: 0 },
    alpha:   { start: 0.8, end: 0 },
    lifespan: { min: 500, max: 900 },
    frequency: 200,
    depth:   icon.depth + 1,
    blendMode: Phaser.BlendModes.ADD
  });

  // icon 위치 추적
  scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
    emitter.setPosition(icon.x, icon.y - 4);
  });
  icon.on(Phaser.GameObjects.Events.DESTROY, () => emitter.destroy());
}
```

---

## 3. 픽업 당김 애니메이션 (`PickupMagnetEffect`)

플레이어가 자동 픽업 반경(48px)에 진입 시 아이템이 날아옴:

```typescript
function playPickupMagnet(
  scene: Phaser.Scene,
  icon: Phaser.GameObjects.Image,
  playerSprite: Phaser.GameObjects.Sprite,
  onReach: () => void
): void {
  // 먼저 hover tween 중지 (plan 47 기존 tween)
  scene.tweens.killTweensOf(icon);

  // 플레이어 방향으로 가속 날아감 (0.25s)
  scene.tweens.add({
    targets: icon,
    x: playerSprite.x,
    y: playerSprite.y - 8,
    scaleX: 0.3,
    scaleY: 0.3,
    alpha: 0.6,
    duration: 250,
    ease: 'Quad.easeIn',
    onComplete: () => {
      icon.destroy();
      onReach();
      playPickupReachEffect(scene, playerSprite.x, playerSprite.y);
    }
  });

  // 당기는 동안 아이콘 주변 작은 파티클 trail
  const trailTimer = scene.time.addEvent({
    delay: 30, repeat: 7,
    callback: () => {
      const trail = scene.add.image(icon.x, icon.y, icon.texture.key)
        .setScale(icon.scaleX * 0.7)
        .setAlpha(0.3)
        .setDepth(icon.depth - 0.1)
        .setTint(0xffffff);
      scene.tweens.add({
        targets: trail, alpha: 0, scaleX: 0, scaleY: 0,
        duration: 150,
        onComplete: () => trail.destroy()
      });
    }
  });
}
```

### 픽업 도달 이펙트

```typescript
function playPickupReachEffect(
  scene: Phaser.Scene, x: number, y: number
): void {
  // 흰빛 소형 burst
  const emitter = scene.add.particles(x, y - 8, 'fx_pixel', {
    tint:    [0xffffff, 0xffeeaa],
    speed:   { min: 20, max: 60 },
    angle:   { min: -150, max: -30 },
    scale:   { start: 0.8, end: 0 },
    lifespan: 250, quantity: 5, emitting: false, depth: 55
  });
  emitter.explode(5);
  scene.time.delayedCall(300, () => emitter.destroy());
}
```

---

## 4. 소멸 효과 (`GroundItemDespawn`)

plan 16에서 "소멸 10초 전 깜빡임" 명시됨 → 전체 소멸 라이프사이클 상세화.

```typescript
class GroundItemLifecycle {
  private blinkTween: Phaser.Tweens.Tween | null = null;

  // 소멸 30초 전: 느린 alpha 맥박
  startSlowBlink(icon: Phaser.GameObjects.Image): void {
    this.blinkTween?.stop();
    this.blinkTween = scene.tweens.add({
      targets: icon,
      alpha: { from: 1.0, to: 0.4 },
      duration: 1000, yoyo: true, repeat: -1
    });
  }

  // 소멸 10초 전: 빠른 깜빡임 + 주황 틴트
  startFastBlink(icon: Phaser.GameObjects.Image): void {
    this.blinkTween?.stop();
    icon.setTint(0xffaa44);
    this.blinkTween = scene.tweens.add({
      targets: icon,
      alpha: { from: 1.0, to: 0.2 },
      duration: 300, yoyo: true, repeat: -1
    });
  }

  // 소멸: 아래로 가라앉으며 fade + 연기 파티클 3개
  despawn(icon: Phaser.GameObjects.Image): void {
    this.blinkTween?.stop();
    scene.tweens.killTweensOf(icon);

    // 가라앉기 + fade
    scene.tweens.add({
      targets: icon,
      y: icon.y + 12,
      alpha: 0,
      scaleX: 0.5, scaleY: 0.5,
      duration: 400, ease: 'Quad.easeIn',
      onComplete: () => icon.destroy()
    });

    // 연기 파티클
    const emitter = scene.add.particles(icon.x, icon.y, 'fx_pixel', {
      tint:    [0x808080, 0xa0a0a0],
      speed:   { min: 8, max: 20 },
      angle:   { min: -110, max: -70 },
      scale:   { start: 0.8, end: 2.0 },
      alpha:   { start: 0.5, end: 0 },
      lifespan: 500, quantity: 3, emitting: false, depth: 41
    });
    emitter.explode(3);
    scene.time.delayedCall(600, () => emitter.destroy());
  }
}
```

---

## 5. 루트 백 (다량 드롭 통합 표시)

5개 이상 드롭 시 개별 아이콘 대신 **황금 자루** 아이콘으로 통합:

```typescript
// icon: 'loot_bag' — Canvas로 그리는 자루 아이콘
function drawLootBag(ctx: CanvasRenderingContext2D, count: number): void {
  // 자루 본체 (둥근 직사각형 + 리본)
  ctx.fillStyle = '#c89020';
  ctx.beginPath();
  ctx.ellipse(8, 10, 7, 8, 0, 0, Math.PI * 2); ctx.fill();

  // 리본/묶음 부분
  ctx.fillStyle = '#a07010';
  ctx.fillRect(5, 2, 6, 3);

  // 반짝임 하이라이트
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(5, 7, 2, 3, -0.4, 0, Math.PI * 2); ctx.fill();

  // 아이템 개수 뱃지
  ctx.fillStyle = '#1a1008';
  ctx.beginPath(); ctx.arc(13, 3, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c030';
  ctx.font = 'bold 5px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(`${count}`, 13, 5);
}

// 자루 열기: 내용물 아이콘을 방사형으로 배출
function openLootBag(
  scene: Phaser.Scene,
  bagIcon: Phaser.GameObjects.Image,
  items: GroundItem[]
): void {
  bagIcon.destroy();
  items.forEach((item, i) => {
    spawnDropItem(scene, {
      itemId:  item.itemId,
      fromX:   bagIcon.x,
      fromY:   bagIcon.y,
      targetX: bagIcon.x + Math.cos(i / items.length * Math.PI * 2) * 28,
      targetY: bagIcon.y + Math.sin(i / items.length * Math.PI * 2) * 18,
      rarity:  getItemRarity(item.itemId),
      delay:   i * 40
    });
  });
}
```

---

## 6. 아이템 획득 HUD 토스트 (plan 37 연계)

```typescript
// plan 37 NotifySystem.show 타입 확장
// type: 'loot' 추가 — 아이콘 + 아이템명 + 수량 표시

function showLootNotify(itemId: string, amount: number): void {
  const name   = getItemName(itemId);
  const rarity = getItemRarity(itemId);
  const rarityColors: Record<ItemRarity, string> = {
    common:   '#d0d0d0',
    uncommon: '#40c040',
    rare:     '#4080ff',
    epic:     '#d060ff',
  };
  const color = rarityColors[rarity];

  // plan 37 패널 우측에서 슬라이드 인
  NotifySystem.show('loot', `+${amount} ${name}`, {
    iconKey: `icon_${itemId}`,
    textColor: color
  });
}
```

---

## 7. 깊이(Depth) 할당

| 오브젝트 | depth |
|----------|-------|
| 착지 링 | 39 |
| 희귀도 글로우 그래픽 | icon depth - 0.5 |
| 지면 아이템 아이콘 | 40 (plan 47 그대로) |
| 드롭 낙하 중 아이콘 | 40 |
| 착지 파티클 | 41 |
| 드롭 폭발 파티클 | 42 |
| epic idle 파티클 (ADD) | icon depth + 1 |
| 픽업 trail | icon depth - 0.1 |

---

## 8. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/systems/DropSpawnEffect.ts` | 낙하 포물선, 방사형 다중 드롭, 착지 링 |
| `src/systems/RarityGlowEffect.ts` | 희귀도별 글로우, epic 파티클 루프 |
| `src/systems/PickupMagnetEffect.ts` | 당김 tween, trail, 도달 burst |
| `src/systems/GroundItemLifecycle.ts` | 소멸 타이머, 느린·빠른 깜빡임, despawn |
| `src/systems/LootBag.ts` | 자루 통합, 열기 방출 |
| `src/generators/SpriteGenerator.ts` | drawLootBag 추가 |

---

## 9. 버전

`v0.63.0`
