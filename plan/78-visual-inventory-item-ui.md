# Plan 78 — 인벤토리·아이템 UI 비주얼

## 목표
인벤토리 슬롯·아이템 아이콘·툴팁·장착 효과·아이템 드롭 글로우 등
아이템 관련 모든 시각 요소를 통일되고 세련되게 구현한다.

## 버전
`v0.78.0`

## 대상 파일
- `src/ui/InventoryRenderer.ts` (신규)
- `src/ui/ItemTooltip.ts` (신규)
- `src/rendering/ItemDropGlow.ts` (신규)

---

## 1. 인벤토리 슬롯 비주얼

```typescript
// src/ui/InventoryRenderer.ts

const SLOT = {
  SIZE: 44,
  GAP:   4,
  COLS:  8,
  BG:    0x1a1a2e,
  BORDER:0x445566,
  HOVER: 0x6688aa,
  SEL:   0x88aacc,
  EMPTY_ALPHA: 0.6,
} as const;

/** 빈 슬롯 드로우 (Graphics) */
export function drawEmptySlot(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  state: 'normal' | 'hover' | 'selected' = 'normal',
): void {
  const border = state === 'hover'    ? SLOT.HOVER
               : state === 'selected' ? SLOT.SEL
               : SLOT.BORDER;
  const bgAlpha = state === 'selected' ? 0.85 : SLOT.EMPTY_ALPHA;

  gfx.fillStyle(SLOT.BG, bgAlpha)
     .fillRoundedRect(x, y, SLOT.SIZE, SLOT.SIZE, 5);
  gfx.lineStyle(state === 'normal' ? 1 : 1.5, border, 1)
     .strokeRoundedRect(x, y, SLOT.SIZE, SLOT.SIZE, 5);

  // 빈 슬롯 내부 점선 패턴 (미세 십자)
  if (state === 'normal') {
    const cx = x + SLOT.SIZE / 2, cy = y + SLOT.SIZE / 2;
    gfx.lineStyle(1, SLOT.BORDER, 0.25)
       .strokeLineShape(new Phaser.Geom.Line(cx - 6, cy, cx + 6, cy))
       .strokeLineShape(new Phaser.Geom.Line(cx, cy - 6, cx, cy + 6));
  }
}

/** 아이템 슬롯 배경 (등급 색 테두리 포함) */
export function drawItemSlot(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  gradeColor: number,
  selected: boolean,
): void {
  gfx.fillStyle(SLOT.BG, 0.9)
     .fillRoundedRect(x, y, SLOT.SIZE, SLOT.SIZE, 5);

  // 등급 테두리 (2px 내부 glow 효과 근사: 두 겹 선)
  gfx.lineStyle(2, gradeColor, selected ? 1 : 0.7)
     .strokeRoundedRect(x, y, SLOT.SIZE, SLOT.SIZE, 5);
  gfx.lineStyle(1, gradeColor, selected ? 0.4 : 0.2)
     .strokeRoundedRect(x + 2, y + 2, SLOT.SIZE - 4, SLOT.SIZE - 4, 3);
}
```

---

## 2. 아이템 아이콘 픽셀아트 생성기

```typescript
// src/ui/InventoryRenderer.ts (계속)

export type ItemCategory =
  | 'weapon_sword' | 'weapon_axe' | 'weapon_bow' | 'weapon_staff'
  | 'armor_helmet' | 'armor_chest' | 'armor_boots'
  | 'consumable_potion' | 'consumable_food'
  | 'material_wood' | 'material_stone' | 'material_ore'
  | 'tool_pickaxe' | 'tool_axe' | 'misc_coin';

const ICON_PALETTES: Record<ItemCategory, number[]> = {
  weapon_sword:    [0x8899bb, 0xaabbdd, 0x555566, 0xccddee],
  weapon_axe:      [0x997755, 0xbbaa88, 0x666644, 0xddccaa],
  weapon_bow:      [0x886644, 0xaa8855, 0x443322, 0xccaa77],
  weapon_staff:    [0x8844cc, 0xaa66ee, 0x442266, 0xcc88ff],
  armor_helmet:    [0x778899, 0x99aabb, 0x445566, 0xbbccdd],
  armor_chest:     [0x667788, 0x889999, 0x334455, 0xaabbcc],
  armor_boots:     [0x775544, 0x997766, 0x443322, 0xbbaa88],
  consumable_potion:[0xff4466, 0xff88aa, 0x882233, 0xffaabb],
  consumable_food: [0xdd8844, 0xffaa66, 0x885522, 0xffcc99],
  material_wood:   [0x886633, 0xaa8855, 0x553311, 0xccaa77],
  material_stone:  [0x888899, 0xaaaacc, 0x556677, 0xccccdd],
  material_ore:    [0xbbaa44, 0xddcc66, 0x887722, 0xffeebb],
  tool_pickaxe:    [0xaaaaaa, 0xcccccc, 0x666666, 0x886633],
  tool_axe:        [0x997755, 0xbbaa88, 0x666633, 0x886644],
  misc_coin:       [0xffcc22, 0xffee66, 0xaa8811, 0xffeebb],
};

/** RenderTexture에 픽셀 아이콘 생성 */
export function generateItemIcon(
  scene: Phaser.Scene,
  category: ItemCategory,
  size = 32,
): Phaser.GameObjects.RenderTexture {
  const rt = scene.add.renderTexture(0, 0, size, size).setVisible(false);
  const gfx = scene.add.graphics().setVisible(false);
  const pal = ICON_PALETTES[category];
  const P = size / 8;  // 픽셀 크기

  // 카테고리별 픽셀 배열 (8×8 컬러 인덱스)
  const maps: Record<ItemCategory, number[][]> = {
    weapon_sword: [
      [0,0,0,0,0,0,1,0],
      [0,0,0,0,0,1,2,0],
      [0,0,0,0,1,2,0,0],
      [0,0,0,1,2,0,0,0],
      [0,3,1,2,0,0,0,0],
      [3,1,2,0,0,0,0,0],
      [0,3,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0],
    ],
    consumable_potion: [
      [0,0,0,1,1,0,0,0],
      [0,0,1,3,3,1,0,0],
      [0,1,3,2,2,3,1,0],
      [0,1,2,2,2,2,1,0],
      [1,2,2,2,2,2,2,1],
      [1,2,2,2,2,2,2,1],
      [0,1,2,2,2,2,1,0],
      [0,0,1,1,1,1,0,0],
    ],
    material_wood: [
      [0,0,3,3,0,0,0,0],
      [0,3,1,1,3,0,0,0],
      [0,1,1,1,1,3,0,0],
      [0,1,2,1,1,1,3,0],
      [0,3,1,1,2,1,1,0],
      [0,0,3,1,1,1,1,0],
      [0,0,0,3,1,1,3,0],
      [0,0,0,0,3,3,0,0],
    ],
    misc_coin: [
      [0,0,1,1,1,1,0,0],
      [0,1,2,2,2,2,1,0],
      [1,2,3,2,2,3,2,1],
      [1,2,2,1,1,2,2,1],
      [1,2,2,1,1,2,2,1],
      [1,2,3,2,2,3,2,1],
      [0,1,2,2,2,2,1,0],
      [0,0,1,1,1,1,0,0],
    ],
    // 나머지 카테고리는 팔레트 기반 기본 도형으로 fallback
    weapon_axe:     [], weapon_bow: [], weapon_staff: [],
    armor_helmet:   [], armor_chest: [], armor_boots: [],
    consumable_food:[], material_stone: [], material_ore: [],
    tool_pickaxe:   [], tool_axe: [],
  };

  const pixelMap = maps[category];
  if (pixelMap && pixelMap.length > 0) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const idx = pixelMap[row]?.[col] ?? 0;
        if (idx > 0 && pal[idx - 1]) {
          gfx.clear().fillStyle(pal[idx - 1], 1)
             .fillRect(col * P, row * P, P, P);
          rt.draw(gfx, 0, 0);
        }
      }
    }
  } else {
    // fallback: 단색 원형 아이콘
    gfx.clear().fillStyle(pal[0], 0.9).fillCircle(size / 2, size / 2, size / 2 - 2);
    rt.draw(gfx, 0, 0);
  }

  gfx.destroy();
  return rt;
}
```

---

## 3. 아이템 툴팁

```typescript
// src/ui/ItemTooltip.ts

export interface TooltipData {
  name: string;
  grade: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  category: string;
  description: string;
  stats?: string[];      // ['ATK +15', 'SPD +3']
  durability?: number;   // 0~100
  weight?: number;
  value?: number;        // 골드 가치
}

const GRADE_COLORS: Record<TooltipData['grade'], number> = {
  common:    0xaaaaaa,
  uncommon:  0x44ff88,
  rare:      0x4488ff,
  epic:      0xaa44ff,
  legendary: 0xff8800,
};

export class ItemTooltip {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // 초기 빈 컨테이너
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0).setAlpha(0);
  }

  show(data: TooltipData, screenX: number, screenY: number): void {
    this._rebuild(data);
    const { width: W, height: H } = this.scene.scale;

    // 화면 밖 넘침 방지
    let tx = screenX + 12;
    let ty = screenY - 10;
    const tooltipW = 200, tooltipH = this._estimateHeight(data);
    if (tx + tooltipW > W) tx = screenX - tooltipW - 12;
    if (ty + tooltipH > H) ty = H - tooltipH - 8;
    ty = Math.max(8, ty);

    this.container.setPosition(tx, ty).setAlpha(0);
    this.visible = true;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 120,
      ease: 'Linear',
    });
  }

  private _estimateHeight(data: TooltipData): number {
    return 60 + (data.stats?.length ?? 0) * 16
              + (data.durability !== undefined ? 20 : 0)
              + (data.description ? 30 : 0);
  }

  private _rebuild(data: TooltipData): void {
    this.container.removeAll(true);

    const gradeColor = GRADE_COLORS[data.grade];
    const W = 200;
    let curY = 0;

    // 배경
    const estimH = this._estimateHeight(data);
    const bg = this.scene.add.graphics()
      .fillStyle(0x111122, 0.95)
      .fillRoundedRect(0, 0, W, estimH, 6)
      .lineStyle(1.5, gradeColor, 0.9)
      .strokeRoundedRect(0, 0, W, estimH, 6);
    this.container.add(bg);

    // 등급 색 상단 바
    const gradeLine = this.scene.add.graphics()
      .fillStyle(gradeColor, 0.6)
      .fillRoundedRect(0, 0, W, 4, { tl: 6, tr: 6, bl: 0, br: 0 });
    this.container.add(gradeLine);
    curY = 8;

    // 아이템 이름
    const nameTxt = this.scene.add.text(8, curY, data.name, {
      fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif',
      color: Phaser.Display.Color.IntegerToColor(gradeColor).rgba,
      fontStyle: 'bold',
      wordWrap: { width: W - 16 },
    });
    this.container.add(nameTxt);
    curY += nameTxt.height + 2;

    // 카테고리
    const catTxt = this.scene.add.text(8, curY, data.category, {
      fontSize: '10px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#888888',
    });
    this.container.add(catTxt);
    curY += catTxt.height + 6;

    // 구분선
    const divider = this.scene.add.graphics()
      .lineStyle(1, gradeColor, 0.3)
      .strokeLineShape(new Phaser.Geom.Line(8, curY, W - 8, curY));
    this.container.add(divider);
    curY += 6;

    // 스탯 목록
    if (data.stats && data.stats.length > 0) {
      data.stats.forEach(stat => {
        const isPositive = stat.includes('+');
        const statTxt = this.scene.add.text(10, curY, stat, {
          fontSize: '11px', fontFamily: 'monospace',
          color: isPositive ? '#88ff88' : '#ff8888',
        });
        this.container.add(statTxt);
        curY += 16;
      });
      curY += 4;
    }

    // 설명
    if (data.description) {
      const descTxt = this.scene.add.text(8, curY, data.description, {
        fontSize: '10px', fontFamily: '"Noto Sans KR", sans-serif',
        color: '#aaaaaa',
        wordWrap: { width: W - 16 },
        lineSpacing: 2,
      });
      this.container.add(descTxt);
      curY += descTxt.height + 4;
    }

    // 내구도 바
    if (data.durability !== undefined) {
      const durColor = data.durability > 60 ? 0x44ff88
                     : data.durability > 30 ? 0xffaa44
                     : 0xff4444;
      const durBg = this.scene.add.graphics()
        .fillStyle(0x333344, 1)
        .fillRoundedRect(8, curY, W - 16, 6, 3);
      const durFill = this.scene.add.graphics()
        .fillStyle(durColor, 1)
        .fillRoundedRect(8, curY, (W - 16) * (data.durability / 100), 6, 3);
      const durTxt = this.scene.add.text(8, curY - 12, `내구도 ${data.durability}%`, {
        fontSize: '10px', fontFamily: '"Noto Sans KR", sans-serif',
        color: '#888888',
      });
      this.container.add([durBg, durFill, durTxt]);
      curY += 14;
    }

    // 골드 가치
    if (data.value !== undefined) {
      const valTxt = this.scene.add.text(8, curY + 2, `💰 ${data.value}G`, {
        fontSize: '10px', fontFamily: '"Noto Sans KR", sans-serif',
        color: '#ffcc44',
      });
      this.container.add(valTxt);
    }
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 80,
    });
  }

  destroy(): void {
    this.container.destroy();
  }
}
```

---

## 4. 아이템 드롭 글로우 (ItemDropGlow)

```typescript
// src/rendering/ItemDropGlow.ts

export class ItemDropGlow {
  private scene: Phaser.Scene;
  /** itemId → glow graphics */
  private glows: Map<string, {
    gfx: Phaser.GameObjects.Graphics;
    tween: Phaser.Tweens.Tween;
    label: Phaser.GameObjects.Text;
  }> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  add(
    itemId: string,
    worldX: number,
    worldY: number,
    gradeColor: number,
    itemName: string,
  ): void {
    this.remove(itemId);

    // 글로우 원 (맥동)
    const gfx = this.scene.add.graphics().setDepth(5);
    const tween = this.scene.tweens.add({
      targets: {},
      progress: { from: 0, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: 'Sine.easeInOut',
      onUpdate: (_: unknown, p: number) => {
        const r = Phaser.Math.Linear(8, 14, p);
        const a = Phaser.Math.Linear(0.3, 0.7, p);
        gfx.clear()
          .fillStyle(gradeColor, a * 0.4)
          .fillCircle(worldX, worldY, r)
          .lineStyle(1.5, gradeColor, a)
          .strokeCircle(worldX, worldY, r);
      },
    });

    // 아이템 이름 라벨 (근처 호버 시 표시 — 여기선 항상 표시)
    const label = this.scene.add.text(worldX, worldY - 18, itemName, {
      fontSize: '10px',
      fontFamily: '"Noto Sans KR", sans-serif',
      color: Phaser.Display.Color.IntegerToColor(gradeColor).rgba,
      stroke: '#000000',
      strokeThickness: 2,
    }).setDepth(6).setOrigin(0.5).setAlpha(0.85);

    // 라벨 부유
    this.scene.tweens.add({
      targets: label,
      y: worldY - 22,
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut',
    });

    this.glows.set(itemId, { gfx, tween, label });
  }

  remove(itemId: string): void {
    const entry = this.glows.get(itemId);
    if (!entry) return;
    entry.tween.stop();
    entry.gfx.destroy();
    entry.label.destroy();
    this.glows.delete(itemId);
  }

  /** 아이템 수집 시 빨려들기 이펙트 */
  playCollectEffect(itemId: string, targetX: number, targetY: number): void {
    const entry = this.glows.get(itemId);
    if (!entry) return;

    entry.tween.stop();
    const startX = entry.gfx.x, startY = entry.gfx.y;

    // 글로우를 플레이어쪽으로 수축
    this.scene.tweens.add({
      targets: entry.gfx,
      x: targetX, y: targetY,
      scaleX: 0.1, scaleY: 0.1,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => this.remove(itemId),
    });
    this.scene.tweens.add({
      targets: entry.label,
      x: targetX, y: targetY - 20,
      alpha: 0,
      duration: 180,
      ease: 'Cubic.easeIn',
    });
  }

  destroy(): void {
    for (const [id] of this.glows) this.remove(id);
  }
}
```

---

## 5. 깊이(Depth) 테이블

| 레이어            | depth |
|-------------------|-------|
| 아이템 드롭 글로우 | 5     |
| 아이템 이름 라벨   | 6     |
| 인벤토리 UI       | 160   |
| 아이템 툴팁       | 200   |
