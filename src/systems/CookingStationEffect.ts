import Phaser from 'phaser';

export function startCookingEffect(scene: Phaser.Scene, station: Phaser.GameObjects.Image): void {
  const { x, y } = station;

  const emitters = [x - 10, x + 10].map(bx =>
    scene.add.particles(bx, y - 4, 'fx_pixel', {
      tint:      [0xff8010, 0xffb020, 0xffcc40],
      speed:     { min: 8, max: 20 },
      angle:     { min: -110, max: -70 },
      scale:     { start: 0.7, end: 0 },
      alpha:     { start: 0.9, end: 0 },
      lifespan:  { min: 200, max: 500 },
      frequency: 100,
      blendMode: Phaser.BlendModes.ADD
    }).setDepth(station.depth + 1)
  );

  const lid = scene.add.graphics()
    .setPosition(x - 10, y - 14)
    .setDepth(station.depth + 2);
  lid.fillStyle(0xa0a0b0, 1.0).fillEllipse(0, 0, 18, 6);

  scene.tweens.add({
    targets: lid,
    y: lid.y - 2,
    duration: 300, ease: 'Sine.easeInOut',
    yoyo: true, repeat: -1
  });

  const steamEmitter = scene.add.particles(x - 10, y - 18, 'fx_pixel', {
    tint:      [0xd0d0d0, 0xe8e8e8],
    speed:     { min: 5, max: 12 },
    angle:     { min: -110, max: -70 },
    scale:     { start: 1.0, end: 2.0 },
    alpha:     { start: 0.5, end: 0 },
    lifespan:  600, frequency: 150
  }).setDepth(station.depth + 3);

  station.setData('cookingEmitters', [...emitters, steamEmitter, lid]);
}

export function stopCookingEffect(station: Phaser.GameObjects.Image): void {
  const objects: (Phaser.GameObjects.Particles.ParticleEmitter | Phaser.GameObjects.Graphics)[]
    = station.getData('cookingEmitters') ?? [];
  objects.forEach(o => o.destroy());
  station.setData('cookingEmitters', null);
}

export function drawFurniturePlacementPreview(
  gfx: Phaser.GameObjects.Graphics,
  tw: number, th: number,
  worldX: number, worldY: number,
  valid: boolean
): void {
  const color = valid ? 0x40c040 : 0xe03020;
  const alpha = valid ? 0.3 : 0.4;

  gfx.clear();
  gfx.fillStyle(color, alpha);
  gfx.fillRect(worldX, worldY, tw * 32, th * 32);

  gfx.lineStyle(1, color, 0.8);
  gfx.strokeRect(worldX, worldY, tw * 32, th * 32);

  if (tw > 1 || th > 1) {
    gfx.lineStyle(1, color, 0.3);
    for (let c = 1; c < tw; c++) {
      gfx.lineBetween(worldX + c * 32, worldY, worldX + c * 32, worldY + th * 32);
    }
    for (let r = 1; r < th; r++) {
      gfx.lineBetween(worldX, worldY + r * 32, worldX + tw * 32, worldY + r * 32);
    }
  }
}
