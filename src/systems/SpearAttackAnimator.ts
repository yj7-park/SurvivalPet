import { Direction, DIR_OFFSETS } from './WeaponAttackSystem';

export class SpearAttackAnimator {
  attack(
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction
  ): void {
    const reach = 48;
    const dx    = DIR_OFFSETS[dir].x;
    const dy    = DIR_OFFSETS[dir].y;
    const endX  = attacker.x + dx * reach;
    const endY  = attacker.y - 4 + dy * reach;

    const gfx = scene.add.graphics().setDepth(52);

    scene.tweens.add({
      targets: { t: 0 }, t: 1,
      duration: 100, ease: 'Quad.easeOut',
      yoyo: true, hold: 80,
      onUpdate: (_tw: Phaser.Tweens.Tween, obj: { t: number }) => {
        gfx.clear();
        gfx.lineStyle(3, 0xa0c0d0, 1 - obj.t * 0.3);
        gfx.lineBetween(
          attacker.x, attacker.y - 4,
          attacker.x + dx * reach * obj.t,
          attacker.y - 4 + dy * reach * obj.t
        );
        if (obj.t > 0.7) {
          gfx.fillStyle(0xffffff, (obj.t - 0.7) / 0.3);
          gfx.fillCircle(endX, endY, 4);
        }
      },
      onComplete: () => gfx.destroy(),
    });

    // 찌르기 잔상 trail
    for (let i = 1; i <= 3; i++) {
      scene.time.delayedCall(i * 15, () => {
        const trail = scene.add.graphics().setDepth(51);
        trail.lineStyle(1, 0xa0c0d0, 0.2);
        trail.lineBetween(
          attacker.x - dx * i * 4,
          attacker.y - 4 - dy * i * 4,
          endX - dx * i * 4,
          endY - dy * i * 4
        );
        scene.tweens.add({
          targets: trail, alpha: 0, duration: 150,
          onComplete: () => trail.destroy(),
        });
      });
    }
  }
}
