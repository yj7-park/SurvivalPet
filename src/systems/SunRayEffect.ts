export class SunRayEffect {
  private rayGfx: Phaser.GameObjects.Graphics;
  private angle = 0;

  constructor(scene: Phaser.Scene) {
    this.rayGfx = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(5);
  }

  update(gameHour: number, sunX: number, sunY: number): void {
    const isDawnOrDusk =
      (gameHour >= 6 && gameHour < 8) || (gameHour >= 17 && gameHour < 19);

    if (!isDawnOrDusk) {
      this.rayGfx.setVisible(false);
      return;
    }
    this.rayGfx.setVisible(true);

    const t = gameHour < 12
      ? 1 - Math.abs((gameHour - 7) / 1)
      : 1 - Math.abs((gameHour - 18) / 1);
    const intensity = Math.max(0, Math.min(1, t));

    this.angle += 0.3;

    this.rayGfx.clear();
    const RAY_COUNT = 8;
    for (let i = 0; i < RAY_COUNT; i++) {
      const baseAngle = (i / RAY_COUNT) * Math.PI * 2 + this.angle * Math.PI / 180;
      const rayAlpha  = (0.04 + Math.random() * 0.03) * intensity;
      const rayLen    = 200 + Math.random() * 80;

      const ex1 = sunX + Math.cos(baseAngle - 0.08) * rayLen;
      const ey1 = sunY + Math.sin(baseAngle - 0.08) * rayLen;
      const ex2 = sunX + Math.cos(baseAngle + 0.08) * rayLen;
      const ey2 = sunY + Math.sin(baseAngle + 0.08) * rayLen;

      const rayColor = gameHour < 12 ? 0xffe080 : 0xff9040;
      this.rayGfx.fillStyle(rayColor, rayAlpha);
      this.rayGfx.fillTriangle(sunX, sunY, ex1, ey1, ex2, ey2);
    }
  }

  destroy(): void {
    this.rayGfx.destroy();
  }
}
