import Phaser from 'phaser';

export type StatusEffectId =
  | 'cold' | 'freezing' | 'wet' | 'poisoned'
  | 'burning' | 'exhausted' | 'starving' | 'bleeding';

export function applyExhaustedEffect(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite,
  hasStatus: (id: string) => boolean
): void {
  const anim = playerSprite.anims.currentAnim;
  if (anim) playerSprite.anims.msPerFrame = anim.msPerFrame * 2;
  playerSprite.setAlpha(0.75).setTint(0xcc88cc);

  const zTimer = scene.time.addEvent({
    delay: 2000, loop: true,
    callback: () => {
      if (!hasStatus('exhausted')) return;
      const z = scene.add.text(
        playerSprite.x + Phaser.Math.Between(-8, 8),
        playerSprite.y - 20, 'Z',
        { fontSize: '10px', fontFamily: 'Courier New',
          color: '#aa88cc', stroke: '#000', strokeThickness: 1 }
      ).setDepth(playerSprite.depth + 2).setAlpha(0.8);
      scene.tweens.add({
        targets: z, y: z.y - 24, alpha: 0,
        duration: 1800, ease: 'Quad.easeOut',
        onComplete: () => z.destroy()
      });
    }
  });
  playerSprite.setData('zTimer', zTimer);
}

export function applyStarvingEffect(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite,
  hasStatus: (id: string) => boolean
): void {
  playerSprite.setTint(0xcc9940);
  scene.tweens.add({
    targets: playerSprite,
    alpha: { from: 1.0, to: 0.6 },
    duration: 1200, ease: 'Sine.easeInOut',
    yoyo: true, repeat: -1
  });

  scene.time.addEvent({
    delay: 5000, loop: true,
    callback: () => {
      if (!hasStatus('starving')) return;
      const t = scene.add.text(playerSprite.x, playerSprite.y - 28, '배가 고파요...', {
        fontSize: '9px', fontFamily: 'Courier New',
        color: '#cc9940', stroke: '#000', strokeThickness: 2
      }).setDepth(playerSprite.depth + 2).setOrigin(0.5).setAlpha(0.9);
      scene.tweens.add({
        targets: t, y: t.y - 16, alpha: 0,
        duration: 1500, ease: 'Quad.easeOut',
        onComplete: () => t.destroy()
      });
    }
  });
}

export function applyBleedingEffect(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite,
  hasStatus: (id: string) => boolean
): void {
  playerSprite.setTint(0xee4444);

  const bloodTimer = scene.time.addEvent({
    delay: 800, loop: true,
    callback: () => {
      if (!hasStatus('bleeding')) return;
      const drop = scene.add.graphics()
        .fillStyle(0xcc1010, 0.8)
        .fillCircle(0, 0, 2)
        .setPosition(
          playerSprite.x + Phaser.Math.Between(-6, 6),
          playerSprite.y + 4
        )
        .setDepth(playerSprite.depth - 1);
      scene.tweens.add({
        targets: drop, y: drop.y + 10, alpha: 0,
        duration: 400, ease: 'Quad.easeIn',
        onComplete: () => drop.destroy()
      });
    }
  });
  playerSprite.setData('bloodTimer', bloodTimer);
}

export function clearStatusEffect(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite,
  id: StatusEffectId
): void {
  const keys: Record<StatusEffectId, string[]> = {
    cold:      ['breathTimer'],
    freezing:  ['freezeGraphics'],
    wet:       ['dripTimer'],
    poisoned:  ['poisonEmitter', 'poisonDmgTimer'],
    burning:   ['burnEmitter', 'burnVignetteTimer'],
    exhausted: ['zTimer'],
    starving:  [],
    bleeding:  ['bloodTimer'],
  };

  (keys[id] ?? []).forEach(key => {
    const obj = playerSprite.getData(key);
    if (obj) {
      if (typeof obj.destroy === 'function') obj.destroy();
      else if (typeof obj.remove === 'function') obj.remove();
      playerSprite.setData(key, null);
    }
  });

  scene.tweens.killTweensOf(playerSprite);
  playerSprite.clearTint().setAlpha(1.0);

  const emitter = scene.add.particles(playerSprite.x, playerSprite.y - 12, 'fx_pixel', {
    tint: [0xffffff, 0xeeeeff],
    speed: { min: 20, max: 50 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.8, end: 0 },
    lifespan: 400, quantity: 6, emitting: false
  });
  emitter.setDepth(playerSprite.depth + 2);
  emitter.explode(6);
  scene.time.delayedCall(500, () => emitter.destroy());
}
