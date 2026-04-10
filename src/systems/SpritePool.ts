import Phaser from 'phaser';

export class SpritePool<T extends Phaser.GameObjects.Sprite> {
  private pool: Phaser.GameObjects.Group;

  constructor(
    scene: Phaser.Scene,
    classType: new (...args: unknown[]) => T,
    size: number,
  ) {
    this.pool = scene.add.group({
      classType,
      maxSize: size,
      runChildUpdate: false,
    });
    this.pool.createMultiple({ quantity: size, active: false, visible: false, key: '' });
  }

  acquire(x: number, y: number): T | null {
    const obj = this.pool.getFirstDead(false) as T | null;
    if (!obj) return null;
    obj.setPosition(x, y).setActive(true).setVisible(true);
    return obj;
  }

  release(obj: T): void {
    obj.setActive(false).setVisible(false);
  }

  destroy(): void {
    this.pool.destroy(true);
  }
}
