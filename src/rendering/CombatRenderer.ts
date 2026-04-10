import Phaser from 'phaser';

const MAX_DAMAGE_POPUPS = 6;

interface PopupEntry {
  text: Phaser.GameObjects.Text;
  life: number;
  totalLife: number;
  vy: number;
}

export class CombatRenderer {
  private scene: Phaser.Scene;
  private hitVignette: Phaser.GameObjects.Graphics;
  private popups: PopupEntry[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const W = scene.scale.width;
    const H = scene.scale.height;
    this.hitVignette = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(90)
      .setAlpha(0);
    void W; void H;
  }

  /** Damage / heal number popup */
  spawnDamagePopup(wx: number, wy: number, value: number, isCrit = false, isHeal = false): void {
    // Prune oldest if at cap
    if (this.popups.length >= MAX_DAMAGE_POPUPS) {
      const oldest = this.popups.shift()!;
      oldest.text.destroy();
    }

    const color  = isHeal ? '#44ff88' : isCrit ? '#ffdd00' : '#ffffff';
    const size   = isCrit ? '16px' : isHeal ? '14px' : '13px';
    const prefix = isHeal ? '+' : '-';
    const ox     = Phaser.Math.Between(-12, 12);
    const totalLife = isCrit ? 900 : 700;

    const text = this.scene.add.text(wx + ox, wy - 20, `${prefix}${value}`, {
      fontSize: size,
      fontFamily: '"Courier New", monospace',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(80);

    if (isCrit) {
      this.scene.tweens.add({
        targets: text,
        scale: 1.6,
        duration: 150,
        yoyo: true,
      });
    }

    this.popups.push({ text, life: totalLife, totalLife, vy: isCrit ? -55 : -40 });
  }

  /** Red edge vignette when player takes a hit. intensity 0..1 */
  flashHitVignette(intensity = 0.5): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const size = Math.round(Math.min(intensity, 1) * 60 + 20);

    this.hitVignette.clear();
    this.hitVignette.fillStyle(0xcc0000, 0.55);
    this.hitVignette.fillRect(0, 0, W, size);
    this.hitVignette.fillRect(0, H - size, W, size);
    this.hitVignette.fillRect(0, 0, size, H);
    this.hitVignette.fillRect(W - size, 0, size, H);
    this.hitVignette.setAlpha(1);

    this.scene.tweens.add({
      targets: this.hitVignette,
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeOut',
    });
  }

  /** Melee slash arc at world position */
  spawnSlashEffect(wx: number, wy: number, angle = 0): void {
    const gfx = this.scene.add.graphics().setDepth(15);
    gfx.lineStyle(3, 0xffffff, 0.85);
    gfx.beginPath();
    const r = 18;
    gfx.arc(wx, wy, r, angle - 0.9, angle + 0.9, false);
    gfx.strokePath();

    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => gfx.destroy(),
    });

    // Echo afterimage
    this.scene.time.delayedCall(80, () => {
      const echo = this.scene.add.graphics().setDepth(14).setAlpha(0.3);
      echo.lineStyle(2, 0xffffff, 0.4);
      echo.beginPath();
      echo.arc(wx, wy, r * 1.1, angle - 0.9, angle + 0.9, false);
      echo.strokePath();
      this.scene.tweens.add({
        targets: echo, alpha: 0, duration: 100,
        onComplete: () => echo.destroy(),
      });
    });
  }

  /** Enemy detection exclamation emote */
  spawnDetectEmote(wx: number, wy: number): void {
    const mark = this.scene.add.text(wx, wy - 36, '!', {
      fontSize: '18px',
      fontFamily: '"Courier New", monospace',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(80);

    this.scene.tweens.add({
      targets: mark,
      y: mark.y - 12,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => mark.destroy(),
    });

    this.scene.cameras.main.shake(80, 0.004);
  }

  /** AoE warning circle then explosion */
  spawnAoeWarning(wx: number, wy: number, onExplode: () => void): void {
    const gfx = this.scene.add.graphics().setDepth(20);
    gfx.lineStyle(2, 0xff2222, 0.7);
    gfx.strokeCircle(wx, wy, 48);

    this.scene.tweens.add({
      targets: gfx,
      alpha: { from: 0.3, to: 0.9 },
      duration: 200,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        gfx.destroy();
        onExplode();
        this.spawnAoeExplosion(wx, wy);
      },
    });
  }

  private spawnAoeExplosion(wx: number, wy: number): void {
    const burst = this.scene.add.circle(wx, wy, 4, 0xff6600, 0.8).setDepth(20);
    this.scene.tweens.add({
      targets: burst, scale: 12, alpha: 0, duration: 300,
      ease: 'Quad.easeOut', onComplete: () => burst.destroy(),
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const chip = this.scene.add.rectangle(
        wx, wy, 4, 4, 0xff8840,
      ).setDepth(20);
      this.scene.tweens.add({
        targets: chip,
        x: wx + Math.cos(a) * 80,
        y: wy + Math.sin(a) * 80,
        alpha: 0,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => chip.destroy(),
      });
    }
  }

  update(delta: number): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= delta;
      p.text.y += p.vy * (delta / 1000);
      p.text.setAlpha(Math.max(0, p.life / p.totalLife));
      if (p.life <= 0) {
        p.text.destroy();
        this.popups.splice(i, 1);
      }
    }
  }

  destroy(): void {
    this.hitVignette.destroy();
    this.popups.forEach(p => p.text.destroy());
    this.popups = [];
  }
}
