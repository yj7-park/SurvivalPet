export function drawSunbeam(
  scene: Phaser.Scene,
  _camX: number, _camY: number,
  camW: number, camH: number,
  timeOfDay: number,
): Phaser.GameObjects.Graphics | null {
  const isGoldenHour =
    (timeOfDay >= 7 && timeOfDay <= 10) ||
    (timeOfDay >= 15 && timeOfDay <= 18);
  if (!isGoldenHour) return null;

  const morning = timeOfDay <= 10;
  const angle   = morning ? -0.3 : 0.3;
  const alpha   = morning
    ? Math.min(0.07, (timeOfDay - 7) / 3 * 0.07)
    : Math.min(0.07, (18 - timeOfDay) / 3 * 0.07);

  const gfx = scene.add.graphics().setDepth(29).setScrollFactor(0);

  for (let i = 0; i < 3; i++) {
    const startX = camW * (0.1 + i * 0.35);
    const width  = 60 + i * 30;
    const color  = morning ? 0xffeeaa : 0xffaa66;
    const a      = Math.sin(angle);

    gfx.fillStyle(color, Math.max(0, alpha - i * 0.015));
    gfx.fillPoints([
      { x: startX - width / 2 + angle * camH, y: 0 },
      { x: startX + width / 2 + angle * camH, y: 0 },
      { x: startX + width / 2 + angle * camH + a * camH, y: camH },
      { x: startX - width / 2 + angle * camH + a * camH, y: camH },
    ], true);
  }

  return gfx;
}

export function drawSunsetGlow(
  scene: Phaser.Scene,
  camW: number, camH: number,
  timeOfDay: number,
): void {
  const isSunset = timeOfDay >= 17 && timeOfDay <= 20;
  if (!isSunset) return;

  const t     = (timeOfDay - 17) / 3;
  const alpha = Math.sin(t * Math.PI) * 0.12;

  const gfx = scene.add.graphics().setDepth(28).setScrollFactor(0);
  gfx.fillGradientStyle(0xff6622, 0xff6622, 0x000000, 0x000000, alpha, alpha, 0, 0);
  gfx.fillRect(0, camH * 0.5, camW, camH * 0.5);

  scene.time.delayedCall(50, () => gfx.destroy());
}
