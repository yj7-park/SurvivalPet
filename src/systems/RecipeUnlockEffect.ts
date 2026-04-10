import Phaser from 'phaser';

interface UnlockNode {
  name: string;
  icon?: string;
}

/**
 * 연구/레시피 해금 연출: 황금 플래시 + 아이콘 팝업 + 파티클.
 */
export function playResearchUnlockEffect(
  scene: Phaser.Scene,
  node: UnlockNode,
): void {
  const { width: W, height: H } = scene.scale;
  const cx = W / 2, cy = H / 2;

  // 화면 황금 플래시
  const flash = scene.add.graphics().setScrollFactor(0).setDepth(118);
  flash.fillStyle(0xf0c030, 1.0);
  flash.fillRect(0, 0, W, H);
  flash.setAlpha(0);
  scene.tweens.add({
    targets: flash,
    alpha: { from: 0, to: 0.25 },
    duration: 100, yoyo: true,
    onComplete: () => flash.destroy(),
  });

  // 아이콘 팝업
  const iconTxt = scene.add.text(cx, cy - 30, node.icon ?? '🔬', {
    fontSize: '48px',
  }).setScrollFactor(0).setDepth(122).setOrigin(0.5).setScale(2).setAlpha(0);
  scene.tweens.add({
    targets: iconTxt,
    alpha: 1, scaleX: 1, scaleY: 1,
    duration: 400, ease: 'Back.easeOut',
  });

  // 해금 텍스트
  const msg = scene.add.text(cx, cy + 20, `${node.name}\n해금!`, {
    fontSize: '16px', fontFamily: 'Courier New',
    color: '#f0c030', stroke: '#000000', strokeThickness: 3,
    align: 'center',
  }).setScrollFactor(0).setDepth(122).setOrigin(0.5).setAlpha(0);
  scene.time.delayedCall(200, () => {
    scene.tweens.add({ targets: msg, alpha: 1, duration: 200 });
  });

  // 파티클
  if (scene.textures.exists('fx_pixel')) {
    const emitter = scene.add.particles(cx, cy, 'fx_pixel', {
      tint:     [0xf0c030, 0xffffff, 0xffd060],
      speed:    { min: 80, max: 180 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.5, end: 0 },
      lifespan: 800,
      quantity: 16,
      emitting: false,
    }).setScrollFactor(0).setDepth(120);
    emitter.explode(16);
    scene.time.delayedCall(1000, () => emitter.destroy());
  }

  // fade out
  scene.time.delayedCall(3000, () => {
    scene.tweens.add({
      targets: [iconTxt, msg],
      alpha: 0, y: '-=20',
      duration: 400,
      onComplete: () => { iconTxt.destroy(); msg.destroy(); },
    });
  });
}
