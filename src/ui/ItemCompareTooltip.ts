import Phaser from 'phaser';

interface ItemStats {
  attack?: number;
  defense?: number;
  durability?: number;
  maxDurability?: number;
}

export interface CompareItemData {
  name: string;
  iconKey?: string;
  stats: ItemStats;
  slot?: string;
}

const PW = 320, PH = 120;

/**
 * 아이템 비교 팝업 (2열 레이아웃).
 * depth 115, scrollFactor 0.
 */
export class ItemCompareTooltip {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];

  constructor(private scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    this.container = scene.add.container(0, 0, [this.bg])
      .setScrollFactor(0).setDepth(115).setVisible(false);
  }

  show(
    hoverItem: CompareItemData,
    equippedItem: CompareItemData | null,
    screenX: number,
    screenY: number,
  ): void {
    this.hide();

    if (!equippedItem || equippedItem.slot !== hoverItem.slot) {
      this.showSimple(hoverItem, screenX, screenY);
      return;
    }

    this.buildComparePanel(hoverItem, equippedItem);
    this.positionPanel(screenX, screenY);
    this.container.setAlpha(0).setVisible(true);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 150 });
  }

  hide(): void {
    this.container.setVisible(false);
    for (const t of this.texts) t.destroy();
    this.texts = [];
  }

  private showSimple(item: CompareItemData, sx: number, sy: number): void {
    this.bg.clear();
    this.bg.fillStyle(0x0c0906, 0.95);
    this.bg.fillRoundedRect(0, 0, 150, 60, 4);
    this.bg.lineStyle(1, 0x5a4428, 1);
    this.bg.strokeRoundedRect(0, 0, 150, 60, 4);

    const nameT = this.scene.add.text(8, 8, item.name, {
      fontSize: '11px', fontFamily: 'Courier New', color: '#f0e0b0',
    });
    this.texts.push(nameT);
    this.container.add(nameT);

    const statKeys: (keyof ItemStats)[] = ['attack', 'defense', 'durability'];
    let row = 0;
    for (const k of statKeys) {
      const v = item.stats[k];
      if (v === undefined) continue;
      const t = this.scene.add.text(8, 26 + row * 14, `${k}: ${v}`, {
        fontSize: '10px', fontFamily: 'Courier New', color: '#ccccaa',
      });
      this.texts.push(t);
      this.container.add(t);
      row++;
    }

    this.container.setPosition(sx + 12, sy - 20).setAlpha(0).setVisible(true);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 150 });
  }

  private buildComparePanel(next: CompareItemData, curr: CompareItemData): void {
    this.bg.clear();
    this.bg.fillStyle(0x0c0906, 0.95);
    this.bg.fillRoundedRect(0, 0, PW, PH, 4);
    this.bg.lineStyle(1, 0x5a4428, 1);
    this.bg.strokeRoundedRect(0, 0, PW, PH, 4);
    this.bg.lineStyle(1, 0x5a4428, 0.5);
    this.bg.lineBetween(PW / 2, 8, PW / 2, PH - 8);

    const headers = [
      this.scene.add.text(8, 8, `현재: ${curr.name}`, { fontSize: '10px', fontFamily: 'Courier New', color: '#888866' }),
      this.scene.add.text(PW / 2 + 8, 8, `비교: ${next.name}`, { fontSize: '10px', fontFamily: 'Courier New', color: '#888866' }),
    ];
    for (const h of headers) { this.texts.push(h); this.container.add(h); }

    const statKeys: (keyof ItemStats)[] = ['attack', 'defense', 'durability'];
    statKeys.forEach((k, i) => {
      const cv = curr.stats[k] ?? 0;
      const nv = next.stats[k] ?? 0;
      const diff = nv - cv;
      const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '=';
      const color = diff > 0 ? '#40e060' : diff < 0 ? '#e04040' : '#aaaaaa';
      const y = 28 + i * 18;

      const t1 = this.scene.add.text(8, y, `${k}: ${cv}`, { fontSize: '10px', fontFamily: 'Courier New', color: '#ccccaa' });
      const t2 = this.scene.add.text(PW / 2 + 8, y, `${arrow} ${nv}`, { fontSize: '10px', fontFamily: 'Courier New', color });
      this.texts.push(t1, t2);
      this.container.add(t1); this.container.add(t2);
    });
  }

  private positionPanel(sx: number, sy: number): void {
    const { width: W, height: H } = this.scene.scale;
    const px = Math.min(sx + 12, W - PW - 8);
    const py = Math.max(8, Math.min(sy - PH / 2, H - PH - 8));
    this.container.setPosition(px, py);
  }

  destroy(): void {
    for (const t of this.texts) t.destroy();
    this.container.destroy();
  }
}
