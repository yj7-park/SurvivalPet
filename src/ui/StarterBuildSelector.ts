export interface BuildCardConfig {
  key:   string;
  label: string;
  emoji: string;
  desc:  string;
  color: number;
  stats: string;
}

export const BUILD_CARDS: BuildCardConfig[] = [
  { key: 'warrior',  label: '전사',   emoji: '⚔',  desc: '근접전 특화',    color: 0xcc4444, stats: 'STR+3 CON+2' },
  { key: 'scout',    label: '정찰자', emoji: '🏃',  desc: '이동·낚시 특화', color: 0x44cc88, stats: 'AGI+3 LUK+2' },
  { key: 'builder',  label: '건축가', emoji: '🔨',  desc: '제작·건설 특화', color: 0xcc8844, stats: 'INT+3 CON+2' },
  { key: 'survivor', label: '생존자', emoji: '🛡',  desc: 'HP·회복 특화',   color: 0x4488cc, stats: 'CON+3 INT+2' },
  { key: 'balanced', label: '균형',   emoji: '⚖',  desc: '전 능력치 균형',  color: 0xaaaaaa, stats: 'ALL+1'      },
];

export class StarterBuildSelector {
  private cards:       Phaser.GameObjects.Container[] = [];
  private selectedKey = 'balanced';

  show(scene: Phaser.Scene, onSelect: (key: string) => void): void {
    const W      = scene.cameras.main.width;
    const CY     = scene.cameras.main.height * 0.62;
    const CARD_W = 90, CARD_H = 110, GAP = 10;
    const totalW = BUILD_CARDS.length * (CARD_W + GAP) - GAP;
    const startX = (W - totalW) / 2;

    BUILD_CARDS.forEach((cfg, i) => {
      const cx = startX + i * (CARD_W + GAP) + CARD_W / 2;
      const container = scene.add.container(cx, CY + 60).setDepth(12);

      const bg = scene.add.graphics();
      this.drawCardBg(bg, CARD_W, CARD_H, cfg.color, false);

      const icon  = scene.add.text(0, -30, cfg.emoji, { fontSize: '22px' }).setOrigin(0.5);
      const nameT = scene.add.text(0, -4, cfg.label, {
        fontSize: '12px',
        color: `#${cfg.color.toString(16).padStart(6, '0')}`,
        fontFamily: 'Courier New', fontStyle: 'bold',
      }).setOrigin(0.5);
      const descT = scene.add.text(0, 14, cfg.desc, {
        fontSize: '9px', color: '#888888', fontFamily: 'Courier New',
      }).setOrigin(0.5);
      const statT = scene.add.text(0, 32, cfg.stats, {
        fontSize: '9px', color: '#ccccaa', fontFamily: 'Courier New',
      }).setOrigin(0.5);

      container.add([bg, icon, nameT, descT, statT]);
      container.setAlpha(0);
      container.setInteractive(
        new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
        Phaser.Geom.Rectangle.Contains
      );

      scene.tweens.add({
        targets: container, alpha: 1, y: CY,
        duration: 300, delay: i * 80, ease: 'Back.easeOut',
      });

      container.on('pointerover', () => {
        if (this.selectedKey !== cfg.key) {
          bg.clear();
          this.drawCardBg(bg, CARD_W, CARD_H, cfg.color, true);
        }
        scene.tweens.add({ targets: container, scaleX: 1.06, scaleY: 1.06, duration: 100 });
      });

      container.on('pointerout', () => {
        if (this.selectedKey !== cfg.key) {
          bg.clear();
          this.drawCardBg(bg, CARD_W, CARD_H, cfg.color, false);
        }
        scene.tweens.add({ targets: container, scaleX: 1.0, scaleY: 1.0, duration: 100 });
      });

      container.on('pointerdown', () => {
        this.selectedKey = cfg.key;
        this.updateSelected(scene, CARD_W, CARD_H);
        onSelect(cfg.key);
        this.playSelectEffect(scene, container, cfg.color);
      });

      this.cards.push(container);
    });

    // default highlight
    this.updateSelected(scene, CARD_W, CARD_H);
  }

  private drawCardBg(
    g: Phaser.GameObjects.Graphics,
    w: number, h: number,
    color: number,
    hover: boolean
  ): void {
    g.fillStyle(hover ? color : 0x111111, hover ? 0.15 : 0.85);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.lineStyle(2, color, hover ? 1.0 : 0.7);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
  }

  private updateSelected(scene: Phaser.Scene, w: number, h: number): void {
    this.cards.forEach((container, i) => {
      const cfg = BUILD_CARDS[i];
      const bg  = container.list[0] as Phaser.GameObjects.Graphics;
      bg.clear();
      const isSelected = cfg.key === this.selectedKey;
      bg.fillStyle(isSelected ? cfg.color : 0x111111, isSelected ? 0.2 : 0.85);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
      bg.lineStyle(isSelected ? 2.5 : 2, cfg.color, isSelected ? 1.0 : 0.7);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);

      if (isSelected) {
        scene.tweens.add({ targets: container, scaleX: 1.06, scaleY: 1.06, duration: 120 });
      } else {
        scene.tweens.add({ targets: container, scaleX: 1.0, scaleY: 1.0, duration: 100 });
      }
    });
  }

  private playSelectEffect(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    color: number
  ): void {
    const emitter = scene.add.particles(container.x, container.y, '__DEFAULT', {
      speed:    { min: 30, max: 80 },
      scale:    { start: 0.5, end: 0 },
      lifespan: 400, quantity: 8,
      tint: color,
      blendMode: Phaser.BlendModes.ADD,
    });
    emitter.setDepth(13);
    emitter.explode(8);
    scene.time.delayedCall(500, () => emitter.destroy());

    scene.tweens.add({
      targets: container,
      scaleX: 1.15, scaleY: 1.15,
      duration: 100, ease: 'Back.easeOut', yoyo: true,
    });
  }

  destroy(): void {
    this.cards.forEach(c => c.destroy());
    this.cards = [];
  }
}
