const DB = {
  WIDTH:      520,
  HEIGHT:     110,
  PADDING:    16,
  CORNER:     8,
  BG_COLOR:   0x1a1a2e,
  BG_ALPHA:   0.92,
  BORDER_CLR: 0x4488cc,
  BORDER_W:   2,
  NAME_CLR:   '#88ccff',
  TEXT_CLR:   '#e8e8e8',
  FONT:       '"Noto Sans KR", sans-serif',
  ARROW_CLR:  0x88ccff,
} as const;

export class DialogueBox {
  private scene:      Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private bg?:        Phaser.GameObjects.Graphics;
  private nameText?:  Phaser.GameObjects.Text;
  private bodyText?:  Phaser.GameObjects.Text;
  private arrow?:     Phaser.GameObjects.Graphics;
  private portrait?:  Phaser.GameObjects.Graphics;
  private typeTimer:  Phaser.Time.TimerEvent | null = null;
  private currentFull = '';
  private typeIndex   = 0;
  private onFinish?:  () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this._build();
  }

  private _build(): void {
    const { width: W, height: H } = this.scene.scale;
    const x = (W - DB.WIDTH) / 2;
    const y = H - DB.HEIGHT - 20;

    this.bg = this.scene.add.graphics()
      .lineStyle(DB.BORDER_W, DB.BORDER_CLR, 1)
      .fillStyle(DB.BG_COLOR, DB.BG_ALPHA)
      .fillRoundedRect(0, 0, DB.WIDTH, DB.HEIGHT, DB.CORNER)
      .strokeRoundedRect(0, 0, DB.WIDTH, DB.HEIGHT, DB.CORNER);

    this.portrait = this.scene.add.graphics()
      .fillStyle(0x223355, 1)
      .fillRoundedRect(DB.PADDING, DB.PADDING, 48, 48, 4)
      .lineStyle(1, DB.BORDER_CLR, 0.6)
      .strokeRoundedRect(DB.PADDING, DB.PADDING, 48, 48, 4);

    this.nameText = this.scene.add.text(DB.PADDING + 56, DB.PADDING, '', {
      fontSize: '13px', fontFamily: DB.FONT,
      color: DB.NAME_CLR, fontStyle: 'bold',
    });

    this.bodyText = this.scene.add.text(DB.PADDING + 56, DB.PADDING + 20, '', {
      fontSize: '13px', fontFamily: DB.FONT, color: DB.TEXT_CLR,
      wordWrap: { width: DB.WIDTH - DB.PADDING * 2 - 64 }, lineSpacing: 4,
    });

    this.arrow = this.scene.add.graphics();
    this._drawArrow(1);
    this.scene.tweens.add({
      targets: this.arrow, alpha: 0.2,
      yoyo: true, repeat: -1, duration: 500,
    });

    this.container = this.scene.add.container(x, y, [
      this.bg, this.portrait, this.nameText, this.bodyText, this.arrow,
    ]).setDepth(180).setScrollFactor(0).setAlpha(0);
  }

  private _drawArrow(alpha: number): void {
    if (!this.arrow) return;
    this.arrow.clear().fillStyle(DB.ARROW_CLR, alpha);
    const ax = DB.WIDTH - DB.PADDING - 8;
    const ay = DB.HEIGHT - DB.PADDING - 4;
    this.arrow.fillTriangle(ax, ay, ax - 6, ay - 8, ax + 6, ay - 8);
  }

  setPortrait(npcType: 'merchant' | 'guard' | 'elder' | 'villager'): void {
    if (!this.portrait) return;
    this.portrait.clear()
      .fillStyle(0x223355, 1)
      .fillRoundedRect(DB.PADDING, DB.PADDING, 48, 48, 4)
      .lineStyle(1, DB.BORDER_CLR, 0.6)
      .strokeRoundedRect(DB.PADDING, DB.PADDING, 48, 48, 4);

    const colors = {
      merchant: { skin: 0xddb58a, hair: 0x7a4f2a, cloth: 0x8855cc },
      guard:    { skin: 0xcc9966, hair: 0x444444, cloth: 0x4466aa },
      elder:    { skin: 0xe8c8a0, hair: 0xdddddd, cloth: 0x668855 },
      villager: { skin: 0xddb58a, hair: 0x996633, cloth: 0xaa6633 },
    };
    const c  = colors[npcType];
    const ox = DB.PADDING + 8, oy = DB.PADDING + 6, S = 3;

    this.portrait.fillStyle(c.skin, 1)
      .fillRect(ox + S * 3, oy, S * 4, S * 5);
    this.portrait.fillStyle(c.hair, 1)
      .fillRect(ox + S * 2, oy, S * 6, S * 2)
      .fillRect(ox + S * 2, oy + S * 2, S, S * 3);
    this.portrait.fillStyle(0x222222, 1)
      .fillRect(ox + S * 4, oy + S * 2, S, S)
      .fillRect(ox + S * 6, oy + S * 2, S, S);
    this.portrait.fillStyle(c.cloth, 1)
      .fillRect(ox + S * 2, oy + S * 5, S * 6, S * 5);
  }

  show(npcName: string, text: string, onFinish?: () => void): void {
    if (!this.container || !this.nameText || !this.bodyText || !this.arrow) return;
    this.onFinish   = onFinish;
    this.currentFull = text;
    this.typeIndex  = 0;
    this.bodyText.setText('');
    this.nameText.setText(npcName);
    this.arrow.setAlpha(0);

    const origY = this.container.y;
    this.container.setAlpha(0).setY(origY + 12);
    this.scene.tweens.add({
      targets: this.container, alpha: 1, y: origY,
      duration: 220, ease: 'Back.easeOut',
      onComplete: () => this._startTyping(),
    });
  }

  private _startTyping(): void {
    this.typeTimer?.remove();
    this.typeTimer = this.scene.time.addEvent({
      delay: 28,
      repeat: this.currentFull.length - 1,
      callback: () => {
        this.typeIndex++;
        this.bodyText?.setText(this.currentFull.slice(0, this.typeIndex));
        if (this.typeIndex >= this.currentFull.length) {
          this.arrow?.setAlpha(1);
          this.onFinish?.();
        }
      },
    });
  }

  skipTyping(): void {
    if (this.typeIndex < this.currentFull.length) {
      this.typeTimer?.remove();
      this.bodyText?.setText(this.currentFull);
      this.typeIndex = this.currentFull.length;
      this.arrow?.setAlpha(1);
      this.onFinish?.();
    }
  }

  hide(onComplete?: () => void): void {
    if (!this.container) return;
    this.typeTimer?.remove();
    const origY = this.container.y;
    this.scene.tweens.add({
      targets: this.container, alpha: 0, y: origY + 10,
      duration: 180, ease: 'Sine.easeIn', onComplete,
    });
  }

  destroy(): void {
    this.typeTimer?.remove();
    this.container?.destroy();
  }
}

// ── Dialogue Choice ──────────────────────────────────────────────────────────

export interface ChoiceOption {
  label:    string;
  action:   () => void;
  disabled?: boolean;
}

export class DialogueChoice {
  private scene:     Phaser.Scene;
  private items:     Phaser.GameObjects.Container[] = [];
  private container?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(options: ChoiceOption[], anchorY: number): void {
    this.hide();
    const { width: W } = this.scene.scale;
    const ITEM_H = 30, ITEM_W = 300, GAP = 4;
    const totalH = options.length * (ITEM_H + GAP);
    const startY = anchorY - totalH - 12;

    this.items = options.map((opt, i) => {
      const isDisabled = opt.disabled ?? false;
      const bgColor  = isDisabled ? 0x222233 : 0x1a1a2e;
      const txtColor = isDisabled ? '#666677' : '#ddddff';
      const borderC  = isDisabled ? 0x444455 : 0x4466aa;

      const bg = this.scene.add.graphics()
        .fillStyle(bgColor, 0.9)
        .fillRoundedRect(0, 0, ITEM_W, ITEM_H, 5)
        .lineStyle(1, borderC, 0.8)
        .strokeRoundedRect(0, 0, ITEM_W, ITEM_H, 5);

      const txt = this.scene.add.text(12, ITEM_H / 2, `▶  ${opt.label}`, {
        fontSize: '13px', fontFamily: '"Noto Sans KR", sans-serif', color: txtColor,
      }).setOrigin(0, 0.5);

      const itemX = W / 2 - ITEM_W / 2 - 20;
      const item  = this.scene.add.container(
        itemX, startY + i * (ITEM_H + GAP), [bg, txt],
      ).setDepth(182).setScrollFactor(0).setAlpha(0);

      if (!isDisabled) {
        bg.setInteractive(
          new Phaser.Geom.Rectangle(0, 0, ITEM_W, ITEM_H),
          Phaser.Geom.Rectangle.Contains,
        );
        bg.on('pointerover', () => {
          bg.clear()
            .fillStyle(0x2a2a4e, 0.95).fillRoundedRect(0, 0, ITEM_W, ITEM_H, 5)
            .lineStyle(1.5, 0x88aaff, 1).strokeRoundedRect(0, 0, ITEM_W, ITEM_H, 5);
          txt.setColor('#ffffff');
          this.scene.tweens.add({ targets: item, scaleX: 1.02, scaleY: 1.02, duration: 80 });
        });
        bg.on('pointerout', () => {
          bg.clear()
            .fillStyle(bgColor, 0.9).fillRoundedRect(0, 0, ITEM_W, ITEM_H, 5)
            .lineStyle(1, borderC, 0.8).strokeRoundedRect(0, 0, ITEM_W, ITEM_H, 5);
          txt.setColor(txtColor);
          this.scene.tweens.add({ targets: item, scaleX: 1, scaleY: 1, duration: 80 });
        });
        bg.on('pointerdown', () => { this.hide(); opt.action(); });
      }

      this.scene.tweens.add({
        targets: item, alpha: 1, x: itemX + 20,
        duration: 160, delay: i * 55, ease: 'Cubic.easeOut',
      });

      return item;
    });

    this.container = this.scene.add.container(0, 0, this.items).setScrollFactor(0);
  }

  hide(): void {
    this.items.forEach(item => {
      this.scene.tweens.add({
        targets: item, alpha: 0, duration: 100,
        onComplete: () => item.destroy(),
      });
    });
    this.items = [];
    this.container?.destroy();
    this.container = undefined;
  }

  destroy(): void { this.hide(); }
}
