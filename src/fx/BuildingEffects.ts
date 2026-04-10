export function playConstructionCompleteEffect(
  scene: Phaser.Scene,
  tileX: number, tileY: number,
  tileW: number, tileH: number,
  buildingSprite?: Phaser.GameObjects.Image
): void {
  const px = tileX * 32, py = tileY * 32;
  const pw = tileW * 32, ph = tileH * 32;
  const cx = px + pw / 2, cy = py + ph / 2;

  for (let i = 0; i < 2; i++) {
    const ring = scene.add.graphics().setDepth(55);
    const obj  = { r: pw * 0.3 + i * 8 };
    const maxR = pw * 0.8 + i * 20;
    scene.tweens.add({
      targets: obj, r: maxR,
      duration: 500, delay: i * 80, ease: 'Quad.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(2 - i * 0.5, 0xf0c030, 1 - obj.r / maxR);
        ring.strokeCircle(cx, cy, obj.r);
      },
      onComplete: () => ring.destroy(),
    });
  }

  const emitter = scene.add.particles(cx, py, '__DEFAULT', {
    speed:    { min: 60, max: 140 },
    angle:    { min: -130, max: -50 },
    scale:    { start: 0.7, end: 0 },
    lifespan: 700, quantity: 20,
    tint:     [0xf0c030, 0xffffff, 0x88ffaa, 0xff88cc],
    blendMode: Phaser.BlendModes.ADD,
  }).setDepth(55);
  emitter.explode(20);
  scene.time.delayedCall(800, () => emitter.destroy());

  const txt = scene.add.text(cx, py - 10, '완공!', {
    fontSize: '16px', color: '#f0c030',
    fontFamily: 'Courier New', fontStyle: 'bold',
    stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5).setDepth(56);

  scene.tweens.add({
    targets: txt,
    y: py - 36, scaleX: 1.3, scaleY: 1.3,
    duration: 300, ease: 'Back.easeOut',
    yoyo: true, hold: 600,
    onComplete: () => {
      scene.tweens.add({
        targets: txt, alpha: 0, duration: 300,
        onComplete: () => txt.destroy(),
      });
    },
  });

  scene.cameras.main.shake(120, 0.004);

  if (buildingSprite) {
    scene.tweens.add({
      targets: buildingSprite,
      scaleX: 1.06, scaleY: 1.06,
      duration: 100, ease: 'Back.easeOut', yoyo: true,
    });
  }
}

export function playDemolishEffect(
  scene: Phaser.Scene,
  tileX: number, tileY: number,
  tileW: number, tileH: number,
  buildingSprite?: Phaser.GameObjects.Image
): void {
  const px = tileX * 32, py = tileY * 32;
  const pw = tileW * 32, ph = tileH * 32;
  const cx = px + pw / 2, cy = py + ph / 2;

  if (buildingSprite) {
    scene.tweens.add({
      targets: buildingSprite,
      x: buildingSprite.x + 3,
      duration: 60, yoyo: true, repeat: 4,
    });
  }

  const debris = scene.add.particles(cx, cy, '__DEFAULT', {
    speed:    { min: 40, max: 130 },
    angle:    { min: -150, max: -30 },
    scale:    { start: 0.5, end: 0 },
    lifespan: 700, quantity: 18,
    tint:     [0xc8b090, 0x888880, 0xaaa090],
    gravityY: 200,
  }).setDepth(55);
  debris.explode(18);
  scene.time.delayedCall(800, () => debris.destroy());

  scene.cameras.main.shake(200, 0.006);
}

export function playBuildingUpgradeEffect(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image
): void {
  const scanLine = scene.add.graphics().setDepth(sprite.depth + 2);
  const obj      = { y: sprite.y + sprite.height / 2 };
  const topY     = sprite.y - sprite.height / 2;

  scene.tweens.add({
    targets: obj, y: topY,
    duration: 500, ease: 'Linear',
    onUpdate: () => {
      scanLine.clear();
      scanLine.lineStyle(2, 0xf0c030, 0.7);
      scanLine.beginPath();
      scanLine.moveTo(sprite.x - sprite.width / 2 - 4, obj.y);
      scanLine.lineTo(sprite.x + sprite.width / 2 + 4, obj.y);
      scanLine.strokePath();
    },
    onComplete: () => {
      scanLine.destroy();
      sprite.setTint(0xffd966);
      scene.time.delayedCall(150, () => sprite.clearTint());
    },
  });
}
