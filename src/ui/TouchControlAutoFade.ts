import Phaser from 'phaser';

export class TouchControlAutoFade {
  private readonly ACTIVE_ALPHA  = 0.85;
  private readonly IDLE_ALPHA    = 0.30;
  private readonly FADE_DELAY_MS = 4000;
  private idleTimer: Phaser.Time.TimerEvent | null = null;
  private targets: Phaser.GameObjects.GameObject[];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, targets: Phaser.GameObjects.GameObject[]) {
    this.scene = scene;
    this.targets = targets;
  }

  onTouchStart(): void {
    this.scene.tweens.add({
      targets: this.targets,
      alpha: this.ACTIVE_ALPHA, duration: 150
    });
    this.idleTimer?.remove();
  }

  onTouchEnd(): void {
    this.idleTimer?.remove();
    this.idleTimer = this.scene.time.delayedCall(this.FADE_DELAY_MS, () => {
      this.scene.tweens.add({
        targets: this.targets,
        alpha: this.IDLE_ALPHA, duration: 1000
      });
    });
  }

  destroy(): void {
    this.idleTimer?.remove();
  }
}
