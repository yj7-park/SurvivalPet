import { Direction, DIR_OFFSETS } from './WeaponAttackSystem';

export class StaffAttackAnimator {
  attack(
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction
  ): void {
    const castX = attacker.x + DIR_OFFSETS[dir].x * 28;
    const castY = attacker.y + DIR_OFFSETS[dir].y * 28;

    this.drawMagicCircle(scene, castX, castY);

    const orb     = scene.add.graphics().setDepth(52);
    const orbGlow = scene.add.graphics().setDepth(51);
    orb.fillStyle(0x8040ff, 1.0).fillCircle(0, 0, 6);
    orbGlow.fillStyle(0xc080ff, 0.3).fillCircle(0, 0, 12);

    const startX = attacker.x;
    const startY = attacker.y - 8;
    orb.setPosition(startX, startY);
    orbGlow.setPosition(startX, startY);

    const vx = DIR_OFFSETS[dir].x * 200;
    const vy = DIR_OFFSETS[dir].y * 200;

    scene.tweens.add({
      targets: { t: 0 }, t: 1, duration: 600,
      onUpdate: (_tw: Phaser.Tweens.Tween, obj: { t: number }) => {
        const nx = startX + vx * obj.t;
        const ny = startY + vy * obj.t;
        orb.setPosition(nx, ny);
        orbGlow.setPosition(nx, ny);
        orb.setAngle(obj.t * 360);
      },
      onComplete: () => {
        const ix = orb.x, iy = orb.y;
        orb.destroy();
        orbGlow.destroy();
        this.playOrbImpact(scene, ix, iy);
      },
    });
  }

  private drawMagicCircle(scene: Phaser.Scene, x: number, y: number): void {
    const gfx = scene.add.graphics().setDepth(50);
    let angle = 0;

    const ev = scene.time.addEvent({
      delay: 16, repeat: 30,
      callback: () => {
        angle += 6;
        gfx.clear();
        gfx.lineStyle(1, 0x8040ff, 0.7);
        gfx.strokeCircle(x, y, 24);
        gfx.lineStyle(1, 0xc080ff, 0.5);
        const hex: [number, number][] = [];
        for (let i = 0; i < 6; i++) {
          const a = (angle + i * 60) * Math.PI / 180;
          hex.push([x + Math.cos(a) * 16, y + Math.sin(a) * 10]);
        }
        gfx.beginPath();
        gfx.moveTo(hex[0][0], hex[0][1]);
        hex.slice(1).forEach(p => gfx.lineTo(p[0], p[1]));
        gfx.closePath();
        gfx.strokePath();
      },
    });

    scene.time.delayedCall(500, () => {
      ev.remove();
      scene.tweens.add({
        targets: gfx, alpha: 0, duration: 200,
        onComplete: () => gfx.destroy(),
      });
    });
  }

  private playOrbImpact(scene: Phaser.Scene, x: number, y: number): void {
    const emitter = scene.add.particles(x, y, 'fx_pixel', {
      tint:      [0x8040ff, 0xc080ff, 0xffffff],
      speed:     { min: 50, max: 120 },
      angle:     { min: 0, max: 360 },
      scale:     { start: 1.2, end: 0 },
      lifespan:  400, quantity: 12, emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    });
    emitter.setDepth(53);
    emitter.explode(12);
    scene.time.delayedCall(500, () => emitter.destroy());
  }
}
