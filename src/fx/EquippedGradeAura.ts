import { ItemGrade, GRADE_COLORS } from '../data/ItemGrade';

function drawRotatedEllipse(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  angle: number,
  steps = 32
): void {
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i <= steps; i++) {
    const t  = (i / steps) * Math.PI * 2;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    pts.push({
      x: ex * Math.cos(angle) - ey * Math.sin(angle) + cx,
      y: ex * Math.sin(angle) + ey * Math.cos(angle) + cy,
    });
  }
  gfx.strokePoints(pts, true);
}

export class EquippedGradeAura {
  private auraGfx?: Phaser.GameObjects.Graphics;
  private currentGrade: ItemGrade = 'normal';
  private scene?: Phaser.Scene;
  private targetSprite?: Phaser.GameObjects.Sprite;

  attach(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    grade: ItemGrade
  ): void {
    this.detach();
    if (grade === 'normal' || grade === 'uncommon') return;

    this.scene        = scene;
    this.targetSprite = sprite;
    this.currentGrade = grade;
    this.auraGfx      = scene.add.graphics().setDepth(sprite.depth - 1);
    scene.events.on('update', this.updateAura, this);
  }

  private updateAura(time: number): void {
    if (!this.auraGfx || !this.targetSprite) return;
    const phase = (time % 3000) / 3000;
    const col   = GRADE_COLORS[this.currentGrade];
    const glow  = col.glow;
    const cx    = this.targetSprite.x;
    const cy    = this.targetSprite.y;

    this.auraGfx.clear();

    if (this.currentGrade === 'rare') {
      const r     = 18 + Math.sin(phase * Math.PI * 2) * 3;
      const alpha = 0.12 + Math.sin(phase * Math.PI * 2) * 0.06;
      this.auraGfx.fillStyle(glow, alpha);
      this.auraGfx.fillCircle(cx, cy, r);
    }

    if (this.currentGrade === 'epic') {
      const angle = phase * Math.PI * 2;
      this.auraGfx.lineStyle(1.5, glow, 0.4);
      drawRotatedEllipse(this.auraGfx, cx, cy, 22, 10, angle);
      drawRotatedEllipse(this.auraGfx, cx, cy, 22, 10, angle + Math.PI / 2);
    }

    if (this.currentGrade === 'legendary') {
      const angle = phase * Math.PI * 2;
      this.auraGfx.lineStyle(2, glow, 0.55);
      drawRotatedEllipse(this.auraGfx, cx, cy, 24, 10, angle);
      for (let i = 0; i < 8; i++) {
        const a  = (i / 8) * Math.PI * 2 + angle;
        const px = cx + Math.cos(a) * 22;
        const py = cy + Math.sin(a) * 10;
        const fs = 2 + Math.sin(phase * Math.PI * 2 + i) * 1;
        this.auraGfx.fillStyle(glow, 0.7);
        this.auraGfx.fillCircle(px, py, fs);
      }
    }
  }

  detach(): void {
    if (this.scene) {
      this.scene.events.off('update', this.updateAura, this);
    }
    this.auraGfx?.destroy();
    this.auraGfx      = undefined;
    this.scene        = undefined;
    this.targetSprite = undefined;
    this.currentGrade = 'normal';
  }
}
