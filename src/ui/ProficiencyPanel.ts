import Phaser from 'phaser';
import type { ProficiencyType } from '../systems/ProficiencySystem';
import { PROF_NAMES } from '../systems/ProficiencySystem';

const PROF_CONFIG: Record<ProficiencyType, { icon: string; color: string }> = {
  woodcutting: { icon: '🪓', color: '#8a6030' },
  mining:      { icon: '⛏', color: '#808080' },
  fishing:     { icon: '🎣', color: '#4080c0' },
  crafting:    { icon: '🔨', color: '#8060c0' },
  building:    { icon: '🏗', color: '#c8a030' },
  cooking:     { icon: '🍳', color: '#e06020' },
  combat:      { icon: '⚔', color: '#e04040' },
  farming:     { icon: '🌾', color: '#60a830' },
};

const PW = 340, PH = 250;
const PROF_ORDER: ProficiencyType[] = [
  'woodcutting', 'mining', 'fishing', 'crafting',
  'building', 'cooking', 'combat', 'farming',
];

interface ProfRow {
  level: number;
  xp: number;
  nextLevelXp: number;
}

/**
 * 숙련도 패널 (슬라이드 인/아웃, depth 80).
 */
export class ProficiencyPanel {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private dimGfx: Phaser.GameObjects.Graphics;
  private rows: Phaser.GameObjects.Text[] = [];
  private barGfxList: Phaser.GameObjects.Graphics[] = [];
  private isOpen = false;

  constructor(private scene: Phaser.Scene) {
    this.dimGfx = scene.add.graphics().setScrollFactor(0).setDepth(79).setVisible(false);

    this.bg = scene.add.graphics();
    this.drawBg();

    const titleText = scene.add.text(PW / 2, 10, '숙련도', {
      fontSize: '13px', fontFamily: 'Courier New', color: '#f0c030',
    }).setOrigin(0.5, 0);

    this.container = scene.add.container(20, 60, [this.bg, titleText])
      .setScrollFactor(0).setDepth(80).setVisible(false);
  }

  private drawBg(): void {
    this.bg.clear();
    this.bg.fillStyle(0x0a0805, 0.95);
    this.bg.fillRoundedRect(0, 0, PW, PH, 6);
    this.bg.lineStyle(1, 0x5a4428, 1);
    this.bg.strokeRoundedRect(0, 0, PW, PH, 6);
    this.bg.fillStyle(0xc8a030, 1);
    this.bg.fillRect(0, 4, 3, PH - 8);
  }

  open(getData: (id: ProficiencyType) => ProfRow): void {
    if (this.isOpen) { this.refresh(getData); return; }
    this.isOpen = true;
    this.buildRows(getData);

    const { width: W } = this.scene.scale;
    this.container.setPosition(-PW - 10, 60).setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      x: W - PW - 20, alpha: 1,
      duration: 250, ease: 'Quad.easeOut',
    });

    this.dimGfx.clear();
    this.dimGfx.fillStyle(0x000000, 0.45);
    this.dimGfx.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.dimGfx.setAlpha(0).setVisible(true);
    this.scene.tweens.add({ targets: this.dimGfx, alpha: 1, duration: 200 });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    const { width: W } = this.scene.scale;
    this.scene.tweens.add({
      targets: this.container,
      x: W + 10, alpha: 0,
      duration: 200,
      onComplete: () => this.container.setVisible(false),
    });
    this.scene.tweens.add({
      targets: this.dimGfx, alpha: 0, duration: 200,
      onComplete: () => this.dimGfx.setVisible(false),
    });
  }

  toggle(getData: (id: ProficiencyType) => ProfRow): void {
    if (this.isOpen) this.close();
    else this.open(getData);
  }

  isVisible(): boolean { return this.isOpen; }

  private buildRows(getData: (id: ProficiencyType) => ProfRow): void {
    for (const t of this.rows) t.destroy();
    for (const g of this.barGfxList) g.destroy();
    this.rows = [];
    this.barGfxList = [];

    PROF_ORDER.forEach((id, i) => {
      const data = getData(id);
      const cfg = PROF_CONFIG[id];
      const y = 32 + i * 26;

      const rowText = this.scene.add.text(10, y,
        `${cfg.icon} ${PROF_NAMES[id]}  Lv.${data.level}`, {
          fontSize: '10px', fontFamily: 'Courier New', color: cfg.color,
        },
      );
      this.rows.push(rowText);
      this.container.add(rowText);

      const barGfx = this.scene.add.graphics();
      this.drawBar(barGfx, data, y, cfg.color);
      this.barGfxList.push(barGfx);
      this.container.add(barGfx);
    });
  }

  private drawBar(gfx: Phaser.GameObjects.Graphics, data: ProfRow, y: number, color: string): void {
    const bx = 130, bw = 160, bh = 8;
    const ratio = data.nextLevelXp > 0 ? Math.min(1, data.xp / data.nextLevelXp) : 1;
    const col = parseInt(color.replace('#', ''), 16);

    gfx.clear();
    // background
    gfx.fillStyle(0x1a1408, 1);
    gfx.fillRoundedRect(bx, y + 4, bw, bh, 2);
    // fill
    if (data.level < 10) {
      gfx.fillStyle(col, 1);
      gfx.fillRoundedRect(bx, y + 4, bw * ratio, bh, 2);
    } else {
      gfx.fillStyle(0xf0c030, 1);
      gfx.fillRoundedRect(bx, y + 4, bw, bh, 2);
    }
  }

  private refresh(getData: (id: ProficiencyType) => ProfRow): void {
    PROF_ORDER.forEach((id, i) => {
      const data = getData(id);
      const cfg = PROF_CONFIG[id];
      const y = 32 + i * 26;
      if (this.rows[i]) {
        this.rows[i].setText(`${cfg.icon} ${PROF_NAMES[id]}  Lv.${data.level}`);
      }
      if (this.barGfxList[i]) {
        this.drawBar(this.barGfxList[i], data, y, cfg.color);
      }
    });
  }

  destroy(): void {
    for (const t of this.rows) t.destroy();
    for (const g of this.barGfxList) g.destroy();
    this.container.destroy();
    this.dimGfx.destroy();
  }
}
