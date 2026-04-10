export class FishingTensionGauge {
  private container?: Phaser.GameObjects.Container;
  private barBg?:     Phaser.GameObjects.Graphics;
  private indicator?: Phaser.GameObjects.Graphics;
  private needle?:    Phaser.GameObjects.Graphics;
  private fishIcon?:  Phaser.GameObjects.Text;
  private tension = 0.5;
  private safeMin = 0.35;
  private safeMax = 0.65;
  private GAUGE_H = 200;
  private baseX = 0;

  show(scene: Phaser.Scene, safeMin = 0.35, safeMax = 0.65): void {
    this.safeMin = safeMin;
    this.safeMax = safeMax;

    const cam = scene.cameras.main;
    const GX  = cam.width - 36;
    const GY  = cam.height * 0.2;
    const GH  = cam.height * 0.5;
    this.GAUGE_H = GH;
    this.baseX   = GX;

    this.container = scene.add.container(GX, GY).setScrollFactor(0).setDepth(88);

    this.barBg    = scene.add.graphics();
    this.indicator = scene.add.graphics();
    this.needle   = scene.add.graphics();
    this.fishIcon = scene.add.text(0, -18, '🐟', { fontSize: '12px' }).setOrigin(0.5);

    this.container.add([this.barBg, this.indicator, this.needle, this.fishIcon]);
    this.drawStatic(GH);
    scene.events.on('update', this.updateVisual, this);
  }

  private drawStatic(h: number): void {
    if (!this.barBg || !this.indicator) return;
    // background
    this.barBg.fillStyle(0x111111, 0.8);
    this.barBg.fillRoundedRect(-10, 0, 20, h, 3);
    // danger top
    this.barBg.fillStyle(0xff4444, 0.3);
    this.barBg.fillRoundedRect(-9, 1, 18, h * (1 - this.safeMax), 2);
    // safe zone
    this.indicator.fillStyle(0x44ff88, 0.25);
    this.indicator.fillRect(-9, h * (1 - this.safeMax), 18, h * (this.safeMax - this.safeMin));
    // danger bottom
    this.barBg.fillStyle(0xff4444, 0.3);
    this.barBg.fillRect(-9, h * (1 - this.safeMin), 18, h * this.safeMin);
    // dividers
    this.barBg.lineStyle(1, 0x44ff88, 0.6);
    this.barBg.beginPath();
    this.barBg.moveTo(-9, h * (1 - this.safeMax));
    this.barBg.lineTo( 9, h * (1 - this.safeMax));
    this.barBg.moveTo(-9, h * (1 - this.safeMin));
    this.barBg.lineTo( 9, h * (1 - this.safeMin));
    this.barBg.strokePath();
  }

  setTension(t: number): void { this.tension = Math.max(0, Math.min(1, t)); }

  private updateVisual(): void {
    if (!this.needle || !this.fishIcon || !this.container) return;
    const h  = this.GAUGE_H;
    const ny = h * (1 - this.tension);
    const inSafe = this.tension >= this.safeMin && this.tension <= this.safeMax;
    const color  = this.tension > this.safeMax ? 0xff4444 : inSafe ? 0x44ff88 : 0xff8800;

    this.needle.clear();
    this.needle.lineStyle(2, color, 1);
    this.needle.beginPath();
    this.needle.moveTo(-12, ny);
    this.needle.lineTo( 12, ny);
    this.needle.strokePath();
    this.needle.fillStyle(color, 1);
    this.needle.fillTriangle(-12, ny, -6, ny - 4, -6, ny + 4);
    this.needle.fillTriangle( 12, ny,  6, ny - 4,  6, ny + 4);

    this.fishIcon.setY(ny - 14);

    if (this.tension > this.safeMax + 0.05 || this.tension < this.safeMin - 0.05) {
      this.container.setX(this.container.x + (Math.random() - 0.5) * 2);
    } else {
      this.container.setX(this.baseX);
    }
  }

  hide(scene: Phaser.Scene): void {
    scene.events.off('update', this.updateVisual, this);
    if (!this.container) return;
    scene.tweens.add({
      targets: this.container,
      alpha: 0, x: this.container.x + 20,
      duration: 300,
      onComplete: () => this.container?.destroy(),
    });
  }
}

export class FishingHUD {
  private hint?:          Phaser.GameObjects.Text;
  private waitIndicator?: Phaser.GameObjects.Graphics;
  private tensionGauge?:  FishingTensionGauge;
  private waitPhase = 0;
  private waitListener?: (_t: number, delta: number) => void;

  show(scene: Phaser.Scene): void {
    const cam = scene.cameras.main;

    this.hint = scene.add.text(
      cam.width / 2, cam.height - 20,
      '[ 클릭/탭 ] 당기기  — 타이밍에 맞춰 조절하세요',
      { fontSize: '10px', color: '#aaaaaa', fontFamily: 'Courier New' }
    ).setOrigin(0.5, 1).setScrollFactor(0).setDepth(88).setAlpha(0);

    scene.tweens.add({ targets: this.hint, alpha: 1, duration: 400 });

    this.waitIndicator = scene.add.graphics().setScrollFactor(0).setDepth(87);

    this.waitListener = (_t: number, delta: number) => {
      if (!this.waitIndicator) return;
      this.waitPhase += delta * 0.002;
      this.waitIndicator.clear();
      this.waitIndicator.lineStyle(1.5, 0x88aacc, 0.5);
      this.waitIndicator.arc(
        cam.width / 2 - 90, cam.height - 14,
        7,
        this.waitPhase,
        this.waitPhase + Math.PI * 1.2,
        false
      );
      this.waitIndicator.strokePath();
    };
    scene.events.on('update', this.waitListener);
  }

  showBiteAlert(scene: Phaser.Scene): void {
    if (!this.hint) return;
    this.hint.setText('⚡ 입질! 지금 당기세요! ⚡');
    this.hint.setColor('#ffff44');

    scene.tweens.add({
      targets: this.hint,
      scaleX: 1.1, scaleY: 1.1,
      duration: 120, yoyo: true, repeat: 3,
    });

    this.tensionGauge = new FishingTensionGauge();
    this.tensionGauge.show(scene);
  }

  setTension(t: number): void { this.tensionGauge?.setTension(t); }

  hide(scene: Phaser.Scene): void {
    if (this.waitListener) scene.events.off('update', this.waitListener);
    this.tensionGauge?.hide(scene);
    const targets = [this.hint, this.waitIndicator].filter(Boolean);
    scene.tweens.add({
      targets,
      alpha: 0, duration: 300,
      onComplete: () => {
        this.hint?.destroy();
        this.waitIndicator?.destroy();
      },
    });
  }
}
