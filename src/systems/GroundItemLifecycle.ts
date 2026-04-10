import Phaser from 'phaser';

export class GroundItemLifecycle {
  private blinkTween: Phaser.Tweens.Tween | null = null;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  startSlowBlink(icon: Phaser.GameObjects.Image): void {
    this.blinkTween?.stop();
    this.blinkTween = this.scene.tweens.add({
      targets: icon,
      alpha: { from: 1.0, to: 0.4 },
      duration: 1000, yoyo: true, repeat: -1
    });
  }

  startFastBlink(icon: Phaser.GameObjects.Image): void {
    this.blinkTween?.stop();
    icon.setTint(0xffaa44);
    this.blinkTween = this.scene.tweens.add({
      targets: icon,
      alpha: { from: 1.0, to: 0.2 },
      duration: 300, yoyo: true, repeat: -1
    });
  }

  despawn(icon: Phaser.GameObjects.Image): void {
    this.blinkTween?.stop();
    this.scene.tweens.killTweensOf(icon);

    this.scene.tweens.add({
      targets: icon,
      y: icon.y + 12,
      alpha: 0,
      scaleX: 0.5, scaleY: 0.5,
      duration: 400, ease: 'Quad.easeIn',
      onComplete: () => icon.destroy()
    });

    const emitter = this.scene.add.particles(icon.x, icon.y, 'fx_pixel', {
      tint:    [0x808080, 0xa0a0a0],
      speed:   { min: 8, max: 20 },
      angle:   { min: -110, max: -70 },
      scale:   { start: 0.8, end: 2.0 },
      alpha:   { start: 0.5, end: 0 },
      lifespan: 500, quantity: 3, emitting: false
    });
    emitter.setDepth(41);
    emitter.explode(3);
    this.scene.time.delayedCall(600, () => emitter.destroy());
  }

  destroy(): void {
    this.blinkTween?.stop();
  }
}
