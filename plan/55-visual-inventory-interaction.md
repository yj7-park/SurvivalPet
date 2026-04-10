# Plan 55 — 인벤토리 인터랙션 비주얼 (Visual Inventory Interaction)

## 개요

plan 07(인벤토리 로직)·plan 43(슬롯 외형)·plan 13(제작)·plan 22(내구도)를 바탕으로  
드래그-드롭 애니메이션, 장착 연출, 아이템 비교 팝업, 내구도 크랙 오버레이,  
빠른 슬롯 선택 피드백, 버리기 연출을 설계한다.

---

## 1. 드래그-드롭 비주얼 (`InventoryDragDrop`)

### 1-1. 드래그 중 아이템 고스트

슬롯에서 아이템을 드래그할 때 원본 슬롯은 반투명하게 남기고,  
마우스 커서를 따라다니는 **고스트 아이콘**을 표시한다.

```typescript
class InventoryDragDrop {
  private ghostIcon: Phaser.GameObjects.Image | null = null;
  private originSlotGfx: Phaser.GameObjects.Graphics | null = null;

  startDrag(item: ItemSlot, screenX: number, screenY: number): void {
    // 원본 슬롯 반투명 (alpha 0.35)
    this.originSlotGfx = getSlotGraphics(item.slotIndex);
    this.originSlotGfx?.setAlpha(0.35);

    // 고스트 아이콘: 아이템 아이콘 + scale 1.15 + 약한 드롭 섀도
    this.ghostIcon = scene.add.image(screenX, screenY, `icon_${item.id}`)
      .setScrollFactor(0)
      .setDepth(130)
      .setScale(1.15)
      .setAlpha(0.9);

    // 드롭 섀도 효과 (반투명 검정 복사본 offset +3,+3)
    this.shadowIcon = scene.add.image(screenX + 3, screenY + 3, `icon_${item.id}`)
      .setScrollFactor(0)
      .setDepth(129)
      .setScale(1.15)
      .setAlpha(0.35)
      .setTint(0x000000);

    // 커서 스타일
    document.querySelector('canvas')!.style.cursor = 'grabbing';
  }

  updateDrag(screenX: number, screenY: number): void {
    this.ghostIcon?.setPosition(screenX, screenY);
    this.shadowIcon?.setPosition(screenX + 3, screenY + 3);
  }

  dropOnSlot(targetSlot: number): void {
    if (!this.ghostIcon) return;

    // 목표 슬롯으로 snap tween (0.1s)
    const targetPos = getSlotPosition(targetSlot);
    scene.tweens.add({
      targets: [this.ghostIcon, this.shadowIcon],
      x: targetPos.x, y: targetPos.y,
      duration: 100, ease: 'Quad.easeOut',
      onComplete: () => this.cleanupDrag()
    });

    // 목표 슬롯 잠깐 scale punch (0.9 → 1.0)
    scene.tweens.add({
      targets: getSlotContainer(targetSlot),
      scaleX: [0.9, 1.0], scaleY: [0.9, 1.0],
      duration: 150, ease: 'Back.easeOut'
    });

    // 원본 슬롯 alpha 복구
    this.originSlotGfx?.setAlpha(1.0);
    document.querySelector('canvas')!.style.cursor = 'default';
  }

  dropOnGround(): void {
    if (!this.ghostIcon) return;
    // 바닥에 버리기: 고스트가 아래로 떨어지며 fade
    scene.tweens.add({
      targets: [this.ghostIcon, this.shadowIcon],
      y: this.ghostIcon.y + 20,
      alpha: 0,
      duration: 250,
      onComplete: () => this.cleanupDrag()
    });
    playDropOnGroundEffect();
    this.originSlotGfx?.setAlpha(1.0);
  }

  private cleanupDrag(): void {
    this.ghostIcon?.destroy(); this.ghostIcon = null;
    this.shadowIcon?.destroy(); this.shadowIcon = null;
  }
}
```

### 1-2. 슬롯 호버 강조

```typescript
// plan 43 drawSlot 확장 — hover 시 테두리 pulse
function animateSlotHover(slotContainer: Phaser.GameObjects.Container, entering: boolean): void {
  if (entering) {
    scene.tweens.add({
      targets: slotContainer,
      scaleX: 1.06, scaleY: 1.06,
      duration: 100, ease: 'Quad.easeOut'
    });
  } else {
    scene.tweens.add({
      targets: slotContainer,
      scaleX: 1.0, scaleY: 1.0,
      duration: 80
    });
  }
}
```

---

## 2. 장착 연출 (`EquipEffect`)

### 2-1. 장착 슬롯 이동 애니메이션

인벤토리 슬롯 → 장비 슬롯으로 아이콘이 날아가는 arc 궤적:

```typescript
function playEquipFlyAnimation(
  fromPos: { x: number; y: number },
  toPos:   { x: number; y: number },
  iconKey: string
): void {
  const flying = scene.add.image(fromPos.x, fromPos.y, iconKey)
    .setScrollFactor(0).setDepth(130).setScale(0.8);

  // arc 궤적: onUpdate로 포물선 계산
  const startX = fromPos.x, startY = fromPos.y;
  const endX = toPos.x, endY = toPos.y;
  const peakY = Math.min(startY, endY) - 30;

  scene.tweens.add({
    targets: { t: 0 }, t: 1,
    duration: 300, ease: 'Quad.easeInOut',
    onUpdate: (tween, obj) => {
      const t = obj.t;
      flying.x = startX + (endX - startX) * t;
      flying.y = startY + (endY - startY) * t + (peakY - startY) * 4 * t * (1 - t);
      flying.setScale(0.8 - t * 0.2);
    },
    onComplete: () => {
      flying.destroy();
      // 도착 슬롯 빛남 효과
      flashEquipSlot(toPos);
    }
  });
}

function flashEquipSlot(pos: { x: number; y: number }): void {
  const flash = scene.add.graphics().setScrollFactor(0).setDepth(130);
  flash.fillStyle(0xf0c030, 0.8);
  flash.fillRoundedRect(pos.x - 18, pos.y - 18, 36, 36, 4);
  scene.tweens.add({
    targets: flash, alpha: 0, duration: 300,
    onComplete: () => flash.destroy()
  });
}
```

### 2-2. 장착 시 캐릭터 스프라이트 피드백

```typescript
function onItemEquipped(playerSprite: Phaser.GameObjects.Sprite): void {
  // 짧은 white flash (plan 40 hit flash 재사용)
  playerSprite.setTint(0xffffff);
  scene.time.delayedCall(80, () => playerSprite.clearTint());

  // 장비 장착 파티클 (금색 작은 별 4개)
  const emitter = scene.add.particles(playerSprite.x, playerSprite.y - 16, 'fx_pixel', {
    tint:    [0xf0c030, 0xffee80],
    speed:   { min: 30, max: 60 },
    angle:   { min: -130, max: -50 },
    scale:   { start: 1.0, end: 0 },
    lifespan: 400,
    quantity: 4,
    emitting: false
  });
  emitter.explode(4);
  scene.time.delayedCall(500, () => emitter.destroy());
}
```

---

## 3. 아이템 비교 팝업 (`ItemCompareTooltip`)

마우스를 인벤토리 슬롯에 올렸을 때 현재 장착 아이템과 나란히 비교.

### 3-1. 레이아웃

```
┌────────────── 현재 장착 ──┬── 비교 아이템 ──────────────┐
│ [icon] 나무 칼            │ [icon] 철 칼                │
│ 공격력: 8                 │ 공격력: ▲ 18               │
│ 내구도: 45/60             │ 내구도: 80/80               │
│ 희귀도: ■ 일반            │ 희귀도: ■ 희귀              │
└───────────────────────────┴─────────────────────────────┘
```

- 상승 스탯: 초록 `▲`, 하락 스탯: 빨강 `▼`
- 총 너비: 320px (160px × 2열), 툴팁처럼 마우스 옆에 표시
- 같은 부위 아이템이 없으면 단순 툴팁만 표시

```typescript
class ItemCompareTooltip {
  private panel: Phaser.GameObjects.Container;

  show(
    hoverItem: ItemData,
    equippedItem: ItemData | null,
    screenX: number, screenY: number
  ): void {
    if (!equippedItem || equippedItem.slot !== hoverItem.slot) {
      // 단순 툴팁 (plan 43 showTooltip)
      UIRenderer.showTooltip(hoverItem, screenX, screenY);
      return;
    }

    // 비교 패널 생성
    this.buildComparePanel(hoverItem, equippedItem);
    this.positionPanel(screenX, screenY);
    this.panel.setAlpha(0).setVisible(true);
    scene.tweens.add({ targets: this.panel, alpha: 1, duration: 150 });
  }

  private buildComparePanel(next: ItemData, curr: ItemData): void {
    const PW = 320, PH = 120;
    // 분할선
    const gfx = scene.make.graphics({ add: false });
    gfx.fillStyle(0x0c0906, 0.95);
    gfx.fillRoundedRect(0, 0, PW, PH, 4);
    gfx.lineStyle(1, 0x5a4428, 1);
    gfx.strokeRoundedRect(0, 0, PW, PH, 4);
    gfx.lineStyle(1, 0x5a4428, 0.5);
    gfx.lineBetween(PW/2, 8, PW/2, PH - 8);

    // 각 패널 항목 렌더링
    const statKeys: (keyof ItemStats)[] = ['attack', 'defense', 'durability'];
    statKeys.forEach((key, i) => {
      const cy = this.renderStatRow(key, curr.stats[key], next.stats[key], i);
    });
  }

  private renderStatRow(
    label: string,
    currVal: number, nextVal: number,
    rowIdx: number
  ): void {
    const y = 40 + rowIdx * 18;
    const diff = nextVal - currVal;
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '=';
    const color = diff > 0 ? '#40e060' : diff < 0 ? '#e04040' : '#aaaaaa';

    // 현재 값 (왼쪽)
    scene.add.text(20, y, `${label}: ${currVal}`, {
      fontSize: '10px', fontFamily: 'Courier New', color: '#ccccaa'
    });
    // 비교 값 (오른쪽)
    scene.add.text(170, y, `${arrow} ${nextVal}`, {
      fontSize: '10px', fontFamily: 'Courier New', color
    });
  }
}
```

---

## 4. 내구도 크랙 오버레이 (`DurabilityCrackOverlay`)

plan 22(내구도 시스템) — 장비·도구 아이콘 위에 내구도 수준별 크랙 표시.

### 4-1. 크랙 수준 스프라이트

```typescript
// 아이콘 위 16×16px 오버레이 (3단계)
// crack_1: 모서리 균열 1개 (75%~50% 내구도)
// crack_2: 대각선 균열 2개 (50%~25%)
// crack_3: 전면 균열 + 붉은 tint (25%~0%)

function drawCrackOverlay(
  ctx: CanvasRenderingContext2D,
  level: 1 | 2 | 3
): void {
  ctx.strokeStyle = level === 3 ? 'rgba(200,50,10,0.9)' : 'rgba(180,140,80,0.8)';
  ctx.lineWidth = 1;

  if (level >= 1) {
    // 균열 1: 오른쪽 상단 → 중앙
    ctx.beginPath(); ctx.moveTo(12, 1); ctx.lineTo(8, 7);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 7);  ctx.lineTo(10, 9); ctx.stroke();
  }
  if (level >= 2) {
    // 균열 2: 왼쪽 중앙 → 하단
    ctx.beginPath(); ctx.moveTo(3, 8);  ctx.lineTo(7, 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, 12); ctx.lineTo(5, 15); ctx.stroke();
  }
  if (level >= 3) {
    // 균열 3: 대각 교차선 + 붉은 오버레이
    ctx.strokeStyle = 'rgba(200,50,10,0.7)';
    ctx.beginPath(); ctx.moveTo(1, 1);  ctx.lineTo(15, 15); ctx.stroke();
    ctx.fillStyle = 'rgba(200,0,0,0.15)';
    ctx.fillRect(0, 0, 16, 16);
  }
}
```

### 4-2. 내구도 게이지 (슬롯 하단 바)

```typescript
// plan 43 drawSlot 확장: 내구도 있는 아이템에 슬롯 하단 1px 컬러 바 추가
function drawDurabilityBar(
  ctx: CanvasRenderingContext2D,
  durability: number, maxDurability: number,
  slotX: number, slotY: number, slotW: number
): void {
  const ratio = durability / maxDurability;
  const color = ratio > 0.5 ? '#40c040'
              : ratio > 0.25 ? '#e0a020'
              : '#e03020';

  // 슬롯 하단 3px 바 (배경 + 채움)
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(slotX + 1, slotY + 33, slotW - 2, 2);
  ctx.fillStyle = color;
  ctx.fillRect(slotX + 1, slotY + 33, (slotW - 2) * ratio, 2);

  // 25% 이하: 빨간 blink (plan 43 danger blink 동일 방식)
  if (ratio <= 0.25 && !getSlotBlinkTween(slotX, slotY)) {
    startDurabilityBlinkTween(slotX, slotY);
  }
}
```

---

## 5. 빠른 슬롯 선택 비주얼 (`QuickSlotSelector`)

plan 07 숫자키 1~8 빠른 슬롯 전환 → 선택 피드백 강화.

```typescript
class QuickSlotSelector {
  private selectorGfx: Phaser.GameObjects.Graphics;
  private currentIndex = 0;

  selectSlot(index: number): void {
    const prev = this.currentIndex;
    this.currentIndex = index;

    // 이전 슬롯: 선택 해제 scale (1.0 → 0.95 → 1.0, 0.1s)
    scene.tweens.add({
      targets: getQuickSlotContainer(prev),
      scaleX: [1.0, 0.95, 1.0], scaleY: [1.0, 0.95, 1.0],
      duration: 100
    });

    // 새 슬롯: 강조 scale (1.0 → 1.12 → 1.0, 0.15s Back.easeOut)
    scene.tweens.add({
      targets: getQuickSlotContainer(index),
      scaleX: [1.0, 1.12, 1.0], scaleY: [1.0, 1.12, 1.0],
      duration: 150, ease: 'Back.easeOut'
    });

    // 이동하는 선택 표시자 (황금 테두리 슬라이드)
    const targetPos = getQuickSlotPosition(index);
    scene.tweens.add({
      targets: this.selectorGfx,
      x: targetPos.x - 1, y: targetPos.y - 1,
      duration: 120, ease: 'Quad.easeOut'
    });

    // 슬롯 위 아이템 이름 잠깐 표시 (1.5s)
    showQuickSlotItemLabel(index);
  }
}

function showQuickSlotItemLabel(slotIndex: number): void {
  const item = getQuickSlotItem(slotIndex);
  if (!item) return;

  const slotPos = getQuickSlotPosition(slotIndex);
  const lbl = scene.add.text(slotPos.x + 18, slotPos.y - 18,
    getItemName(item.id), {
      fontSize: '9px', fontFamily: 'Courier New',
      color: '#ffffff', stroke: '#000000', strokeThickness: 2
    }
  ).setScrollFactor(0).setDepth(98).setOrigin(0.5).setAlpha(0);

  scene.tweens.add({
    targets: lbl,
    alpha: { from: 0, to: 1 }, y: lbl.y - 4,
    duration: 150,
    onComplete: () => {
      scene.time.delayedCall(1200, () => {
        scene.tweens.add({
          targets: lbl, alpha: 0, duration: 300,
          onComplete: () => lbl.destroy()
        });
      });
    }
  });
}
```

---

## 6. 아이템 버리기 연출 (`DropItemEffect`)

```typescript
function playDropItemEffect(
  slotScreenPos: { x: number; y: number },
  itemIconKey: string
): void {
  const icon = scene.add.image(slotScreenPos.x, slotScreenPos.y, itemIconKey)
    .setScrollFactor(0).setDepth(130).setScale(1.0);

  // 아래로 떨어지며 회전 + fade
  scene.tweens.add({
    targets: icon,
    y: slotScreenPos.y + 50,
    angle: Phaser.Math.Between(-30, 30),
    alpha: 0,
    duration: 400,
    ease: 'Quad.easeIn',
    onComplete: () => icon.destroy()
  });

  // "버림" 텍스트 팝업 (회색)
  const txt = scene.add.text(slotScreenPos.x, slotScreenPos.y - 12, '버림', {
    fontSize: '9px', fontFamily: 'Courier New',
    color: '#888880', stroke: '#000000', strokeThickness: 1
  }).setScrollFactor(0).setDepth(131).setOrigin(0.5);

  scene.tweens.add({
    targets: txt, y: txt.y - 20, alpha: { from: 1, to: 0 },
    duration: 600, onComplete: () => txt.destroy()
  });
}
```

---

## 7. 인벤토리 열기/닫기 애니메이션

```typescript
class InventoryPanel {
  // 열기: 중앙 기준 scaleY 0 → 1 (0.2s, Back.easeOut) + fade
  open(): void {
    this.container
      .setVisible(true)
      .setAlpha(0)
      .setScale(1, 0.1);
    scene.tweens.add({
      targets: this.container,
      alpha: 1, scaleY: 1,
      duration: 200, ease: 'Back.easeOut'
    });
  }

  // 닫기: scaleY 1 → 0 (0.15s) + fade
  close(): void {
    scene.tweens.add({
      targets: this.container,
      alpha: 0, scaleY: 0.1,
      duration: 150,
      onComplete: () => this.container.setVisible(false)
    });
  }
}
```

---

## 8. 깊이(Depth) 할당

| 오브젝트 | depth | ScrollFactor |
|----------|-------|--------------|
| 인벤토리 패널 배경 | 80 | 0 |
| 인벤토리 슬롯 | 81 | 0 |
| 드래그 섀도 아이콘 | 129 | 0 |
| 드래그 고스트 아이콘 | 130 | 0 |
| 아이템 비교 툴팁 | 115 | 0 |
| 빠른 슬롯 선택 표시자 | 84 | 0 |
| 빠른 슬롯 아이템 이름 | 98 | 0 |
| 버리기 아이콘 애니 | 130 | 0 |

---

## 9. 구현 파일 위치

| 파일 | 내용 |
|------|------|
| `src/ui/InventoryDragDrop.ts` | 고스트 드래그, 섀도, snap tween |
| `src/ui/ItemCompareTooltip.ts` | 비교 팝업 2열 레이아웃 |
| `src/ui/DurabilityCrackOverlay.ts` | 크랙 스프라이트, 내구도 바 |
| `src/ui/QuickSlotSelector.ts` | 선택 이동 표시자, 이름 팝업 |
| `src/ui/InventoryPanel.ts` | 열기/닫기 scale tween |
| `src/systems/EquipEffect.ts` | 장착 arc 애니, 캐릭터 flash |

---

## 10. 버전

`v0.55.0`
