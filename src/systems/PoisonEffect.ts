import Phaser from 'phaser';

export function applyPoisonEffect(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite,
  hasStatus: (id: string) => boolean,
  spawnDamagePopup: (x: number, y: number, dmg: number, type: string) => void
): void {
  playerSprite.setTint(0x88cc88);

  const bubbleEmitter = scene.add.particles(
    playerSprite.x, playerSprite.y - 8, 'fx_pixel',
    {
      tint:    [0x40cc40, 0x60e060, 0x80ff80],
      speed:   { min: 5, max: 15 },
      angle:   { min: -120, max: -60 },
      scale:   { start: 0.8, end: 1.6 },
      alpha:   { start: 0.7, end: 0 },
      lifespan: { min: 600, max: 1200 },
      frequency: 400
    }
  );
  bubbleEmitter.setDepth(playerSprite.depth + 1);
  playerSprite.setData('poisonEmitter', bubbleEmitter);

  const dmgTimer = scene.time.addEvent({
    delay: 2000, loop: true,
    callback: () => {
      if (!hasStatus('poisoned')) return;
      spawnDamagePopup(playerSprite.x, playerSprite.y - 24, -3, 'poison');
    }
  });
  playerSprite.setData('poisonDmgTimer', dmgTimer);
}

export function removePoisonEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  const emitter = playerSprite.getData('poisonEmitter') as Phaser.GameObjects.Particles.ParticleEmitter | null;
  emitter?.destroy();
  const timer = playerSprite.getData('poisonDmgTimer') as Phaser.Time.TimerEvent | null;
  timer?.remove();
  playerSprite.setData('poisonEmitter', null);
  playerSprite.setData('poisonDmgTimer', null);
}
