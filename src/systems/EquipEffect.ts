import Phaser from 'phaser';

/**
 * 장착 arc 궤적 애니메이션 + 캐릭터 flash.
 */

/** 슬롯 아이콘이 장비 슬롯으로 날아가는 arc 애니메이션 */
export function playEquipFlyAnimation(
  scene: Phaser.Scene,
  fromPos: { x: number; y: number },
  toPos:   { x: number; y: number },
  iconKey: string,
): void {
  if (!scene.textures.exists(iconKey)) {
    flashEquipSlot(scene, toPos);
    return;
  }

  const flying = scene.add.image(fromPos.x, fromPos.y, iconKey)
    .setScrollFactor(0).setDepth(130).setScale(0.8);

  const startX = fromPos.x, startY = fromPos.y;
  const endX = toPos.x, endY = toPos.y;
  const peakY = Math.min(startY, endY) - 30;

  const proxy = { t: 0 };
  scene.tweens.add({
    targets: proxy,
    t: 1,
    duration: 300, ease: 'Quad.easeInOut',
    onUpdate: () => {
      const t = proxy.t;
      flying.x = startX + (endX - startX) * t;
      flying.y = startY + (endY - startY) * t + (peakY - startY) * 4 * t * (1 - t);
      flying.setScale(0.8 - t * 0.2);
    },
    onComplete: () => {
      flying.destroy();
      flashEquipSlot(scene, toPos);
    },
  });
}

/** 장착 슬롯 황금 빛남 효과 */
export function flashEquipSlot(
  scene: Phaser.Scene,
  pos: { x: number; y: number },
): void {
  const flash = scene.add.graphics().setScrollFactor(0).setDepth(130);
  flash.fillStyle(0xf0c030, 0.8);
  flash.fillRoundedRect(pos.x - 18, pos.y - 18, 36, 36, 4);
  scene.tweens.add({
    targets: flash, alpha: 0, duration: 300,
    onComplete: () => flash.destroy(),
  });
}

/** 아이템 장착 시 캐릭터 white flash + 금색 파티클 */
export function onItemEquipped(
  scene: Phaser.Scene,
  playerSprite: Phaser.GameObjects.Sprite,
): void {
  playerSprite.setTint(0xffffff);
  scene.time.delayedCall(80, () => playerSprite.clearTint());

  if (scene.textures.exists('fx_pixel')) {
    const emitter = scene.add.particles(
      playerSprite.x, playerSprite.y - 16,
      'fx_pixel',
      {
        tint:     [0xf0c030, 0xffee80],
        speed:    { min: 30, max: 60 },
        angle:    { min: -130, max: -50 },
        scale:    { start: 1.0, end: 0 },
        lifespan: 400,
        quantity: 4,
        emitting: false,
      },
    );
    emitter.explode(4);
    scene.time.delayedCall(500, () => emitter.destroy());
  }
}
