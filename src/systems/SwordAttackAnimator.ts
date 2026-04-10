import { Direction, DIR_OFFSETS, DIR_BASE_ANGLES } from './WeaponAttackSystem';

export class SwordAttackAnimator {
  private comboCount  = 0;
  private lastHitTime = 0;
  private readonly COMBO_WINDOW = 800;

  attack(
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction
  ): void {
    const now = Date.now();
    if (now - this.lastHitTime > this.COMBO_WINDOW) this.comboCount = 0;
    const combo = (this.comboCount % 3) as 0 | 1 | 2;
    this.comboCount++;
    this.lastHitTime = now;
    this.playComboSlash(scene, attacker, dir, combo);
  }

  private playComboSlash(
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction,
    combo: 0 | 1 | 2
  ): void {
    const baseX = attacker.x + DIR_OFFSETS[dir].x * 20;
    const baseY = attacker.y + DIR_OFFSETS[dir].y * 20;

    const slashDef = [
      { angle: -45, color: 0xffffff, len: 36, width: 3, duration: 130 },
      { angle:  45, color: 0xffffff, len: 36, width: 3, duration: 130 },
      { angle:  90, color: 0xf0c030, len: 48, width: 5, duration: 200 },
    ][combo];

    const rad     = slashDef.angle * Math.PI / 180 + DIR_BASE_ANGLES[dir];
    const arcSpan = Math.PI * 0.55;
    const gfx     = scene.add.graphics().setDepth(52);

    scene.tweens.add({
      targets: { t: 0 }, t: 1,
      duration: slashDef.duration,
      ease: 'Quad.easeOut',
      onUpdate: (_tw: Phaser.Tweens.Tween, obj: { t: number }) => {
        gfx.clear();
        gfx.lineStyle(slashDef.width, slashDef.color, 1 - obj.t * 0.7);
        gfx.beginPath();
        gfx.arc(baseX, baseY, slashDef.len,
          rad - arcSpan * obj.t, rad + arcSpan * obj.t);
        gfx.strokePath();

        if (obj.t > 0.2) {
          gfx.lineStyle(slashDef.width - 1, slashDef.color, (1 - obj.t) * 0.3);
          gfx.beginPath();
          gfx.arc(baseX, baseY, slashDef.len,
            rad - arcSpan * (obj.t - 0.2), rad + arcSpan * (obj.t - 0.2));
          gfx.strokePath();
        }
      },
      onComplete: () => gfx.destroy(),
    });

    if (combo === 2) {
      const emitter = scene.add.particles(baseX, baseY, 'fx_pixel', {
        tint:     [0xf0c030, 0xffffff, 0xffee80],
        speed:    { min: 60, max: 140 },
        angle:    { min: rad * 180 / Math.PI - 60, max: rad * 180 / Math.PI + 60 },
        scale:    { start: 1.4, end: 0 },
        lifespan: 400, quantity: 10, emitting: false,
      });
      emitter.setDepth(53);
      emitter.explode(10);
      scene.time.delayedCall(500, () => emitter.destroy());
      scene.cameras.main.shake(120, 0.006);
    }
  }
}
