import Phaser from 'phaser';

export function createBreathParticles(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite,
  hasStatus: (id: string) => boolean,
  getPlayerFacingDir: () => string
): void {
  const offsets: Record<string, { dx: number; dy: number }> = {
    down:  { dx: 2,  dy: -8  },
    up:    { dx: 2,  dy: -20 },
    left:  { dx: -6, dy: -10 },
    right: { dx: 6,  dy: -10 },
  };

  const breathTimer = scene.time.addEvent({
    delay: 2500, loop: true,
    callback: () => {
      if (!hasStatus('cold') && !hasStatus('freezing')) return;
      const dir = getPlayerFacingDir();
      const off = offsets[dir] ?? { dx: 0, dy: -10 };

      const emitter = scene.add.particles(
        playerSprite.x + off.dx,
        playerSprite.y + off.dy,
        'fx_pixel',
        {
          tint:    [0xd0e8ff, 0xffffff],
          speed:   { min: 6, max: 14 },
          angle:   { min: -110, max: -70 },
          scale:   { start: 1.2, end: 2.8 },
          alpha:   { start: 0.55, end: 0 },
          lifespan: { min: 400, max: 700 },
          quantity: 3, emitting: false
        }
      );
      emitter.setDepth(playerSprite.depth + 1);
      emitter.explode(3);
      scene.time.delayedCall(800, () => emitter.destroy());
    }
  });
  playerSprite.setData('breathTimer', breathTimer);
}

export function startShiverEffect(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite
): void {
  scene.tweens.add({
    targets: playerSprite,
    x: playerSprite.x + 2,
    duration: 80, ease: 'Sine.easeInOut',
    yoyo: true, repeat: -1
  });
  playerSprite.setTint(0xaabbee);
}

export function stopShiverEffect(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite
): void {
  scene.tweens.killTweensOf(playerSprite);
  playerSprite.clearTint();
  playerSprite.setX(Math.round(playerSprite.x));
}

export function applyFreezingEffect(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite
): void {
  playerSprite.setTint(0x6688cc).setAlpha(0.75);

  const crystalGfx = scene.add.graphics()
    .setPosition(playerSprite.x, playerSprite.y)
    .setDepth(playerSprite.depth + 1);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = 18;
    const cx = Math.cos(angle) * r;
    const cy = Math.sin(angle) * r;
    crystalGfx.fillStyle(0xaaccff, 0.7);
    crystalGfx.fillTriangle(cx, cy - 4, cx - 2, cy + 3, cx + 2, cy + 3);
  }

  scene.tweens.add({
    targets: crystalGfx,
    alpha: { from: 0.8, to: 0.3 },
    duration: 600, yoyo: true, repeat: -1
  });

  playerSprite.setData('freezeGraphics', crystalGfx);
}
