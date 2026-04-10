export function playSaveConfirmEffect(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;

  const txt = scene.add.text(
    cam.width / 2, cam.height + 24,
    '✓  게임이 저장되었습니다',
    {
      fontSize: '12px',
      color: '#ccffcc',
      fontFamily: 'Courier New',
      backgroundColor: '#1a3a1a',
      padding: { x: 16, y: 8 },
    }
  ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(86);

  const panel = scene.add.graphics().setScrollFactor(0).setDepth(86);
  const b     = txt.getBounds();
  panel.lineStyle(1, 0x55aa55, 0.9);
  panel.strokeRoundedRect(b.x - 2, b.y - 2, b.width + 4, b.height + 4, 6);

  scene.tweens.add({
    targets: txt,
    y: cam.height - 28,
    duration: 300, ease: 'Back.easeOut',
  });

  scene.time.delayedCall(2200, () => {
    scene.tweens.add({
      targets: [txt, panel],
      y: `+=${50}`,
      alpha: 0,
      duration: 300, ease: 'Quad.easeIn',
      onComplete: () => { txt.destroy(); panel.destroy(); },
    });
  });
}

export function showSaveCorruptWarning(scene: Phaser.Scene): void {
  const W = scene.cameras.main.width;
  const H = scene.cameras.main.height;

  const panel = scene.add.graphics().setScrollFactor(0).setDepth(200);
  panel.fillStyle(0x3a0000, 0.9);
  panel.fillRoundedRect(W / 2 - 160, H / 2 - 50, 320, 100, 8);
  panel.lineStyle(2, 0xff4444, 1);
  panel.strokeRoundedRect(W / 2 - 160, H / 2 - 50, 320, 100, 8);

  scene.add.text(W / 2, H / 2 - 22, '⚠ 저장 데이터 손상', {
    fontSize: '14px', color: '#ff6666',
    fontFamily: 'Courier New', fontStyle: 'bold',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

  scene.add.text(W / 2, H / 2 + 4, '새 게임으로 시작합니다.', {
    fontSize: '11px', color: '#cccccc', fontFamily: 'Courier New',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

  scene.time.delayedCall(3000, () => {
    scene.tweens.add({ targets: [panel], alpha: 0, duration: 400 });
  });
}
