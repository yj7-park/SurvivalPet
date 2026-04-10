import Phaser from 'phaser';

export function applyBurningEffect(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite,
  hasStatus: (id: string) => boolean,
  flashScreenVignette: (color: number, alpha: number, duration: number) => void
): void {
  playerSprite.setTint(0xffaa44);

  const fireEmitter = scene.add.particles(
    playerSprite.x, playerSprite.y + 4, 'fx_pixel',
    {
      tint:    [0xff4010, 0xff8020, 0xffcc40],
      speed:   { min: 10, max: 25 },
      angle:   { min: -120, max: -60 },
      scale:   { start: 1.0, end: 0 },
      alpha:   { start: 0.9, end: 0 },
      lifespan: { min: 200, max: 400 },
      frequency: 80,
      blendMode: Phaser.BlendModes.ADD
    }
  );
  fireEmitter.setDepth(playerSprite.depth - 1);
  playerSprite.setData('burnEmitter', fireEmitter);

  const vignetteTimer = scene.time.addEvent({
    delay: 1000, loop: true,
    callback: () => {
      if (!hasStatus('burning')) return;
      flashScreenVignette(0xff6020, 0.15, 300);
    }
  });
  playerSprite.setData('burnVignetteTimer', vignetteTimer);
}

export function removeBurningEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  const emitter = playerSprite.getData('burnEmitter') as Phaser.GameObjects.Particles.ParticleEmitter | null;
  emitter?.destroy();
  const timer = playerSprite.getData('burnVignetteTimer') as Phaser.Time.TimerEvent | null;
  timer?.remove();
  playerSprite.setData('burnEmitter', null);
  playerSprite.setData('burnVignetteTimer', null);
}
