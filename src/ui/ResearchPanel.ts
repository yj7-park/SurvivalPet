import Phaser from 'phaser';
import type { ResearchDef } from '../systems/ResearchSystem';

interface NodePosition {
  x: number;
  y: number;
  def: ResearchDef;
  state: 'locked' | 'available' | 'researching' | 'unlocked';
}

const NODE_W = 64, NODE_H = 40;
const PW = 360, PH = 260;

/**
 * 연구 트리 패널 (노드 + 연결선).
 * depth 80, scrollFactor 0.
 */
export class ResearchPanel {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private dimGfx: Phaser.GameObjects.Graphics;
  private nodeGfxList: Phaser.GameObjects.Graphics[] = [];
  private nodeTexts: Phaser.GameObjects.Text[] = [];
  private isOpen = false;

  constructor(private scene: Phaser.Scene) {
    this.dimGfx = scene.add.graphics().setScrollFactor(0).setDepth(79).setVisible(false);

    this.bg = scene.add.graphics();
    this.drawBg();

    const titleText = scene.add.text(PW / 2, 10, '연구', {
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

  open(nodes: NodePosition[]): void {
    if (this.isOpen) { this.refresh(nodes); return; }
    this.isOpen = true;
    this.buildNodes(nodes);

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

  isVisible(): boolean { return this.isOpen; }

  private buildNodes(nodes: NodePosition[]): void {
    for (const g of this.nodeGfxList) g.destroy();
    for (const t of this.nodeTexts) t.destroy();
    this.nodeGfxList = [];
    this.nodeTexts = [];

    // Draw edges first (behind nodes)
    if (nodes.length > 1) {
      const edgeGfx = this.scene.add.graphics();
      this.nodeGfxList.push(edgeGfx);
      this.container.add(edgeGfx);
      for (let i = 0; i < nodes.length - 1; i++) {
        this.drawEdge(
          edgeGfx,
          { x: nodes[i].x + NODE_W, y: nodes[i].y + NODE_H / 2 },
          { x: nodes[i + 1].x, y: nodes[i + 1].y + NODE_H / 2 },
          nodes[i].state === 'unlocked',
        );
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const gfx = this.scene.add.graphics();
      this.drawNode(gfx, node);
      this.nodeGfxList.push(gfx);
      this.container.add(gfx);

      const labelColor = this.getNodeTextColor(node.state);
      const label = this.scene.add.text(
        node.x + NODE_W / 2,
        node.y + 8,
        node.state === 'locked' ? '🔒' : (node.def.label.split(' ')[0] + '\n' + node.def.label.split(' ').slice(1).join(' ').slice(0, 8)),
        { fontSize: '8px', fontFamily: 'Courier New', color: labelColor, align: 'center', wordWrap: { width: NODE_W - 4 } },
      ).setOrigin(0.5, 0);
      this.nodeTexts.push(label);
      this.container.add(label);
    }
  }

  private drawNode(gfx: Phaser.GameObjects.Graphics, node: NodePosition): void {
    const colors: Record<string, { bg: number; border: number }> = {
      locked:      { bg: 0x1a1408, border: 0x3a2a14 },
      available:   { bg: 0x2a2010, border: 0x8a6030 },
      researching: { bg: 0x2a2010, border: 0xf0c030 },
      unlocked:    { bg: 0x182018, border: 0x40a830 },
    };
    const cfg = colors[node.state] ?? colors.locked;

    gfx.clear();
    gfx.fillStyle(cfg.bg, 1);
    gfx.fillRoundedRect(node.x, node.y, NODE_W, NODE_H, 4);
    gfx.lineStyle(node.state === 'researching' ? 2 : 1, cfg.border, 1);
    gfx.strokeRoundedRect(node.x, node.y, NODE_W, NODE_H, 4);

    // Progress bar for researching state
    if (node.state === 'researching') {
      gfx.fillStyle(0x1a1408, 1);
      gfx.fillRect(node.x + 4, node.y + NODE_H - 6, NODE_W - 8, 3);
      gfx.fillStyle(0xf0c030, 1);
      gfx.fillRect(node.x + 4, node.y + NODE_H - 6, (NODE_W - 8) * 0.5, 3);
    }

    // Check mark for unlocked
    if (node.state === 'unlocked') {
      gfx.fillStyle(0x40e060, 1);
      gfx.fillCircle(node.x + NODE_W - 6, node.y + NODE_H - 6, 4);
    }
  }

  private drawEdge(
    gfx: Phaser.GameObjects.Graphics,
    from: { x: number; y: number },
    to: { x: number; y: number },
    unlocked: boolean,
  ): void {
    gfx.lineStyle(2, unlocked ? 0x40a830 : 0x5a4628, unlocked ? 0.7 : 0.5);
    const midX = (from.x + to.x) / 2;
    gfx.beginPath();
    gfx.moveTo(from.x, from.y);
    gfx.lineTo(midX, from.y);
    gfx.lineTo(midX, to.y);
    gfx.lineTo(to.x, to.y);
    gfx.strokePath();
  }

  private getNodeTextColor(state: string): string {
    switch (state) {
      case 'locked': return '#555545';
      case 'available': return '#e8d8b0';
      case 'researching': return '#f0c030';
      case 'unlocked': return '#80e060';
      default: return '#aaaaaa';
    }
  }

  private refresh(nodes: NodePosition[]): void {
    this.buildNodes(nodes);
  }

  destroy(): void {
    for (const g of this.nodeGfxList) g.destroy();
    for (const t of this.nodeTexts) t.destroy();
    this.container.destroy();
    this.dimGfx.destroy();
  }
}
