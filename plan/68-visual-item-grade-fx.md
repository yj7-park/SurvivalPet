# Plan 68 — 아이템 등급 비주얼 이펙트 통합

## 개요

plan 65(아이템 등급 시스템)에서 정의한 5단계 등급(normal·uncommon·rare·epic·legendary)을  
화면에서 시각적으로 구분할 수 있도록 인벤토리·장착·드롭·HUD 전반에 걸쳐 비주얼을 적용한다.  
등급이 높을수록 더욱 화려한 이펙트로 플레이어에게 희귀도를 직관적으로 전달한다.

---

## 1. 등급 색상 팔레트

```typescript
export const GRADE_COLORS = {
  normal:    { frame: 0x999999, glow: 0x888888, text: '#aaaaaa', particle: 0xaaaaaa },
  uncommon:  { frame: 0x2ecc71, glow: 0x27ae60, text: '#2ecc71', particle: 0x55ff88 },
  rare:      { frame: 0x3498db, glow: 0x2980b9, text: '#5dade2', particle: 0x66aaff },
  epic:      { frame: 0x9b59b6, glow: 0x8e44ad, text: '#bb8fce', particle: 0xcc88ff },
  legendary: { frame: 0xf39c12, glow: 0xe67e22, text: '#f8c471', particle: 0xffd966 },
} as const;

export type ItemGrade = keyof typeof GRADE_COLORS;
```

---

## 2. 인벤토리 슬롯 등급 비주얼

### 2-1. 슬롯 테두리 & 배경

```typescript
function drawGradedSlot(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  item: ItemData
): void {
  const col = GRADE_COLORS[item.grade];

  // 1. 배경 (normal은 기본, uncommon 이상 반투명 색상 배경)
  if (item.grade !== 'normal') {
    ctx.fillStyle = col.frame + '22';   // 13% alpha hex
    roundRect(ctx, sx + 1, sy + 1, 46, 46, 4);
    ctx.fill();
  }

  // 2. 테두리 — 등급 색상
  ctx.strokeStyle = `#${col.frame.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = item.grade === 'legendary' ? 2.5 : item.grade === 'epic' ? 2 : 1.5;
  roundRect(ctx, sx + 0.5, sy + 0.5, 47, 47, 4);
  ctx.stroke();

  // 3. legendary: 코너 장식 (4개 꼭짓점 삼각형)
  if (item.grade === 'legendary') {
    drawLegendaryCorners(ctx, sx, sy, 48, 48, col.frame);
  }
}

function drawLegendaryCorners(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  color: number
): void {
  const hex = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = hex;
  const sz = 6;
  // 좌상
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sz, y); ctx.lineTo(x, y + sz); ctx.closePath(); ctx.fill();
  // 우상
  ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w - sz, y); ctx.lineTo(x + w, y + sz); ctx.closePath(); ctx.fill();
  // 좌하
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + sz, y + h); ctx.lineTo(x, y + h - sz); ctx.closePath(); ctx.fill();
  // 우하
  ctx.beginPath(); ctx.moveTo(x + w, y + h); ctx.lineTo(x + w - sz, y + h); ctx.lineTo(x + w, y + h - sz); ctx.closePath(); ctx.fill();
}
```

### 2-2. 아이템 아이콘 위 등급 뱃지

```typescript
// 슬롯 우상단 — grade 약자 뱃지 (uncommon 이상만)
function drawGradeBadge(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  grade: ItemGrade
): void {
  if (grade === 'normal') return;

  const LABELS = { uncommon: 'U', rare: 'R', epic: 'E', legendary: 'L' };
  const col = GRADE_COLORS[grade];
  const bx = sx + 35, by = sy + 2;

  ctx.fillStyle = `#${col.frame.toString(16).padStart(6, '0')}`;
  roundRect(ctx, bx, by, 11, 11, 2); ctx.fill();
  ctx.fillStyle = '#0a0a0a';
  ctx.font = 'bold 8px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(LABELS[grade], bx + 5.5, by + 8);
}
```

---

## 3. 장착 시 캐릭터 비주얼

### 3-1. 등급 후광 (Aura)

```typescript
class EquippedGradeAura {
  private auraGfx: Phaser.GameObjects.Graphics;
  private tweens: Phaser.Tweens.Tween[] = [];
  private phase = 0;

  attach(scene: Phaser.Scene, player: PlayerEntity, grade: ItemGrade): void {
    this.detach();
    if (grade === 'normal' || grade === 'uncommon') return;

    const col = GRADE_COLORS[grade];
    this.auraGfx = scene.add.graphics();
    this.auraGfx.setDepth(player.depth - 1);   // 캐릭터 뒤

    // rare: 단순 원형 반짝임
    // epic: 회전 링
    // legendary: 황금 불꽃 + 회전 링
    scene.events.on('update', this.updateAura, this);
  }

  private updateAura(time: number, _delta: number): void {
    this.phase = (time % 3000) / 3000;   // 0~1 순환
    const col = GRADE_COLORS[this.currentGrade];

    this.auraGfx.clear();

    if (this.currentGrade === 'rare') {
      // 부드럽게 맥동하는 파란 원
      const r = 18 + Math.sin(this.phase * Math.PI * 2) * 3;
      const alpha = 0.12 + Math.sin(this.phase * Math.PI * 2) * 0.06;
      this.auraGfx.fillStyle(col.glow, alpha);
      this.auraGfx.fillCircle(0, 0, r);
    }

    if (this.currentGrade === 'epic') {
      // 회전 타원 링 2개
      const angle = this.phase * Math.PI * 2;
      this.auraGfx.lineStyle(1.5, col.glow, 0.4);
      drawRotatedEllipse(this.auraGfx, 0, 0, 22, 10, angle);
      drawRotatedEllipse(this.auraGfx, 0, 0, 22, 10, angle + Math.PI / 2);
    }

    if (this.currentGrade === 'legendary') {
      // 황금 회전 타원 + 8개 불꽃 점
      const angle = this.phase * Math.PI * 2;
      this.auraGfx.lineStyle(2, col.glow, 0.55);
      drawRotatedEllipse(this.auraGfx, 0, 0, 24, 10, angle);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + angle;
        const px = Math.cos(a) * 22;
        const py = Math.sin(a) * 10;
        const fs = 2 + Math.sin(this.phase * Math.PI * 2 + i) * 1;
        this.auraGfx.fillStyle(col.frame, 0.7);
        this.auraGfx.fillCircle(px, py, fs);
      }
    }
  }

  detach(): void {
    this.tweens.forEach(t => t.stop());
    this.tweens = [];
    if (this.auraGfx) {
      this.auraGfx.scene.events.off('update', this.updateAura, this);
      this.auraGfx.destroy();
    }
  }

  private currentGrade: ItemGrade = 'normal';
}

function drawRotatedEllipse(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  angle: number,
  steps = 32
): void {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    const rx2 = x * Math.cos(angle) - y * Math.sin(angle) + cx;
    const ry2 = x * Math.sin(angle) + y * Math.cos(angle) + cy;
    pts.push([rx2, ry2]);
  }
  gfx.strokePoints(pts.map(([px, py]) => ({ x: px, y: py })), true);
}
```

### 3-2. 레전더리 장착 이펙트

```typescript
function playLegendaryEquipEffect(
  scene: Phaser.Scene,
  player: PlayerEntity
): void {
  // 1. 황금 빛기둥 (세로 줄기)
  const beam = scene.add.graphics();
  beam.setDepth(player.depth + 5);
  beam.fillStyle(0xffd966, 0.0);
  beam.fillRect(-4, -80, 8, 80);

  scene.tweens.add({
    targets: { alpha: 0 },
    alpha: 0.7,
    duration: 150,
    yoyo: true,
    repeat: 2,
    onUpdate: (t) => {
      beam.clear();
      beam.fillStyle(0xffd966, t.getValue());
      beam.fillRect(player.worldX - 4, player.worldY - 80, 8, 80);
    },
    onComplete: () => beam.destroy(),
  });

  // 2. 방사형 황금 파티클 버스트
  const emitter = scene.add.particles(player.worldX, player.worldY, '__DEFAULT', {
    speed: { min: 60, max: 140 },
    scale: { start: 0.8, end: 0 },
    lifespan: 600,
    quantity: 18,
    tint: 0xffd966,
    blendMode: Phaser.BlendModes.ADD,
  });
  emitter.explode(18);
  scene.time.delayedCall(800, () => emitter.destroy());

  // 3. 화면 황금 플래시
  const flash = scene.add.rectangle(
    scene.cameras.main.scrollX + scene.cameras.main.width / 2,
    scene.cameras.main.scrollY + scene.cameras.main.height / 2,
    scene.cameras.main.width,
    scene.cameras.main.height,
    0xffd966, 0.3
  ).setScrollFactor(0).setDepth(190);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 400,
    onComplete: () => flash.destroy(),
  });
}
```

---

## 4. 드롭 시 등급별 지면 이펙트

plan 63(loot drop)의 `createRarityGlow()`를 등급 색상으로 확장:

```typescript
function attachGroundGradeEffect(
  scene: Phaser.Scene,
  itemSprite: Phaser.GameObjects.Sprite,
  grade: ItemGrade
): void {
  if (grade === 'normal') return;

  const col = GRADE_COLORS[grade];

  // 지면 그림자 원 (등급 색상)
  const shadow = scene.add.graphics().setDepth(itemSprite.depth - 1);
  shadow.fillStyle(col.glow, 0.25);
  shadow.fillEllipse(0, 0, 28, 10);

  // epic 이상: 파티클 루프
  if (grade === 'epic' || grade === 'legendary') {
    const emitter = scene.add.particles(0, 0, '__DEFAULT', {
      follow: itemSprite,
      speed: { min: 10, max: 25 },
      scale: { start: 0.5, end: 0 },
      lifespan: 800,
      frequency: grade === 'legendary' ? 80 : 160,
      tint: col.particle,
      blendMode: Phaser.BlendModes.ADD,
      quantity: 1,
    });
    (itemSprite as any).__gradeEmitter = emitter;
  }

  // legendary: 추가 회전 별 파티클
  if (grade === 'legendary') {
    scene.time.addEvent({
      delay: 1200,
      loop: true,
      callback: () => {
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = 10 + Math.random() * 8;
          spawnStarParticle(
            scene,
            itemSprite.x + Math.cos(angle) * r,
            itemSprite.y + Math.sin(angle) * r,
            0xffd966
          );
        }
      },
    });
  }
}

function spawnStarParticle(
  scene: Phaser.Scene,
  x: number, y: number,
  color: number
): void {
  const gfx = scene.add.graphics().setDepth(55);
  gfx.fillStyle(color, 1);
  // 4-point star
  const s = 3;
  gfx.fillRect(x - s / 2, y - s * 1.5, s, s * 3);
  gfx.fillRect(x - s * 1.5, y - s / 2, s * 3, s);
  scene.tweens.add({
    targets: gfx,
    alpha: 0,
    y: y - 12,
    duration: 700,
    onComplete: () => gfx.destroy(),
  });
}
```

---

## 5. 툴팁 등급 비주얼 (plan 65 확장)

```typescript
function drawGradedTooltip(
  ctx: CanvasRenderingContext2D,
  item: ItemData,
  x: number, y: number
): void {
  const col = GRADE_COLORS[item.grade];
  const W = 200, H = estimateTooltipHeight(item);

  // 배경
  ctx.fillStyle = '#151515';
  roundRect(ctx, x, y, W, H, 6); ctx.fill();

  // 왼쪽 등급 색상 바
  ctx.fillStyle = `#${col.frame.toString(16).padStart(6, '0')}`;
  roundRect(ctx, x, y, 4, H, 6); ctx.fill();

  // 외곽선
  ctx.strokeStyle = `#${col.frame.toString(16).padStart(6, '0')}88`;
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, W - 1, H - 1, 6); ctx.stroke();

  // 아이템 이름 (등급 색상)
  ctx.fillStyle = col.text;
  ctx.font = 'bold 13px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(item.name, x + 12, y + 18);

  // 등급 레이블
  const GRADE_LABELS: Record<ItemGrade, string> = {
    normal: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설',
  };
  ctx.fillStyle = col.text + 'bb';
  ctx.font = '10px Courier New';
  ctx.fillText(`[${GRADE_LABELS[item.grade]}]`, x + 12, y + 32);

  // 구분선
  ctx.strokeStyle = `#${col.frame.toString(16).padStart(6, '0')}44`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 12, y + 38); ctx.lineTo(x + W - 12, y + 38); ctx.stroke();

  // 능력치 줄
  let lineY = y + 52;
  for (const stat of item.stats ?? []) {
    ctx.fillStyle = '#dddddd';
    ctx.font = '11px Courier New';
    ctx.fillText(`${stat.label}: +${stat.value}`, x + 12, lineY);
    lineY += 16;
  }

  // 특수 효과
  if (item.specialEffect) {
    lineY += 4;
    ctx.fillStyle = col.text;
    ctx.font = 'italic 10px Courier New';
    ctx.fillText(`★ ${item.specialEffect.desc}`, x + 12, lineY);
  }
}
```

---

## 6. 강화 & 승급 이펙트

등급이 올라갈 때(아이템 강화로 승급 시) 특별 연출:

```typescript
function playGradeUpEffect(
  scene: Phaser.Scene,
  itemIcon: Phaser.GameObjects.Image,
  fromGrade: ItemGrade,
  toGrade: ItemGrade
): void {
  const col = GRADE_COLORS[toGrade];

  // 1. 아이콘 스케일 펀치
  scene.tweens.add({
    targets: itemIcon,
    scaleX: 1.6, scaleY: 1.6,
    duration: 120,
    ease: 'Back.easeOut',
    yoyo: true,
  });

  // 2. 등급 색 링 펼침 (2개 동심원)
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.graphics().setDepth(itemIcon.depth + 2);
    ring.lineStyle(2, col.frame, 0.8);
    ring.strokeCircle(itemIcon.x, itemIcon.y, 6);

    scene.tweens.add({
      targets: { r: 6, alpha: 0.8 },
      r: 32 + i * 12,
      alpha: 0,
      delay: i * 80,
      duration: 380,
      onUpdate: (t) => {
        ring.clear();
        ring.lineStyle(2, col.frame, t.getValue());
        ring.strokeCircle(itemIcon.x, itemIcon.y, (t.targets[0] as any).r);
      },
      onComplete: () => ring.destroy(),
    });
  }

  // 3. 파티클 버스트
  const emitter = scene.add.particles(itemIcon.x, itemIcon.y, '__DEFAULT', {
    speed: { min: 40, max: 100 },
    scale: { start: 0.7, end: 0 },
    lifespan: 500,
    quantity: 12,
    tint: col.particle,
    blendMode: Phaser.BlendModes.ADD,
  });
  emitter.explode(12);
  scene.time.delayedCall(600, () => emitter.destroy());

  // 4. 텍스트 팝업
  const label = { normal: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설' };
  const txt = scene.add.text(itemIcon.x, itemIcon.y - 20,
    `${label[toGrade]} 승급!`,
    { fontSize: '12px', color: col.text, fontFamily: 'Courier New', fontStyle: 'bold' }
  ).setOrigin(0.5).setDepth(itemIcon.depth + 5);

  scene.tweens.add({
    targets: txt,
    y: itemIcon.y - 44,
    alpha: 0,
    duration: 900,
    ease: 'Quad.easeOut',
    onComplete: () => txt.destroy(),
  });
}
```

---

## 7. HUD — 장착 아이템 등급 표시

```typescript
// plan 43 HUD 퀵슬롯에 등급 테두리 적용
function drawQuickSlotWithGrade(
  ctx: CanvasRenderingContext2D,
  slot: QuickSlot,
  index: number
): void {
  const SX = QUICKSLOT_START_X + index * 52;
  const SY = CANVAS_H - 54;

  // 기존 슬롯 배경
  drawDefaultSlotBg(ctx, SX, SY);

  if (slot.item) {
    drawGradedSlot(ctx, SX, SY, slot.item);
    drawItemIcon(ctx, slot.item, SX + 2, SY + 2, 44);
    drawGradeBadge(ctx, SX, SY, slot.item.grade);
  }
}
```

---

## 8. 깊이(Depth) 테이블

| 요소 | Depth | 비고 |
|------|-------|------|
| 지면 아이템 등급 그림자 | 14 | 아이템 스프라이트(15) 바로 뒤 |
| 등급 아이템 파티클 | 55 | plan 63 파티클과 동일 레이어 |
| 캐릭터 Aura 그래픽 | 캐릭터-1 | 보통 34 |
| 장착 이펙트 기둥 | 캐릭터+5 | 40 |
| 장착 이펙트 파티클 | 55 | |
| 승급 이펙트 링 | 인벤토리 내 | scrollFactor 0 |
| 전설 장착 화면 플래시 | 190 | HUD 아래 |

---

## 9. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/ui/ItemGradeRenderer.ts` | 슬롯 테두리·뱃지·툴팁 렌더링 |
| `src/fx/EquippedGradeAura.ts` | 장착 아우라 UPDATE 루프 |
| `src/fx/GradeEffects.ts` | 장착 이펙트·승급 이펙트·드롭 이펙트 |
| `src/ui/HUDRenderer.ts` | 퀵슬롯 등급 테두리 적용 |

---

## 10. 버전

`v0.68.0`
