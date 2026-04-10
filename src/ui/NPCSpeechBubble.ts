export class NPCSpeechBubble {
  private scene:   Phaser.Scene;
  private bubbles: Map<string, { container: Phaser.GameObjects.Container; tween: Phaser.Tweens.Tween }> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  showQuick(
    npcId: string,
    worldX: number, worldY: number,
    text: string,
    duration = 2400,
  ): void {
    this.hide(npcId);

    const txt = this.scene.add.text(0, 0, text, {
      fontSize: '12px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#ffffff', padding: { x: 8, y: 5 },
    });
    const W = txt.width + 16, H = txt.height + 10;
    txt.setPosition(-W / 2 + 8, -H / 2 + 5);

    const bg = this.scene.add.graphics()
      .fillStyle(0x1a1a2e, 0.88)
      .fillRoundedRect(-W / 2, -H / 2, W, H, 6)
      .lineStyle(1.5, 0x88aacc, 0.9)
      .strokeRoundedRect(-W / 2, -H / 2, W, H, 6);

    const tail = this.scene.add.graphics()
      .fillStyle(0x1a1a2e, 0.88)
      .fillTriangle(-5, H / 2, 5, H / 2, 0, H / 2 + 7);

    const container = this.scene.add.container(worldX, worldY - 32, [bg, tail, txt])
      .setDepth(90).setAlpha(0);

    const tween = this.scene.tweens.add({
      targets: container, alpha: 1,
      scaleY: { from: 0.3, to: 1 },
      duration: 150, ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(duration, () => {
          this.scene.tweens.add({
            targets: container, alpha: 0, y: container.y - 8,
            duration: 300,
            onComplete: () => { container.destroy(); this.bubbles.delete(npcId); },
          });
        });
      },
    });

    this.bubbles.set(npcId, { container, tween });
  }

  updatePosition(npcId: string, worldX: number, worldY: number): void {
    this.bubbles.get(npcId)?.container.setPosition(worldX, worldY - 32);
  }

  hide(npcId: string): void {
    const entry = this.bubbles.get(npcId);
    if (!entry) return;
    entry.tween.stop();
    entry.container.destroy();
    this.bubbles.delete(npcId);
  }

  hideAll(): void { for (const [id] of this.bubbles) this.hide(id); }

  destroy(): void { this.hideAll(); }
}

// ── NPC State Indicator ───────────────────────────────────────────────────────

export type NPCStateIcon = 'quest_new' | 'quest_done' | 'shop' | 'talk' | 'busy';

const STATE_COLORS: Record<NPCStateIcon, number> = {
  quest_new:  0xffdd00,
  quest_done: 0x44ff88,
  shop:       0xffaa44,
  talk:       0x88ccff,
  busy:       0x888888,
};
const STATE_SYMBOLS: Record<NPCStateIcon, string> = {
  quest_new:  '!',
  quest_done: '?',
  shop:       '$',
  talk:       '…',
  busy:       '✕',
};

export class NPCStateIndicator {
  private scene:      Phaser.Scene;
  private indicators: Map<string, Phaser.GameObjects.Container> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  set(npcId: string, worldX: number, worldY: number, state: NPCStateIcon): void {
    this.indicators.get(npcId)?.destroy();

    const color = STATE_COLORS[state];
    const sym   = STATE_SYMBOLS[state];

    const bg = this.scene.add.graphics()
      .fillStyle(color, 1).fillCircle(0, 0, 9)
      .lineStyle(1.5, 0x000000, 0.5).strokeCircle(0, 0, 9);

    const txt = this.scene.add.text(0, 0, sym, {
      fontSize: '11px', fontFamily: 'monospace',
      color: '#000000', fontStyle: 'bold',
    }).setOrigin(0.5);

    const container = this.scene.add.container(worldX, worldY - 26, [bg, txt]).setDepth(88);
    container.setScale(0);

    this.scene.tweens.add({
      targets: container, scaleX: 1, scaleY: 1,
      duration: 200, ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: container, y: worldY - 30,
      yoyo: true, repeat: -1, duration: 800, ease: 'Sine.easeInOut',
    });

    this.indicators.set(npcId, container);
  }

  updatePosition(npcId: string, worldX: number, worldY: number): void {
    this.indicators.get(npcId)?.setPosition(worldX, worldY - 26);
  }

  clear(npcId: string): void {
    this.indicators.get(npcId)?.destroy();
    this.indicators.delete(npcId);
  }

  destroy(): void { for (const [id] of this.indicators) this.clear(id); }
}
