import Phaser from 'phaser';

export interface SpotlightTarget {
  type: 'rect' | 'circle';
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  padding?: number;
}

/**
 * 딤 오버레이 + 스포트라이트 구멍.
 * depth 118, scrollFactor 0.
 */
export class TutorialSpotlight {
  private dimRt: Phaser.GameObjects.RenderTexture;
  private borderGfx: Phaser.GameObjects.Graphics | null = null;

  constructor(private scene: Phaser.Scene) {
    const { width: W, height: H } = scene.scale;
    this.dimRt = scene.add.renderTexture(0, 0, W, H)
      .setScrollFactor(0).setDepth(118).setVisible(false).setOrigin(0, 0);
  }

  show(target: SpotlightTarget | null, dimAlpha = 0.72): void {
    const { width: W, height: H } = this.scene.scale;
    this.dimRt.setVisible(true);
    this.dimRt.clear();

    const dimGfx = this.scene.make.graphics();
    dimGfx.fillStyle(0x000000, dimAlpha);
    dimGfx.fillRect(0, 0, W, H);
    this.dimRt.draw(dimGfx, 0, 0);
    dimGfx.destroy();

    this.borderGfx?.destroy();
    this.borderGfx = null;

    if (!target) return;

    const pad = target.padding ?? 8;
    const eraseGfx = this.scene.make.graphics();
    eraseGfx.fillStyle(0x000000, 1.0);

    if (target.type === 'rect') {
      eraseGfx.fillRoundedRect(
        target.x - pad, target.y - pad,
        (target.w ?? 100) + pad * 2,
        (target.h ?? 40) + pad * 2,
        6,
      );
    } else {
      eraseGfx.fillCircle(target.x, target.y, (target.r ?? 40) + pad);
    }
    this.dimRt.erase(eraseGfx, 0, 0);
    eraseGfx.destroy();

    this.drawBorder(target, pad);
  }

  fadeIn(target: SpotlightTarget | null): void {
    this.show(target);
    this.dimRt.setAlpha(0);
    this.scene.tweens.add({
      targets: this.dimRt, alpha: 1,
      duration: 300, ease: 'Quad.easeOut',
    });
  }

  moveTo(newTarget: SpotlightTarget | null): void {
    this.scene.tweens.add({
      targets: this.dimRt, alpha: 0,
      duration: 150,
      onComplete: () => {
        this.show(newTarget);
        this.scene.tweens.add({ targets: this.dimRt, alpha: 1, duration: 150 });
      },
    });
  }

  hide(): void {
    this.dimRt.setVisible(false);
    this.borderGfx?.destroy();
    this.borderGfx = null;
  }

  private drawBorder(target: SpotlightTarget, pad: number): void {
    const gfx = this.scene.add.graphics()
      .setScrollFactor(0).setDepth(119);
    gfx.lineStyle(2, 0xf0c030, 0.8);

    if (target.type === 'rect') {
      gfx.strokeRoundedRect(
        target.x - pad, target.y - pad,
        (target.w ?? 100) + pad * 2,
        (target.h ?? 40) + pad * 2,
        6,
      );
    } else {
      gfx.strokeCircle(target.x, target.y, (target.r ?? 40) + pad);
    }
    this.borderGfx = gfx;
  }

  destroy(): void {
    this.dimRt.destroy();
    this.borderGfx?.destroy();
  }
}
