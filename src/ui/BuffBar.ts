export interface BuffEntry {
  id:          string;
  type:        'buff' | 'debuff';
  icon:        string;
  color:       number;
  duration:    number;
  maxDuration: number;
  label:       string;
}

const BUFF_ICON_SIZE = 28;
const BUFF_GAP       = 4;

export class BuffBar {
  private scene:   Phaser.Scene;
  private anchorX: number;
  private anchorY: number;
  private buffs:   Map<string, {
    container:   Phaser.GameObjects.Container;
    timerGfx:    Phaser.GameObjects.Graphics;
    durationTxt: Phaser.GameObjects.Text;
    data:        BuffEntry;
  }> = new Map();

  constructor(scene: Phaser.Scene, anchorX: number, anchorY: number) {
    this.scene   = scene;
    this.anchorX = anchorX;
    this.anchorY = anchorY;
  }

  addBuff(entry: BuffEntry): void {
    this.removeBuff(entry.id);

    const S           = BUFF_ICON_SIZE;
    const isDebuff    = entry.type === 'debuff';
    const borderColor = isDebuff ? 0xff4444 : entry.color;

    const bg = this.scene.add.graphics()
      .fillStyle(0x111122, 0.9).fillRoundedRect(0, 0, S, S, 5)
      .lineStyle(1.5, borderColor, 0.9).strokeRoundedRect(0, 0, S, S, 5);

    const iconTxt = this.scene.add.text(S / 2, S / 2 - 2, entry.icon, {
      fontSize: '16px', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const durationTxt = this.scene.add.text(S / 2, S - 6, '', {
      fontSize: '8px', fontFamily: 'monospace', color: '#cccccc',
    }).setOrigin(0.5);

    const timerGfx = this.scene.add.graphics().setDepth(1);

    const container = this.scene.add.container(0, 0, [bg, timerGfx, iconTxt, durationTxt])
      .setDepth(170).setScrollFactor(0).setAlpha(0).setScale(0.5);

    this.scene.tweens.add({
      targets: container, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 200, ease: 'Back.easeOut',
    });

    if (isDebuff) {
      this.scene.tweens.add({
        targets: container, x: container.x + 3,
        yoyo: true, repeat: 3, duration: 40, ease: 'Linear',
      });
    }

    this.buffs.set(entry.id, { container, timerGfx, durationTxt, data: { ...entry } });
    this._layout();
  }

  update(delta: number): void {
    for (const [id, entry] of this.buffs) {
      entry.data.duration -= delta / 1000;

      if (entry.data.duration <= 0) {
        this._playExpireEffect(entry.container);
        this.buffs.delete(id);
        this._layout();
        continue;
      }

      const ratio = entry.data.duration / entry.data.maxDuration;
      const S     = BUFF_ICON_SIZE;

      entry.timerGfx.clear();
      if (ratio < 1) {
        const startAngle = -Math.PI / 2;
        const endAngle   = startAngle + Math.PI * 2 * (1 - ratio);
        const steps = Math.max(3, Math.floor((endAngle - startAngle) / 0.15));
        const points: { x: number; y: number }[] = [{ x: S / 2, y: S / 2 }];
        for (let i = 0; i <= steps; i++) {
          const a = startAngle + (endAngle - startAngle) * (i / steps);
          points.push({ x: S / 2 + Math.cos(a) * S, y: S / 2 + Math.sin(a) * S });
        }
        entry.timerGfx.fillStyle(0x000000, 0.55).fillPoints(points, true);
      }

      if (entry.data.duration <= 3) {
        entry.durationTxt.setText(Math.ceil(entry.data.duration).toString());
        entry.container.setAlpha(0.5 + 0.5 * Math.sin(Date.now() * 0.01));
      } else {
        entry.durationTxt.setText('');
        entry.container.setAlpha(1);
      }
    }
  }

  private _playExpireEffect(container: Phaser.GameObjects.Container): void {
    this.scene.tweens.add({
      targets: container, scaleX: 1.3, scaleY: 1.3, alpha: 0,
      duration: 250, ease: 'Expo.easeOut',
      onComplete: () => container.destroy(),
    });
  }

  private _layout(): void {
    let i = 0;
    for (const [, entry] of this.buffs) {
      this.scene.tweens.add({
        targets: entry.container,
        x: this.anchorX + i * (BUFF_ICON_SIZE + BUFF_GAP),
        y: this.anchorY,
        duration: 150, ease: 'Cubic.easeOut',
      });
      i++;
    }
  }

  removeBuff(id: string): void {
    const entry = this.buffs.get(id);
    if (!entry) return;
    entry.container.destroy();
    this.buffs.delete(id);
    this._layout();
  }

  destroy(): void {
    for (const [id] of this.buffs) this.removeBuff(id);
  }
}
