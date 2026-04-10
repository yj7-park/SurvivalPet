import Phaser from 'phaser';

export function showTapFeedback(scene: Phaser.Scene, x: number, y: number): void {
  const gfx = scene.add.graphics().setScrollFactor(0).setDepth(74);
  const obj = { r: 4, a: 0.5 };
  scene.tweens.add({
    targets: obj, r: 20, a: 0,
    duration: 200, ease: 'Quad.easeOut',
    onUpdate: () => {
      gfx.clear();
      gfx.lineStyle(1.5, 0xffffff, obj.a);
      gfx.strokeCircle(x, y, obj.r);
    },
    onComplete: () => gfx.destroy()
  });
}
