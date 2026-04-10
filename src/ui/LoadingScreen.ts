import { drawSaveSpinner } from './AutoSaveIndicator';

export class LoadingScreen {
  private bg?:    Phaser.GameObjects.Rectangle;
  private bar?:   Phaser.GameObjects.Graphics;
  private label?: Phaser.GameObjects.Text;
  private scene?: Phaser.Scene;
  private progress = 0;
  private spinGfx?: Phaser.GameObjects.Graphics;
  private updateListener?: (t: number, d: number) => void;

  show(scene: Phaser.Scene): void {
    this.scene    = scene;
    this.progress = 0;

    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;

    this.bg = scene.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0a)
      .setScrollFactor(0).setDepth(200);

    scene.add.text(W / 2, H * 0.38, 'BASECAMP', {
      fontSize: '28px', color: '#f0c030',
      fontFamily: 'Courier New', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    scene.add.text(W / 2, H * 0.38 + 32, 'Survival Simulation', {
      fontSize: '12px', color: '#888888', fontFamily: 'Courier New',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.bar = scene.add.graphics().setScrollFactor(0).setDepth(201);
    this.updateBar(W, H);

    this.label = scene.add.text(W / 2, H * 0.62 + 24, '로딩 중...', {
      fontSize: '10px', color: '#666666', fontFamily: 'Courier New',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.spinGfx = scene.add.graphics().setScrollFactor(0).setDepth(201);

    let spinAngle = 0;
    this.updateListener = (_t: number, delta: number) => {
      spinAngle += delta * 0.004;
      this.spinGfx!.clear();
      drawSaveSpinner(this.spinGfx!, W / 2, H * 0.62 + 44, 6, spinAngle);
    };
    scene.events.on('update', this.updateListener, this);
  }

  setProgress(pct: number, statusText?: string): void {
    if (!this.scene) return;
    this.progress = Math.max(0, Math.min(1, pct));
    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;
    this.updateBar(W, H);
    if (statusText && this.label) this.label.setText(statusText);
  }

  private updateBar(W: number, H: number): void {
    if (!this.bar) return;
    const barW = W * 0.5;
    const barH = 6;
    const bx   = (W - barW) / 2;
    const by   = H * 0.62;

    this.bar.clear();
    this.bar.fillStyle(0x222222, 1);
    this.bar.fillRoundedRect(bx, by, barW, barH, 3);

    const filled = barW * this.progress;
    if (filled > 0) {
      this.bar.fillStyle(0xf0c030, 1);
      this.bar.fillRoundedRect(bx, by, filled, barH, 3);
      this.bar.fillStyle(0xffffff, 0.25);
      this.bar.fillRect(bx + 2, by + 1, filled - 4, 2);
    }
  }

  hide(): void {
    if (!this.scene) return;
    if (this.updateListener) {
      this.scene.events.off('update', this.updateListener, this);
    }
    const targets = [this.bg, this.bar, this.label, this.spinGfx]
      .filter(Boolean) as Phaser.GameObjects.GameObject[];

    this.scene.tweens.add({
      targets, alpha: 0, duration: 400,
      onComplete: () => targets.forEach(t => (t as Phaser.GameObjects.Graphics).destroy()),
    });
  }
}

export function playSceneEnterFade(scene: Phaser.Scene): void {
  const overlay = scene.add.rectangle(
    scene.cameras.main.width / 2,
    scene.cameras.main.height / 2,
    scene.cameras.main.width,
    scene.cameras.main.height,
    0x000000, 1
  ).setScrollFactor(0).setDepth(195);

  scene.tweens.add({
    targets: overlay,
    alpha: 0,
    duration: 700,
    ease: 'Quad.easeOut',
    onComplete: () => overlay.destroy(),
  });
}
