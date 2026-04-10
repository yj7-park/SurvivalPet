export function playBuffApplyEffect(
  scene: Phaser.Scene,
  worldX: number, worldY: number,
  type: 'heal' | 'strength' | 'speed' | 'shield' | 'poison',
): void {
  const colorMap: Record<typeof type, number> = {
    heal:     0x44ff88,
    strength: 0xff4444,
    speed:    0x44ffff,
    shield:   0x8888ff,
    poison:   0x88ff44,
  };
  const color = colorMap[type];

  for (let i = 0; i < 6; i++) {
    const px  = worldX + Phaser.Math.Between(-12, 12);
    const dot = scene.add.graphics()
      .fillStyle(color, 0.9)
      .fillCircle(0, 0, Phaser.Math.Between(2, 4))
      .setPosition(px, worldY + 8).setDepth(65);

    scene.tweens.add({
      targets: dot,
      y: worldY - 24 - Phaser.Math.Between(0, 12),
      alpha: 0,
      duration: 500 + i * 60, delay: i * 50, ease: 'Sine.easeOut',
      onComplete: () => dot.destroy(),
    });
  }

  const ring = scene.add.graphics()
    .lineStyle(2, color, 0.8).strokeCircle(0, 0, 10)
    .setPosition(worldX, worldY).setDepth(64);

  scene.tweens.add({
    targets: ring, scaleX: 2.2, scaleY: 2.2, alpha: 0,
    duration: 350, ease: 'Expo.easeOut',
    onComplete: () => ring.destroy(),
  });
}

export function playDebuffApplyEffect(
  scene: Phaser.Scene,
  worldX: number, worldY: number,
  type: 'poison' | 'slow' | 'stun' | 'burn',
): void {
  const colorMap: Record<typeof type, number> = {
    poison: 0x88ff44,
    slow:   0x4488ff,
    stun:   0xffdd44,
    burn:   0xff4422,
  };
  const color    = colorMap[type];
  const colorStr = Phaser.Display.Color.IntegerToColor(color).rgba;

  const xMark = scene.add.text(worldX, worldY - 20, '✕', {
    fontSize: '18px', fontFamily: 'monospace',
    color: colorStr, stroke: '#000000', strokeThickness: 2,
  }).setOrigin(0.5).setDepth(65);

  scene.tweens.add({
    targets: xMark, y: worldY + 4, alpha: 0,
    duration: 450, ease: 'Sine.easeIn',
    onComplete: () => xMark.destroy(),
  });

  for (let i = 0; i < 3; i++) {
    const ring = scene.add.graphics()
      .lineStyle(1.5, color, 0.7)
      .strokeCircle(0, 0, 12 + i * 4)
      .setPosition(worldX, worldY).setDepth(64);

    scene.tweens.add({
      targets: ring, alpha: 0, scaleX: 0.5, scaleY: 0.5,
      duration: 300, delay: i * 60, ease: 'Expo.easeIn',
      onComplete: () => ring.destroy(),
    });
  }
}
