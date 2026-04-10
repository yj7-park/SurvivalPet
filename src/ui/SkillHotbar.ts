export interface SkillSlotData {
  index:       number;
  icon:        string;
  label:       string;
  cooldown:    number;
  maxCooldown: number;
  mpCost:      number;
  active:      boolean;
  key:         string;
}

const SKILL = {
  SIZE:     48,
  GAP:       6,
  COUNT:     6,
  BG:        0x111122,
  ACTIVE:    0x4488ff,
  INACTIVE:  0x445566,
} as const;

export class SkillHotbar {
  private scene:   Phaser.Scene;
  private anchorX: number;
  private anchorY: number;
  private slots:   Map<number, {
    container:   Phaser.GameObjects.Container;
    cooldownGfx: Phaser.GameObjects.Graphics;
    cooldownTxt: Phaser.GameObjects.Text;
    data:        SkillSlotData;
  }> = new Map();

  constructor(scene: Phaser.Scene, anchorX: number, anchorY: number) {
    this.scene   = scene;
    this.anchorX = anchorX;
    this.anchorY = anchorY;
  }

  setSlot(data: SkillSlotData): void {
    this.removeSlot(data.index);
    this._buildSlot(data);
  }

  private _buildSlot(data: SkillSlotData): void {
    const S = SKILL.SIZE;
    const x = this.anchorX + data.index * (S + SKILL.GAP);
    const y = this.anchorY;

    const bg = this.scene.add.graphics()
      .fillStyle(SKILL.BG, 0.9).fillRoundedRect(0, 0, S, S, 6)
      .lineStyle(1.5, data.active ? SKILL.ACTIVE : SKILL.INACTIVE, 1)
      .strokeRoundedRect(0, 0, S, S, 6);

    const iconTxt = this.scene.add.text(S / 2, S / 2 - 4, data.icon, {
      fontSize: '22px', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const keyTxt = this.scene.add.text(4, 3, data.key, {
      fontSize: '9px', fontFamily: 'monospace', color: '#888888',
    });

    const mpTxt = this.scene.add.text(S - 4, S - 4, `${data.mpCost}`, {
      fontSize: '9px', fontFamily: 'monospace', color: '#4488ff',
    }).setOrigin(1, 1);

    const cooldownGfx = this.scene.add.graphics().setDepth(1);
    const cooldownTxt = this.scene.add.text(S / 2, S / 2, '', {
      fontSize: '14px', fontFamily: 'monospace',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(2);

    const container = this.scene.add.container(x, y, [
      bg, cooldownGfx, iconTxt, keyTxt, mpTxt, cooldownTxt,
    ]).setDepth(165).setScrollFactor(0);

    this.slots.set(data.index, { container, cooldownGfx, cooldownTxt, data: { ...data } });
  }

  update(delta: number): void {
    for (const [, slot] of this.slots) {
      if (slot.data.cooldown <= 0) {
        slot.cooldownGfx.clear();
        slot.cooldownTxt.setText('');
        continue;
      }

      slot.data.cooldown = Math.max(0, slot.data.cooldown - delta / 1000);

      const ratio = slot.data.cooldown / slot.data.maxCooldown;
      const S = SKILL.SIZE;
      const startA = -Math.PI / 2;
      const endA   = startA + Math.PI * 2 * ratio;
      const steps  = Math.max(4, Math.floor((endA - startA) / 0.12));
      const pts: { x: number; y: number }[] = [{ x: S / 2, y: S / 2 }];
      for (let i = 0; i <= steps; i++) {
        const a = startA + (endA - startA) * (i / steps);
        pts.push({ x: S / 2 + Math.cos(a) * S, y: S / 2 + Math.sin(a) * S });
      }
      slot.cooldownGfx.clear().fillStyle(0x000000, 0.65).fillPoints(pts, true);

      slot.cooldownTxt.setText(
        slot.data.cooldown >= 1
          ? Math.ceil(slot.data.cooldown).toString()
          : slot.data.cooldown.toFixed(1)
      );

      if (slot.data.cooldown < 0.5) {
        slot.cooldownGfx.setAlpha(0.5 + 0.5 * Math.sin(Date.now() * 0.02));
      }
    }
  }

  playCooldownReady(index: number): void {
    const slot = this.slots.get(index);
    if (!slot) return;

    this.scene.tweens.add({
      targets: slot.container, scaleX: 1.15, scaleY: 1.15,
      yoyo: true, duration: 150, ease: 'Back.easeOut',
    });

    const x = slot.container.x + SKILL.SIZE / 2;
    const y = slot.container.y + SKILL.SIZE / 2;
    const ring = this.scene.add.graphics()
      .lineStyle(2, 0xffdd44, 1)
      .strokeCircle(x, y, SKILL.SIZE / 2)
      .setDepth(166).setScrollFactor(0);

    this.scene.tweens.add({
      targets: ring, scaleX: 2, scaleY: 2, alpha: 0,
      duration: 350, ease: 'Expo.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  playActivate(index: number): void {
    const slot = this.slots.get(index);
    if (!slot) return;
    this.scene.tweens.add({
      targets: slot.container, scaleX: 0.88, scaleY: 0.88,
      yoyo: true, duration: 80, ease: 'Sine.easeOut',
    });
  }

  removeSlot(index: number): void {
    this.slots.get(index)?.container.destroy();
    this.slots.delete(index);
  }

  destroy(): void {
    for (const [i] of this.slots) this.removeSlot(i);
  }
}
