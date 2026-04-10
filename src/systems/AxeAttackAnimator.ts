import { Direction, DIR_OFFSETS, DIR_BASE_ANGLES } from './WeaponAttackSystem';

export class AxeAttackAnimator {
  attack(
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction
  ): void {
    const hitX = attacker.x + DIR_OFFSETS[dir].x * 24;
    const hitY = attacker.y + DIR_OFFSETS[dir].y * 24;

    // 예비동작: 위로 살짝 들어올림
    scene.tweens.add({
      targets: attacker,
      y: attacker.y - 6,
      duration: 100, ease: 'Quad.easeOut',
      yoyo: true,
    });

    const gfx       = scene.add.graphics().setDepth(52);
    const baseAngle = DIR_BASE_ANGLES[dir];

    scene.tweens.add({
      targets: { t: 0 }, t: 1,
      duration: 180, ease: 'Quad.easeIn',
      onUpdate: (_tw: Phaser.Tweens.Tween, obj: { t: number }) => {
        gfx.clear();
        gfx.lineStyle(6, 0xe06020, 1 - obj.t * 0.8);
        gfx.beginPath();
        gfx.arc(attacker.x, attacker.y, 32,
          baseAngle - Math.PI * 0.3 + Math.PI * 0.6 * obj.t,
          baseAngle + Math.PI * 0.3 * obj.t);
        gfx.strokePath();
      },
      onComplete: () => {
        gfx.destroy();
        this.playImpactWave(scene, hitX, hitY);
        scene.cameras.main.shake(200, 0.010);
      },
    });
  }

  private playImpactWave(scene: Phaser.Scene, x: number, y: number): void {
    const gfx = scene.add.graphics().setDepth(51);
    scene.tweens.add({
      targets: { r: 4, a: 0.8 }, r: 56, a: 0,
      duration: 350, ease: 'Quad.easeOut',
      onUpdate: (_tw: Phaser.Tweens.Tween, obj: { r: number; a: number }) => {
        gfx.clear();
        gfx.lineStyle(3, 0xe06020, obj.a);
        gfx.strokeEllipse(x, y, obj.r * 2, obj.r * 0.6);
      },
      onComplete: () => gfx.destroy(),
    });

    const emitter = scene.add.particles(x, y, 'fx_pixel', {
      tint:     [0x808070, 0xa09060, 0xd0c080],
      speed:    { min: 40, max: 100 },
      angle:    { min: -160, max: -20 },
      gravityY: 200,
      scale:    { start: 1.2, end: 0 },
      lifespan: 400, quantity: 8, emitting: false,
    });
    emitter.setDepth(53);
    emitter.explode(8);
    scene.time.delayedCall(500, () => emitter.destroy());
  }
}
