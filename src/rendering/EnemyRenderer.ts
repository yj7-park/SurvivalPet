import Phaser from 'phaser';

interface EyeGlowEntry {
  id: string;
  left: Phaser.GameObjects.Rectangle;
  right: Phaser.GameObjects.Rectangle;
  tween: Phaser.Tweens.Tween;
}

export class EnemyRenderer {
  private scene: Phaser.Scene;
  private eyeGlows = new Map<string, EyeGlowEntry>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Show/hide night eye glow for an enemy. pass null to remove. */
  setEyeGlow(id: string, x: number, y: number, visible: boolean): void {
    if (!visible) {
      this.removeEyeGlow(id);
      return;
    }

    let entry = this.eyeGlows.get(id);
    if (!entry) {
      const left  = this.scene.add.rectangle(x - 3, y - 8, 2, 2, 0xffffff, 0.9).setDepth(6);
      const right = this.scene.add.rectangle(x + 3, y - 8, 2, 2, 0xffffff, 0.9).setDepth(6);
      const tween = this.scene.tweens.add({
        targets: [left, right],
        alpha: { from: 0.5, to: 1.0 },
        duration: 800,
        yoyo: true,
        repeat: -1,
      });
      entry = { id, left, right, tween };
      this.eyeGlows.set(id, entry);
    } else {
      entry.left.setPosition(x - 3, y - 8);
      entry.right.setPosition(x + 3, y - 8);
    }
  }

  removeEyeGlow(id: string): void {
    const entry = this.eyeGlows.get(id);
    if (!entry) return;
    entry.tween.stop();
    entry.left.destroy();
    entry.right.destroy();
    this.eyeGlows.delete(id);
  }

  /** Update all eye glow positions based on enemy list */
  updateEyeGlows(
    enemies: Array<{ id: string; x: number; y: number; isDead: boolean }>,
    gameHour: number,
    playerLightRadius: number,
    playerX: number,
    playerY: number,
  ): void {
    const isNight = gameHour >= 22 || gameHour < 6;

    for (const e of enemies) {
      if (e.isDead) { this.removeEyeGlow(e.id); continue; }
      const inLight = Math.hypot(e.x - playerX, e.y - playerY) < playerLightRadius;
      this.setEyeGlow(e.id, e.x, e.y, isNight && !inLight);
    }

    // Remove glows for enemies no longer in list
    const activeIds = new Set(enemies.map(e => e.id));
    for (const id of this.eyeGlows.keys()) {
      if (!activeIds.has(id)) this.removeEyeGlow(id);
    }
  }

  destroy(): void {
    for (const entry of this.eyeGlows.values()) {
      entry.tween.stop();
      entry.left.destroy();
      entry.right.destroy();
    }
    this.eyeGlows.clear();
  }
}
