import Phaser from 'phaser';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export interface DropLaunchParams {
  itemId:  string;
  fromX:   number;
  fromY:   number;
  targetX: number;
  targetY: number;
  rarity:  ItemRarity;
  delay:   number;
}

const RARITY_COLORS: Record<ItemRarity, number> = {
  common:   0xd0d0d0,
  uncommon: 0x40c040,
  rare:     0x4060e0,
  epic:     0xc040c0,
};

export function playDropLandEffect(
  scene: Phaser.Scene,
  x: number, y: number,
  rarity: ItemRarity
): void {
  const color = RARITY_COLORS[rarity];

  const emitter = scene.add.particles(x, y, 'fx_pixel', {
    tint:    [color, 0xffffff],
    speed:   { min: 20, max: 50 },
    angle:   { min: -150, max: -30 },
    scale:   { start: 0.8, end: 0 },
    lifespan: 300, quantity: 3, emitting: false
  });
  emitter.setDepth(41);
  emitter.explode(3);
  scene.time.delayedCall(400, () => emitter.destroy());

  const gfx = scene.add.graphics().setDepth(39);
  const obj = { r: 2, a: 0.7 };
  scene.tweens.add({
    targets: obj, r: 16, a: 0,
    duration: 250, ease: 'Quad.easeOut',
    onUpdate: () => {
      gfx.clear();
      gfx.lineStyle(1.5, color, obj.a);
      gfx.strokeEllipse(x, y, obj.r * 2, obj.r * 0.6);
    },
    onComplete: () => gfx.destroy()
  });
}

export function playDropExplosion(scene: Phaser.Scene, x: number, y: number): void {
  const emitter = scene.add.particles(x, y, 'fx_pixel', {
    tint:    [0xf0c030, 0xffd060, 0xffffff],
    speed:   { min: 40, max: 100 },
    angle:   { min: 0, max: 360 },
    scale:   { start: 1.3, end: 0 },
    lifespan: 400, quantity: 6, emitting: false
  });
  emitter.setDepth(42);
  emitter.explode(6);
  scene.time.delayedCall(500, () => emitter.destroy());
}

export function spawnDropItem(
  scene: Phaser.Scene,
  p: DropLaunchParams,
  startGroundItemHover: (icon: Phaser.GameObjects.Image, rarity: ItemRarity) => void
): void {
  const texKey = `icon_${p.itemId}`;
  if (!scene.textures.exists(texKey)) return;

  const icon = scene.add.image(p.fromX, p.fromY, texKey)
    .setDepth(40)
    .setScale(0.9)
    .setAlpha(0);

  scene.tweens.add({
    targets: icon,
    alpha: { from: 0, to: 1 },
    scaleX: [0, 1.3, 1.0],
    scaleY: [0, 1.3, 1.0],
    delay: p.delay,
    duration: 150,
    ease: 'Back.easeOut'
  });

  const startX = p.fromX, startY = p.fromY;
  const endX   = p.targetX, endY = p.targetY;
  const peakY  = Math.min(startY, endY) - Phaser.Math.Between(20, 40);
  const obj    = { t: 0 };

  scene.tweens.add({
    targets: obj, t: 1,
    delay: p.delay, duration: 400, ease: 'Quad.easeOut',
    onUpdate: () => {
      const t = obj.t;
      icon.x = startX + (endX - startX) * t;
      icon.y = startY + (endY - startY) * t + (peakY - startY) * 4 * t * (1 - t);
      icon.angle = t * 180;
    },
    onComplete: () => {
      icon.angle = 0;
      playDropLandEffect(scene, endX, endY, p.rarity);
      startGroundItemHover(icon, p.rarity);
    }
  });
}

export function spawnMultiDrop(
  scene: Phaser.Scene,
  drops: { itemId: string; rarity: ItemRarity }[],
  fromX: number, fromY: number,
  startGroundItemHover: (icon: Phaser.GameObjects.Image, rarity: ItemRarity) => void
): void {
  drops.forEach((drop, i) => {
    const angle  = (i / drops.length) * Math.PI * 2;
    const spread = Phaser.Math.Between(20, 48);
    spawnDropItem(scene, {
      itemId:  drop.itemId,
      fromX, fromY,
      targetX: fromX + Math.cos(angle) * spread,
      targetY: fromY + Math.sin(angle) * spread * 0.6,
      rarity:  drop.rarity,
      delay:   i * 60
    }, startGroundItemHover);
  });
  playDropExplosion(scene, fromX, fromY);
}
