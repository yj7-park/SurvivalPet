import Phaser from 'phaser';

export type ArrowDirection = 'up' | 'down' | 'left' | 'right';

/**
 * 방향 화살표 포인터 (yoyo 애니메이션).
 * depth 120, scrollFactor 0.
 */
export class TutorialArrow {
  private gfx: Phaser.GameObjects.Graphics;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(private scene: Phaser.Scene) {
    this.gfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(120).setVisible(false);
  }

  point(targetX: number, targetY: number, dir: ArrowDirection, offset = 24): void {
    this.tween?.stop();
    this.tween = null;
    this.gfx.setVisible(true);

    const positions = {
      up:    { x: targetX,          y: targetY - offset, angle: -90 },
      down:  { x: targetX,          y: targetY + offset, angle: 90  },
      left:  { x: targetX - offset, y: targetY,          angle: 180 },
      right: { x: targetX + offset, y: targetY,          angle: 0   },
    };
    const pos = positions[dir];
    this.gfx.setPosition(pos.x, pos.y).setAngle(pos.angle);

    this.gfx.clear();
    this.gfx.fillStyle(0xf0c030, 0.95);
    this.gfx.fillTriangle(16, 6, 0, 0, 0, 12);
    this.gfx.fillRect(-12, 2, 12, 8);

    const moveAxis = (dir === 'up' || dir === 'down') ? 'y' : 'x';
    const moveDir  = (dir === 'down' || dir === 'right') ? 8 : -8;
    this.tween = this.scene.tweens.add({
      targets: this.gfx,
      [moveAxis]: pos[moveAxis as 'x' | 'y'] + moveDir,
      duration: 500, ease: 'Sine.easeInOut',
      yoyo: true, repeat: -1,
    });
  }

  hide(): void {
    this.tween?.stop();
    this.tween = null;
    this.gfx.setVisible(false);
  }

  destroy(): void {
    this.tween?.stop();
    this.gfx.destroy();
  }
}
