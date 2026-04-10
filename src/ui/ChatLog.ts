import Phaser from 'phaser';
import type { ChatMessage } from '../systems/ChatSystem';

const LOG_MAX_LINES = 6;
const LINE_H = 18;
const LOG_W = 280;
const LOG_PAD_X = 6;
const LOG_PAD_Y = 4;
const LOG_DEPTH = 95;

export class ChatLog {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private lines: Phaser.GameObjects.Text[] = [];
  private scene: Phaser.Scene;
  private hovered = false;
  private x: number;
  private y: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const W = scene.scale.width;
    const H = scene.scale.height;

    // Position: bottom-left, above HUD (HUD bottom items at H-20, H-40, H-60)
    const logH = LOG_MAX_LINES * LINE_H + LOG_PAD_Y * 2;
    this.x = 8;
    this.y = H - 70 - logH;

    this.container = scene.add.container(this.x, this.y)
      .setScrollFactor(0)
      .setDepth(LOG_DEPTH);

    this.bg = scene.add.rectangle(0, 0, LOG_W, logH, 0x000000, 0.45)
      .setOrigin(0, 0);
    this.container.add(this.bg);

    for (let i = 0; i < LOG_MAX_LINES; i++) {
      const txt = scene.add.text(LOG_PAD_X, LOG_PAD_Y + i * LINE_H, '', {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'monospace',
        wordWrap: { width: LOG_W - LOG_PAD_X * 2 },
      }).setOrigin(0, 0);
      this.lines.push(txt);
      this.container.add(txt);
    }

    // Hover to pause fade
    this.bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, LOG_W, logH), Phaser.Geom.Rectangle.Contains);
    this.bg.on('pointerover', () => { this.hovered = true; });
    this.bg.on('pointerout', () => { this.hovered = false; });
  }

  isHovered(): boolean { return this.hovered; }

  /** Called every frame with current messages */
  render(messages: ChatMessage[]): void {
    // Show last LOG_MAX_LINES messages
    const visible = messages.slice(-LOG_MAX_LINES);

    for (let i = 0; i < LOG_MAX_LINES; i++) {
      const msg = visible[i];
      const line = this.lines[i];
      if (!msg) {
        line.setText('').setAlpha(1);
        continue;
      }

      let displayText: string;
      if (msg.type === 'system') {
        displayText = msg.text;
        line.setColor('#aaaaaa').setStyle({ fontStyle: 'italic' });
      } else {
        displayText = `[${msg.playerName}] ${msg.text}`;
        line.setColor('#ffffff').setStyle({ fontStyle: 'normal' });
        // Colorize player name portion using rich text trick isn't available,
        // so we just use white for the full line (color comes from bubble)
      }
      line.setText(displayText).setAlpha(this.hovered ? 1 : msg.alpha);
    }
  }

  showFull(): void {
    // Make all lines fully opaque (when chat input opens)
    for (const line of this.lines) line.setAlpha(1);
  }

  destroy(): void {
    this.container.destroy();
  }
}
