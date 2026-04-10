import Phaser from 'phaser';

function playPickupReachEffect(scene: Phaser.Scene, x: number, y: number): void {
  const emitter = scene.add.particles(x, y - 8, 'fx_pixel', {
    tint:    [0xffffff, 0xffeeaa],
    speed:   { min: 20, max: 60 },
    angle:   { min: -150, max: -30 },
    scale:   { start: 0.8, end: 0 },
    lifespan: 250, quantity: 5, emitting: false
  });
  emitter.setDepth(55);
  emitter.explode(5);
  scene.time.delayedCall(300, () => emitter.destroy());
}

export function playPickupMagnet(
  scene: Phaser.Scene,
  icon: Phaser.GameObjects.Image,
  playerSprite: Phaser.GameObjects.Sprite,
  onReach: () => void
): void {
  scene.tweens.killTweensOf(icon);

  scene.tweens.add({
    targets: icon,
    x: playerSprite.x,
    y: playerSprite.y - 8,
    scaleX: 0.3, scaleY: 0.3,
    alpha: 0.6,
    duration: 250, ease: 'Quad.easeIn',
    onComplete: () => {
      icon.destroy();
      onReach();
      playPickupReachEffect(scene, playerSprite.x, playerSprite.y);
    }
  });

  const texKey = icon.texture.key;
  scene.time.addEvent({
    delay: 30, repeat: 7,
    callback: () => {
      if (!icon.active) return;
      const trail = scene.add.image(icon.x, icon.y, texKey)
        .setScale(icon.scaleX * 0.7)
        .setAlpha(0.3)
        .setDepth(icon.depth - 0.1);
      scene.tweens.add({
        targets: trail, alpha: 0, scaleX: 0, scaleY: 0,
        duration: 150,
        onComplete: () => trail.destroy()
      });
    }
  });
}
