import { Direction, DIR_OFFSETS } from './WeaponAttackSystem';

export class BowAttackAnimator {
  private chargeStart = 0;
  private chargeGfx:  Phaser.GameObjects.Graphics | null = null;
  private chargeTimer: Phaser.Time.TimerEvent | null = null;
  private readonly MAX_CHARGE = 1200;

  startCharge(scene: Phaser.Scene, attacker: Phaser.GameObjects.Sprite): void {
    this.chargeStart = Date.now();
    this.chargeGfx   = scene.add.graphics().setDepth(52);

    this.chargeTimer = scene.time.addEvent({
      delay: 50, repeat: -1,
      callback: () => {
        if (!this.chargeGfx) return;
        const ratio = Math.min(1, (Date.now() - this.chargeStart) / this.MAX_CHARGE);
        this.chargeGfx.clear();

        const r = 32 - ratio * 20;
        this.chargeGfx.lineStyle(2, 0x80d0ff, ratio * 0.6);
        this.chargeGfx.strokeCircle(attacker.x, attacker.y - 8, r);

        if (ratio >= 1.0) {
          this.chargeGfx.lineStyle(3, 0xf0c030, 0.8);
          this.chargeGfx.strokeCircle(attacker.x, attacker.y - 8, 12);
        }
      },
    });
  }

  release(
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction
  ): void {
    const charge = Math.min(1.0, (Date.now() - this.chargeStart) / this.MAX_CHARGE);
    this.chargeTimer?.remove();
    this.chargeGfx?.destroy();
    this.chargeGfx  = null;
    this.chargeTimer = null;

    // 화살 발사체 (간단한 그래픽으로 표현)
    const arrow = scene.add.graphics().setDepth(52);
    arrow.fillStyle(0xd0b060, 1).fillRect(-8, -1, 16, 2);

    const startX = attacker.x;
    const startY = attacker.y - 8;
    const speed  = 280 * (1.0 + charge * 0.8);
    const vx     = DIR_OFFSETS[dir].x;
    const vy     = DIR_OFFSETS[dir].y;

    arrow.setPosition(startX, startY);
    const dist    = 320 + charge * 80;
    const durMs   = (dist / speed) * 1000;

    scene.tweens.add({
      targets: arrow,
      x: startX + vx * dist,
      y: startY + vy * dist,
      duration: durMs,
      ease: 'Linear',
      onComplete: () => arrow.destroy(),
    });

    // 발사 섬광
    const flash = scene.add.graphics().setDepth(53);
    flash.lineStyle(2, 0xffffff, 0.9);
    flash.strokeCircle(startX, startY, 8);
    scene.tweens.add({
      targets: flash, alpha: 0, scaleX: 2, scaleY: 2,
      duration: 150, onComplete: () => flash.destroy(),
    });

    // 풀차징 충격파 링
    if (charge >= 0.9) {
      const shockwave = scene.add.graphics().setDepth(53);
      scene.tweens.add({
        targets: { r: 8, a: 0.7 }, r: 40, a: 0,
        duration: 250, ease: 'Quad.easeOut',
        onUpdate: (_tw: Phaser.Tweens.Tween, obj: { r: number; a: number }) => {
          shockwave.clear();
          shockwave.lineStyle(2, 0xf0c030, obj.a);
          shockwave.strokeCircle(startX, startY, obj.r);
        },
        onComplete: () => shockwave.destroy(),
      });
    }
  }

  cancelCharge(): void {
    this.chargeTimer?.remove();
    this.chargeGfx?.destroy();
    this.chargeGfx  = null;
    this.chargeTimer = null;
  }
}
