import Phaser from 'phaser';

export class WaterReflectionLayer {
  private rt: Phaser.GameObjects.RenderTexture;
  private scrollOffset = 0;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const cam = scene.cameras.main;
    this.rt = scene.add.renderTexture(0, 0, cam.width, cam.height)
      .setScrollFactor(0)
      .setDepth(11)
      .setAlpha(0.15);
  }

  update(delta: number, skyColor: number): void {
    this.scrollOffset = (this.scrollOffset + delta * 0.02) % 8;
    this.rt.clear();

    const gfx = this.scene.make.graphics({});
    const cam = this.scene.cameras.main;
    const W = cam.width, H = cam.height;

    const r = ((skyColor >> 16) & 0xff);
    const g = ((skyColor >> 8)  & 0xff);
    const b =  (skyColor        & 0xff);
    const lightColor = ((Math.min(255, r + 30) << 16) | (Math.min(255, g + 30) << 8) | Math.min(255, b + 30));

    gfx.lineStyle(1, lightColor, 0.12);
    for (let y = this.scrollOffset; y < H; y += 8) {
      gfx.lineBetween(0, y, W, y);
    }
    this.rt.draw(gfx, 0, 0);
    gfx.destroy();
  }

  destroy(): void {
    this.rt.destroy();
  }
}

export function drawWaterReflection(
  scene: Phaser.Scene,
  objectSprite: Phaser.GameObjects.Image,
  waterY: number
): void {
  const reflY = waterY + (waterY - objectSprite.y);

  const refl = scene.add.image(objectSprite.x, reflY, objectSprite.texture.key)
    .setFlipY(true)
    .setAlpha(0.18)
    .setTint(0x80c0ff)
    .setDepth(11)
    .setScrollFactor(objectSprite.scrollFactorX, objectSprite.scrollFactorY);

  scene.tweens.add({
    targets: refl,
    x: refl.x + 3,
    duration: 2000, ease: 'Sine.easeInOut',
    yoyo: true, repeat: -1
  });

  objectSprite.on(Phaser.GameObjects.Events.DESTROY, () => refl.destroy());
}
