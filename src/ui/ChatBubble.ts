import Phaser from 'phaser';

const BUBBLE_DURATION_MS = 4000;
const MAX_DISPLAY_LEN = 24;
const BUBBLE_DEPTH_OFFSET = 1;

interface BubbleEntry {
  bg: Phaser.GameObjects.Rectangle;
  txt: Phaser.GameObjects.Text;
  timeLeft: number;
}

export class ChatBubbleManager {
  private scene: Phaser.Scene;
  private bubbles = new Map<string, BubbleEntry>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  showBubble(playerId: string, text: string, worldX: number, worldY: number, depth: number): void {
    // Remove existing bubble for this player
    this.removeBubble(playerId);

    const displayText = text.length > MAX_DISPLAY_LEN ? text.substring(0, MAX_DISPLAY_LEN) + '...' : text;
    const padX = 5, padY = 3;
    const fontSize = 10;
    const approxW = displayText.length * fontSize * 0.6 + padX * 2;
    const approxH = fontSize + padY * 2 + 2;
    const offsetY = -32; // above sprite

    const bg = this.scene.add.rectangle(worldX, worldY + offsetY, approxW, approxH, 0x000000, 0.7)
      .setDepth(depth + BUBBLE_DEPTH_OFFSET)
      .setOrigin(0.5, 1);

    const txt = this.scene.add.text(worldX, worldY + offsetY - approxH / 2, displayText, {
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setDepth(depth + BUBBLE_DEPTH_OFFSET + 0.1).setOrigin(0.5, 0.5);

    this.bubbles.set(playerId, { bg, txt, timeLeft: BUBBLE_DURATION_MS });
  }

  updateBubblePosition(playerId: string, worldX: number, worldY: number): void {
    const entry = this.bubbles.get(playerId);
    if (!entry) return;
    const offsetY = -32;
    const approxH = entry.bg.height;
    entry.bg.setPosition(worldX, worldY + offsetY);
    entry.txt.setPosition(worldX, worldY + offsetY - approxH / 2);
  }

  removeBubble(playerId: string): void {
    const entry = this.bubbles.get(playerId);
    if (!entry) return;
    entry.bg.destroy();
    entry.txt.destroy();
    this.bubbles.delete(playerId);
  }

  update(delta: number): void {
    for (const [id, entry] of this.bubbles) {
      entry.timeLeft -= delta;
      if (entry.timeLeft <= 0) {
        this.removeBubble(id);
      } else if (entry.timeLeft < 500) {
        const alpha = entry.timeLeft / 500;
        entry.bg.setAlpha(alpha * 0.7);
        entry.txt.setAlpha(alpha);
      }
    }
  }

  destroy(): void {
    for (const id of [...this.bubbles.keys()]) this.removeBubble(id);
  }
}
