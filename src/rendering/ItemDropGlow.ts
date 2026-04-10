export class ItemDropGlow {
  private scene: Phaser.Scene;
  private glows: Map<string, {
    gfx:   Phaser.GameObjects.Graphics;
    tween: Phaser.Tweens.Tween;
    label: Phaser.GameObjects.Text;
  }> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  add(
    itemId: string,
    worldX: number, worldY: number,
    gradeColor: number,
    itemName: string,
  ): void {
    this.remove(itemId);

    const gfx = this.scene.add.graphics().setDepth(5);

    const tween = this.scene.tweens.add({
      targets: {}, progress: { from: 0, to: 1 },
      yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut',
      onUpdate: (_: unknown, __: unknown, ___: unknown, p: number) => {
        const r = Phaser.Math.Linear(8,  14, p);
        const a = Phaser.Math.Linear(0.3, 0.7, p);
        gfx.clear()
          .fillStyle(gradeColor, a * 0.4).fillCircle(worldX, worldY, r)
          .lineStyle(1.5, gradeColor, a).strokeCircle(worldX, worldY, r);
      },
    });

    const colorStr = Phaser.Display.Color.IntegerToColor(gradeColor).rgba;
    const label = this.scene.add.text(worldX, worldY - 18, itemName, {
      fontSize: '10px', fontFamily: '"Noto Sans KR", sans-serif',
      color: colorStr, stroke: '#000000', strokeThickness: 2,
    }).setDepth(6).setOrigin(0.5).setAlpha(0.85);

    this.scene.tweens.add({
      targets: label, y: worldY - 22,
      yoyo: true, repeat: -1, duration: 1200, ease: 'Sine.easeInOut',
    });

    this.glows.set(itemId, { gfx, tween, label });
  }

  remove(itemId: string): void {
    const entry = this.glows.get(itemId);
    if (!entry) return;
    entry.tween.stop();
    entry.gfx.destroy();
    entry.label.destroy();
    this.glows.delete(itemId);
  }

  playCollectEffect(itemId: string, targetX: number, targetY: number): void {
    const entry = this.glows.get(itemId);
    if (!entry) return;

    entry.tween.stop();
    this.scene.tweens.add({
      targets: entry.gfx,
      x: targetX, y: targetY, scaleX: 0.1, scaleY: 0.1, alpha: 0,
      duration: 200, ease: 'Cubic.easeIn',
      onComplete: () => this.remove(itemId),
    });
    this.scene.tweens.add({
      targets: entry.label,
      x: targetX, y: targetY - 20, alpha: 0,
      duration: 180, ease: 'Cubic.easeIn',
    });
  }

  destroy(): void {
    for (const [id] of this.glows) this.remove(id);
  }
}
