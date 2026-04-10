import Phaser from 'phaser';

const PW = 360, PH = 80;

/**
 * 튜토리얼 안내 패널 (Phaser Container).
 * depth 121, scrollFactor 0.
 */
export class TutorialPanel {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private dotBar: Phaser.GameObjects.Graphics;
  private skipText: Phaser.GameObjects.Text;
  private skipTimer: Phaser.Time.TimerEvent | null = null;
  private onSkipCb?: () => void;

  constructor(private scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    this.titleText = scene.add.text(12, 8, '', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#888866',
    });
    this.bodyText = scene.add.text(12, 22, '', {
      fontSize: '12px', fontFamily: 'Courier New', color: '#eeeedd',
      wordWrap: { width: PW - 24 },
    });
    this.dotBar = scene.add.graphics();
    this.skipText = scene.add.text(PW - 12, PH - 10, '건너뛰기', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#888866',
    }).setOrigin(1, 1).setVisible(false).setInteractive({ useHandCursor: true });
    this.skipText.on('pointerup', () => this.onSkipCb?.());
    this.skipText.on('pointerover', () => this.skipText.setColor('#cccc88'));
    this.skipText.on('pointerout',  () => this.skipText.setColor('#888866'));

    this.container = scene.add.container(0, 0, [
      this.bg, this.titleText, this.bodyText, this.dotBar, this.skipText,
    ]).setScrollFactor(0).setDepth(121).setVisible(false);
  }

  show(
    stepIndex: number,
    totalSteps: number,
    message: string,
    onSkip: () => void,
  ): void {
    this.onSkipCb = onSkip;
    this.skipTimer?.remove();
    this.skipText.setVisible(false);

    const { width: W, height: H } = this.scene.scale;
    const px = (W - PW) / 2;
    const py = H - PH - 16;

    this.drawBg();
    this.titleText.setText(`튜토리얼 (${stepIndex + 1}/${totalSteps})`);
    this.bodyText.setText(message);
    this.drawDots(stepIndex, totalSteps);

    this.container.setPosition(px, py + 40).setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      y: py, alpha: 1,
      duration: 250, ease: 'Back.easeOut',
    });

    this.skipTimer = this.scene.time.delayedCall(5000, () => {
      if (this.container.active) this.skipText.setVisible(true);
    });
  }

  hide(): void {
    this.skipTimer?.remove();
    const curY = this.container.y;
    this.scene.tweens.add({
      targets: this.container,
      y: curY + 30, alpha: 0,
      duration: 200,
      onComplete: () => this.container.setVisible(false),
    });
  }

  private drawBg(): void {
    this.bg.clear();
    // background
    this.bg.fillStyle(0x0a0805, 0.92);
    this.bg.fillRoundedRect(0, 0, PW, PH, 4);
    // border
    this.bg.lineStyle(2, 0xc8a030, 0.9);
    this.bg.strokeRoundedRect(0, 0, PW, PH, 4);
    // left accent bar
    this.bg.fillStyle(0xc8a030, 1.0);
    this.bg.fillRect(0, 4, 3, PH - 8);
  }

  private drawDots(current: number, total: number): void {
    this.dotBar.clear();
    const dotR = 3, dotGap = 10;
    const startX = 12;
    const y = PH - 10;
    for (let i = 0; i < total; i++) {
      const x = startX + i * dotGap;
      if (i < current) {
        this.dotBar.fillStyle(0xf0c030, 1.0);
        this.dotBar.fillCircle(x, y, dotR);
      } else if (i === current) {
        this.dotBar.fillStyle(0xffffff, 1.0);
        this.dotBar.fillCircle(x, y, dotR + 1);
      } else {
        this.dotBar.fillStyle(0x555545, 1.0);
        this.dotBar.fillCircle(x, y, dotR);
      }
    }
  }

  destroy(): void {
    this.skipTimer?.remove();
    this.container.destroy();
  }
}
