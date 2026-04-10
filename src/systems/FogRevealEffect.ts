import Phaser from 'phaser';

export class FogRevealEffect {
  private pendingReveal = new Set<string>();
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  onNewTileRevealed(tx: number, ty: number): void {
    const key = `${tx},${ty}`;
    if (this.pendingReveal.has(key)) return;
    this.pendingReveal.add(key);

    const wx = tx * 32 + 16;
    const wy = ty * 32 + 16;

    const gfx = this.scene.add.graphics().setDepth(61);
    const obj = { r: 4, a: 0.4 };
    this.scene.tweens.add({
      targets: obj, r: 24, a: 0,
      duration: 400, ease: 'Quad.easeOut',
      onUpdate: () => {
        gfx.clear();
        gfx.fillStyle(0xffffff, obj.a * 0.3);
        gfx.fillCircle(wx, wy, obj.r);
      },
      onComplete: () => {
        gfx.destroy();
        this.pendingReveal.delete(key);
      }
    });
  }
}
