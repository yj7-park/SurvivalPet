export type QuestEventType = 'accept' | 'complete' | 'fail' | 'update';

const QUEST_COLORS: Record<QuestEventType, number> = {
  accept:   0x44aaff,
  complete: 0xffdd44,
  fail:     0xff4444,
  update:   0x88cc88,
};

const QUEST_ICONS: Record<QuestEventType, string> = {
  accept:   '!',
  complete: '★',
  fail:     '✕',
  update:   '↑',
};

export class QuestNotification {
  private scene:   Phaser.Scene;
  private queue:   Array<{ type: QuestEventType; title: string; desc: string }> = [];
  private showing = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  push(type: QuestEventType, title: string, desc: string): void {
    this.queue.push({ type, title, desc });
    if (!this.showing) this._next();
  }

  private _next(): void {
    if (this.queue.length === 0) { this.showing = false; return; }
    this.showing = true;
    const { type, title, desc } = this.queue.shift()!;
    this._show(type, title, desc);
  }

  private _show(type: QuestEventType, title: string, desc: string): void {
    const { width: W } = this.scene.scale;
    const color   = QUEST_COLORS[type];
    const icon    = QUEST_ICONS[type];
    const PANEL_W = 260, PANEL_H = 56;
    const startX  = W + PANEL_W / 2;
    const finalX  = W - PANEL_W / 2 - 16;
    const Y       = 60;

    const badge = this.scene.add.graphics()
      .fillStyle(color, 1).fillCircle(0, 0, 14);
    const iconTxt = this.scene.add.text(0, 0, icon, {
      fontSize: '14px', fontFamily: 'monospace',
      color: '#000000', fontStyle: 'bold',
    }).setOrigin(0.5);

    const bg = this.scene.add.graphics()
      .fillStyle(0x111122, 0.92)
      .fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 6)
      .lineStyle(1.5, color, 0.8)
      .strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 6);

    const colorObj = Phaser.Display.Color.IntegerToColor(color);
    const titleTxt = this.scene.add.text(-PANEL_W / 2 + 24, -16, title, {
      fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif',
      color: colorObj.rgba, fontStyle: 'bold',
    });
    const descTxt = this.scene.add.text(-PANEL_W / 2 + 24, 2, desc, {
      fontSize: '11px', fontFamily: '"Noto Sans KR", sans-serif',
      color: '#aaaaaa',
    });

    const container = this.scene.add.container(startX, Y, [bg, badge, iconTxt, titleTxt, descTxt])
      .setDepth(190).setScrollFactor(0);

    this.scene.tweens.add({
      targets: container, x: finalX,
      duration: 320, ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(2000, () => {
          this.scene.tweens.add({
            targets: container, x: startX,
            duration: 260, ease: 'Cubic.easeIn',
            onComplete: () => { container.destroy(); this._next(); },
          });
        });
      },
    });

    if (type === 'complete') this._playCompleteSparkle(finalX, Y);
  }

  private _playCompleteSparkle(cx: number, cy: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const gfx   = this.scene.add.graphics()
        .fillStyle(0xffdd44, 1)
        .fillCircle(0, 0, 4)
        .setDepth(191).setScrollFactor(0)
        .setPosition(cx, cy);

      this.scene.tweens.add({
        targets: gfx,
        x: cx + Math.cos(angle) * 36,
        y: cy + Math.sin(angle) * 36,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 500, delay: i * 30, ease: 'Sine.easeOut',
        onComplete: () => gfx.destroy(),
      });
    }
  }

  destroy(): void { this.queue.length = 0; }
}
