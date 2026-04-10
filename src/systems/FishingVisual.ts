import Phaser from 'phaser';

export function updateFishingLine(
  rodTipX: number, rodTipY: number,
  bobberX: number, bobberY: number,
  gfx: Phaser.GameObjects.Graphics
): void {
  gfx.clear();
  gfx.lineStyle(1, 0xd0d0c0, 0.85);

  const midX = (rodTipX + bobberX) / 2;
  const midY = Math.max(rodTipY, bobberY) + 20;

  // 베지에 근사: 여러 선분으로 포물선 그리기
  const steps = 16;
  gfx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const invT = 1 - t;
    const px = invT * invT * rodTipX + 2 * invT * t * midX + t * t * bobberX;
    const py = invT * invT * rodTipY + 2 * invT * t * midY + t * t * bobberY;
    if (i === 0) gfx.moveTo(px, py); else gfx.lineTo(px, py);
  }
  gfx.strokePath();
}

export function playFishCatchSplash(scene: Phaser.Scene, x: number, y: number): void {
  [0, 100, 220].forEach((delay, i) => {
    scene.time.delayedCall(delay, () => {
      const gfx = scene.add.graphics().setDepth(12);
      const maxR = 20 + i * 10;
      const obj = { r: 0, a: 0.7 };
      scene.tweens.add({
        targets: obj, r: maxR, a: 0,
        duration: 400, ease: 'Quad.easeOut',
        onUpdate: () => {
          gfx.clear();
          gfx.lineStyle(2, 0x80ccff, obj.a);
          gfx.strokeEllipse(x, y, obj.r * 2, obj.r * 0.55);
        },
        onComplete: () => gfx.destroy()
      });
    });
  });

  const emitter = scene.add.particles(x, y, 'fx_pixel', {
    tint:     [0x60b8f0, 0x90d0ff, 0xffffff],
    speed:    { min: 60, max: 140 },
    angle:    { min: -160, max: -20 },
    gravityY: 250,
    scale:    { start: 1.5, end: 0 },
    lifespan: { min: 250, max: 500 },
    quantity: 12, emitting: false
  });
  emitter.setDepth(13);
  emitter.explode(12);
  scene.time.delayedCall(600, () => emitter.destroy());
}

export function syncBobberToWater(
  scene: Phaser.Scene,
  bobberSprite: Phaser.GameObjects.Sprite
): void {
  scene.tweens.add({
    targets: bobberSprite,
    y: bobberSprite.y + 3,
    duration: 333,
    ease: 'Sine.easeInOut',
    yoyo: true, repeat: -1
  });
}

export function intensifyWaterRipples(
  scene: Phaser.Scene,
  weather: string,
  getRandomVisibleWaterTile: () => { wx: number; wy: number } | null
): Phaser.Time.TimerEvent | null {
  const rippleFreq = weather === 'storm' ? 80 : weather === 'rain' ? 160 : 0;
  if (rippleFreq === 0) return null;

  return scene.time.addEvent({
    delay: rippleFreq, loop: true,
    callback: () => {
      const tile = getRandomVisibleWaterTile();
      if (!tile) return;
      const gfx = scene.add.graphics().setDepth(12);
      const obj = { r: 0, a: 0.4 };
      scene.tweens.add({
        targets: obj, r: 8, a: 0,
        duration: 300,
        onUpdate: () => {
          gfx.clear();
          gfx.lineStyle(1, 0xaaddff, obj.a);
          gfx.strokeEllipse(tile.wx + 16, tile.wy + 16, obj.r * 2, obj.r * 0.5);
        },
        onComplete: () => gfx.destroy()
      });
    }
  });
}
