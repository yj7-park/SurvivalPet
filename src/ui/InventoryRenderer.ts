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

export function drawEmptySlot(
  gfx: Phaser.GameObjects.Graphics,
  x: number, y: number,
  state: 'normal' | 'hover' | 'selected' = 'normal',
): void {
  const border   = state === 'hover'    ? SLOT.HOVER
                 : state === 'selected' ? SLOT.SEL
                 : SLOT.BORDER;
  const bgAlpha  = state === 'selected' ? 0.85 : SLOT.EMPTY_ALPHA;

  gfx.fillStyle(SLOT.BG, bgAlpha).fillRoundedRect(x, y, SLOT.SIZE, SLOT.SIZE, 5);
  gfx.lineStyle(state === 'normal' ? 1 : 1.5, border, 1)
     .strokeRoundedRect(x, y, SLOT.SIZE, SLOT.SIZE, 5);

  if (state === 'normal') {
    const cx = x + SLOT.SIZE / 2, cy = y + SLOT.SIZE / 2;
    gfx.lineStyle(1, SLOT.BORDER, 0.25)
       .strokeLineShape(new Phaser.Geom.Line(cx - 6, cy, cx + 6, cy))
       .strokeLineShape(new Phaser.Geom.Line(cx, cy - 6, cx, cy + 6));
  }
}

export function drawItemSlot(
  gfx: Phaser.GameObjects.Graphics,
  x: number, y: number,
  gradeColor: number,
  selected: boolean,
): void {
  gfx.fillStyle(SLOT.BG, 0.9).fillRoundedRect(x, y, SLOT.SIZE, SLOT.SIZE, 5);
  gfx.lineStyle(2, gradeColor, selected ? 1 : 0.7)
     .strokeRoundedRect(x, y, SLOT.SIZE, SLOT.SIZE, 5);
  gfx.lineStyle(1, gradeColor, selected ? 0.4 : 0.2)
     .strokeRoundedRect(x + 2, y + 2, SLOT.SIZE - 4, SLOT.SIZE - 4, 3);
}

// ── Item icon generator ───────────────────────────────────────────────────────

export type ItemCategory =
  | 'weapon_sword' | 'weapon_axe' | 'weapon_bow' | 'weapon_staff'
  | 'armor_helmet' | 'armor_chest' | 'armor_boots'
  | 'consumable_potion' | 'consumable_food'
  | 'material_wood' | 'material_stone' | 'material_ore'
  | 'tool_pickaxe' | 'tool_axe' | 'misc_coin';

const ICON_PALETTES: Record<ItemCategory, number[]> = {
  weapon_sword:     [0x8899bb, 0xaabbdd, 0x555566, 0xccddee],
  weapon_axe:       [0x997755, 0xbbaa88, 0x666644, 0xddccaa],
  weapon_bow:       [0x886644, 0xaa8855, 0x443322, 0xccaa77],
  weapon_staff:     [0x8844cc, 0xaa66ee, 0x442266, 0xcc88ff],
  armor_helmet:     [0x778899, 0x99aabb, 0x445566, 0xbbccdd],
  armor_chest:      [0x667788, 0x889999, 0x334455, 0xaabbcc],
  armor_boots:      [0x775544, 0x997766, 0x443322, 0xbbaa88],
  consumable_potion:[0xff4466, 0xff88aa, 0x882233, 0xffaabb],
  consumable_food:  [0xdd8844, 0xffaa66, 0x885522, 0xffcc99],
  material_wood:    [0x886633, 0xaa8855, 0x553311, 0xccaa77],
  material_stone:   [0x888899, 0xaaaacc, 0x556677, 0xccccdd],
  material_ore:     [0xbbaa44, 0xddcc66, 0x887722, 0xffeebb],
  tool_pickaxe:     [0xaaaaaa, 0xcccccc, 0x666666, 0x886633],
  tool_axe:         [0x997755, 0xbbaa88, 0x666633, 0x886644],
  misc_coin:        [0xffcc22, 0xffee66, 0xaa8811, 0xffeebb],
};

type PixelMap = number[][];

const ICON_PIXEL_MAPS: Partial<Record<ItemCategory, PixelMap>> = {
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
};

export function generateItemIcon(
  scene: Phaser.Scene,
  category: ItemCategory,
  size = 32,
): Phaser.GameObjects.RenderTexture {
  const rt  = scene.add.renderTexture(0, 0, size, size).setVisible(false);
  const gfx = scene.add.graphics().setVisible(false);
  const pal = ICON_PALETTES[category];
  const P   = size / 8;

  const pixelMap = ICON_PIXEL_MAPS[category];
  if (pixelMap && pixelMap.length > 0) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const idx = pixelMap[row]?.[col] ?? 0;
        if (idx > 0 && pal[idx - 1] !== undefined) {
          gfx.clear().fillStyle(pal[idx - 1], 1).fillRect(col * P, row * P, P, P);
          rt.draw(gfx, 0, 0);
        }
      }
    }
  } else {
    gfx.clear().fillStyle(pal[0], 0.9).fillCircle(size / 2, size / 2, size / 2 - 2);
    rt.draw(gfx, 0, 0);
  }

  gfx.destroy();
  return rt;
}

// ── Phaser-based ItemTooltip ──────────────────────────────────────────────────

export interface TooltipItemData {
  name:        string;
  grade:       'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  category:    string;
  description: string;
  stats?:      string[];
  durability?: number;
  value?:      number;
}

const TOOLTIP_GRADE_COLORS: Record<TooltipItemData['grade'], number> = {
  common:    0xaaaaaa,
  uncommon:  0x44ff88,
  rare:      0x4488ff,
  epic:      0xaa44ff,
  legendary: 0xff8800,
};

export class PhaserItemTooltip {
  private scene:     Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private isVisible  = false;

  constructor(scene: Phaser.Scene) {
    this.scene     = scene;
    this.container = scene.add.container(0, 0).setDepth(200).setScrollFactor(0).setAlpha(0);
  }

  show(data: TooltipItemData, screenX: number, screenY: number): void {
    this._rebuild(data);
    const { width: W, height: H } = this.scene.scale;
    const tooltipW = 200;
    const tooltipH = this._estimateHeight(data);

    let tx = screenX + 12;
    let ty = screenY - 10;
    if (tx + tooltipW > W) tx = screenX - tooltipW - 12;
    if (ty + tooltipH > H) ty = H - tooltipH - 8;
    ty = Math.max(8, ty);

    this.container.setPosition(tx, ty).setAlpha(0);
    this.isVisible = true;
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 120 });
  }

  private _estimateHeight(data: TooltipItemData): number {
    return 60 + (data.stats?.length ?? 0) * 16
              + (data.durability !== undefined ? 20 : 0)
              + (data.description ? 30 : 0);
  }

  private _rebuild(data: TooltipItemData): void {
    this.container.removeAll(true);

    const gradeColor = TOOLTIP_GRADE_COLORS[data.grade];
    const W          = 200;
    let   curY       = 0;

    const estimH = this._estimateHeight(data);
    this.container.add(
      this.scene.add.graphics()
        .fillStyle(0x111122, 0.95).fillRoundedRect(0, 0, W, estimH, 6)
        .lineStyle(1.5, gradeColor, 0.9).strokeRoundedRect(0, 0, W, estimH, 6)
    );
    this.container.add(
      this.scene.add.graphics()
        .fillStyle(gradeColor, 0.6)
        .fillRoundedRect(0, 0, W, 4, { tl: 6, tr: 6, bl: 0, br: 0 } as any)
    );
    curY = 8;

    const colorStr = Phaser.Display.Color.IntegerToColor(gradeColor).rgba;
    const nameTxt  = this.scene.add.text(8, curY, data.name, {
      fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif',
      color: colorStr, fontStyle: 'bold', wordWrap: { width: W - 16 },
    });
    this.container.add(nameTxt);
    curY += nameTxt.height + 2;

    const catTxt = this.scene.add.text(8, curY, data.category, {
      fontSize: '10px', fontFamily: '"Noto Sans KR", sans-serif', color: '#888888',
    });
    this.container.add(catTxt);
    curY += catTxt.height + 6;

    this.container.add(
      this.scene.add.graphics()
        .lineStyle(1, gradeColor, 0.3)
        .strokeLineShape(new Phaser.Geom.Line(8, curY, W - 8, curY))
    );
    curY += 6;

    if (data.stats && data.stats.length > 0) {
      data.stats.forEach(stat => {
        this.container.add(
          this.scene.add.text(10, curY, stat, {
            fontSize: '11px', fontFamily: 'monospace',
            color: stat.includes('+') ? '#88ff88' : '#ff8888',
          })
        );
        curY += 16;
      });
      curY += 4;
    }

    if (data.description) {
      const descTxt = this.scene.add.text(8, curY, data.description, {
        fontSize: '10px', fontFamily: '"Noto Sans KR", sans-serif',
        color: '#aaaaaa', wordWrap: { width: W - 16 }, lineSpacing: 2,
      });
      this.container.add(descTxt);
      curY += descTxt.height + 4;
    }

    if (data.durability !== undefined) {
      const durColor = data.durability > 60 ? 0x44ff88
                     : data.durability > 30 ? 0xffaa44
                     : 0xff4444;
      this.container.add(
        this.scene.add.text(8, curY - 12, `내구도 ${data.durability}%`, {
          fontSize: '10px', fontFamily: '"Noto Sans KR", sans-serif', color: '#888888',
        })
      );
      this.container.add(
        this.scene.add.graphics()
          .fillStyle(0x333344, 1).fillRoundedRect(8, curY, W - 16, 6, 3)
      );
      this.container.add(
        this.scene.add.graphics()
          .fillStyle(durColor, 1)
          .fillRoundedRect(8, curY, (W - 16) * (data.durability / 100), 6, 3)
      );
      curY += 14;
    }

    if (data.value !== undefined) {
      this.container.add(
        this.scene.add.text(8, curY + 2, `💰 ${data.value}G`, {
          fontSize: '10px', fontFamily: '"Noto Sans KR", sans-serif', color: '#ffcc44',
        })
      );
    }
  }

  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.scene.tweens.add({ targets: this.container, alpha: 0, duration: 80 });
  }

  destroy(): void { this.container.destroy(); }
}
