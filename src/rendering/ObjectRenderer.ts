import Phaser from 'phaser';

const TILE = 32;

export class ObjectRenderer {
  private scene: Phaser.Scene;
  private crackSprite: Phaser.GameObjects.Image | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  showCracks(tx: number, ty: number, ratio: number): void {
    let level: 1 | 2 | 3;
    if (ratio < 0.33) level = 1;
    else if (ratio < 0.66) level = 2;
    else level = 3;

    const wx = tx * TILE;
    const wy = ty * TILE;
    const key = `crack_${level}`;

    if (!this.crackSprite) {
      this.crackSprite = this.scene.add.image(wx, wy, key).setOrigin(0, 0).setDepth(1.2);
    } else {
      this.crackSprite.setPosition(wx, wy).setTexture(key);
    }
  }

  hideCracks(): void {
    this.crackSprite?.destroy();
    this.crackSprite = null;
  }

  updateBuildPreview(
    sprite: Phaser.GameObjects.GameObject & { setTint: (c: number) => void; setAlpha: (a: number) => void },
    canPlace: boolean,
  ): void {
    if (canPlace) {
      sprite.setTint(0x88ff88);
      sprite.setAlpha(0.6);
    } else {
      sprite.setTint(0xff8888);
      sprite.setAlpha(0.6);
    }
  }

  spawnMiningDebris(wx: number, wy: number): void {
    this.scene.cameras.main.shake(60, 0.003);

    const count = Phaser.Math.Between(3, 5);
    for (let i = 0; i < count; i++) {
      const w = Phaser.Math.Between(2, 5);
      const h = Phaser.Math.Between(2, 4);
      const color = Phaser.Utils.Array.GetRandom([0x888888, 0xa0a0a0, 0x606060]) as number;
      const chip = this.scene.add.rectangle(wx + TILE / 2, wy + TILE / 2, w, h, color);
      chip.setDepth(9998);
      const angleDeg = Phaser.Math.Between(200, 340);
      const speed = Phaser.Math.Between(50, 130);
      this.scene.tweens.add({
        targets: chip,
        x: chip.x + Math.cos(Phaser.Math.DegToRad(angleDeg)) * speed,
        y: chip.y + Math.sin(Phaser.Math.DegToRad(angleDeg)) * speed,
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(350, 600),
        ease: 'Quad.easeOut',
        onComplete: () => chip.destroy(),
      });
    }
  }

  spawnFishingBobber(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
  ): Phaser.GameObjects.Image {
    const bobber = this.scene.add.image(fromX, fromY, 'fx_bobber').setDepth(9999);
    const startY = fromY;

    this.scene.tweens.add({
      targets: bobber,
      x: targetX,
      duration: 400,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => {
        const p = tween.progress;
        const arc = Math.sin(p * Math.PI) * -30;
        bobber.y = Phaser.Math.Linear(startY, targetY, p) + arc;
      },
      onComplete: () => {
        // Start bobbing animation
        this.scene.tweens.add({
          targets: bobber,
          y: bobber.y + 3,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    return bobber;
  }

  pullBobber(bobber: Phaser.GameObjects.Image): void {
    this.scene.tweens.killTweensOf(bobber);
    this.scene.tweens.add({
      targets: bobber,
      y: bobber.y + 8,
      alpha: 0,
      duration: 150,
      ease: 'Cubic.easeIn',
      onComplete: () => bobber.destroy(),
    });
  }

  spawnFishJump(x: number, y: number): void {
    const fish = this.scene.add.ellipse(x, y, 10, 5, 0x88ccff);
    fish.setDepth(9999);
    this.scene.tweens.add({
      targets: fish,
      x: x + Phaser.Math.Between(-20, 20),
      y: y - 30,
      angle: -45,
      duration: 200,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => fish.destroy(),
    });
  }

  destroy(): void {
    this.hideCracks();
  }
}
