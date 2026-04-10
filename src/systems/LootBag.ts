import Phaser from 'phaser';
import { spawnDropItem, ItemRarity } from './DropSpawnEffect';

export interface GroundItemRef {
  itemId: string;
  rarity: ItemRarity;
}

export function drawLootBag(ctx: CanvasRenderingContext2D, count: number): void {
  ctx.fillStyle = '#c89020';
  ctx.beginPath();
  ctx.ellipse(8, 10, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#a07010';
  ctx.fillRect(5, 2, 6, 3);

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(5, 7, 2, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a1008';
  ctx.beginPath();
  ctx.arc(13, 3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c030';
  ctx.font = 'bold 5px "Courier New"';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.min(count, 99)}`, 13, 5);
}

export function registerLootBagTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('loot_bag')) return;
  const canvas = document.createElement('canvas');
  canvas.width = 18;
  canvas.height = 18;
  const ctx = canvas.getContext('2d')!;
  (ctx as any).imageSmoothingEnabled = false;
  drawLootBag(ctx, 0);
  scene.textures.addCanvas('loot_bag', canvas);
}

export function createLootBag(
  scene: Phaser.Scene,
  x: number, y: number,
  items: GroundItemRef[]
): Phaser.GameObjects.Image {
  registerLootBagTexture(scene);

  // Redraw with count
  const canvas = document.createElement('canvas');
  canvas.width = 18; canvas.height = 18;
  const ctx = canvas.getContext('2d')!;
  (ctx as any).imageSmoothingEnabled = false;
  drawLootBag(ctx, items.length);
  const key = `loot_bag_${items.length}`;
  if (!scene.textures.exists(key)) {
    scene.textures.addCanvas(key, canvas);
  }

  return scene.add.image(x, y, key).setDepth(40);
}

export function openLootBag(
  scene: Phaser.Scene,
  bagIcon: Phaser.GameObjects.Image,
  items: GroundItemRef[],
  startGroundItemHover: (icon: Phaser.GameObjects.Image, rarity: ItemRarity) => void
): void {
  const bx = bagIcon.x, by = bagIcon.y;
  bagIcon.destroy();

  items.forEach((item, i) => {
    const angle  = (i / items.length) * Math.PI * 2;
    spawnDropItem(scene, {
      itemId:  item.itemId,
      fromX:   bx, fromY:   by,
      targetX: bx + Math.cos(angle) * 28,
      targetY: by + Math.sin(angle) * 18,
      rarity:  item.rarity,
      delay:   i * 40
    }, startGroundItemHover);
  });
}
