import Phaser from 'phaser';

export function applyWetEffect(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite,
  hasStatus: (id: string) => boolean
): void {
  playerSprite.setTint(0x88bbdd);

  const dripTimer = scene.time.addEvent({
    delay: 1500, loop: true,
    callback: () => {
      if (!hasStatus('wet')) return;
      const dx = Phaser.Math.Between(-8, 8);
      const drop = scene.add.graphics()
        .fillStyle(0x60b8f0, 0.7)
        .fillRect(0, 0, 2, 4)
        .setPosition(playerSprite.x + dx, playerSprite.y - 10)
        .setDepth(playerSprite.depth + 1);

      scene.tweens.add({
        targets: drop,
        y: drop.y + 18,
        alpha: 0, duration: 500, ease: 'Quad.easeIn',
        onComplete: () => drop.destroy()
      });
    }
  });
  playerSprite.setData('dripTimer', dripTimer);
}

export function removeWetEffect(playerSprite: Phaser.GameObjects.Sprite): void {
  const timer = playerSprite.getData('dripTimer') as Phaser.Time.TimerEvent | null;
  timer?.remove();
  playerSprite.setData('dripTimer', null);
}
