import { Direction, DIR_OFFSETS, DIR_BASE_ANGLES } from './WeaponAttackSystem';

const OPPOSITE_DIR: Record<Direction, Direction> = {
  up:    'down',
  down:  'up',
  left:  'right',
  right: 'left',
};

export class DaggerAttackAnimator {
  attack(
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction
  ): void {
    this.quickSlash(scene, attacker, dir, 0, 0xffffff);

    scene.time.delayedCall(100, () => {
      this.quickSlash(scene, attacker, dir, 90, 0xffffff);

      const backDir = OPPOSITE_DIR[dir];
      const origX   = attacker.x;
      const origY   = attacker.y;

      scene.tweens.add({
        targets: attacker,
        x: origX + DIR_OFFSETS[backDir].x * 16,
        y: origY + DIR_OFFSETS[backDir].y * 16,
        duration: 80, ease: 'Quad.easeOut',
        onComplete: () => {
          scene.tweens.add({
            targets: attacker,
            x: origX, y: origY,
            duration: 150,
          });
        },
      });
    });
  }

  private quickSlash(
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction,
    angleOffset: number,
    color: number
  ): void {
    const gfx  = scene.add.graphics().setDepth(52);
    const base = DIR_BASE_ANGLES[dir] + angleOffset * Math.PI / 180;

    scene.tweens.add({
      targets: { t: 0 }, t: 1,
      duration: 80, ease: 'Linear',
      onUpdate: (_tw: Phaser.Tweens.Tween, obj: { t: number }) => {
        gfx.clear();
        gfx.lineStyle(2, color, 1 - obj.t);
        gfx.beginPath();
        gfx.arc(attacker.x, attacker.y, 24,
          base - 0.8 + 1.6 * obj.t, base + 0.8 * obj.t);
        gfx.strokePath();
      },
      onComplete: () => gfx.destroy(),
    });
  }
}
