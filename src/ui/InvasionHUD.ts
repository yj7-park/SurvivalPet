import Phaser from 'phaser';
import { UI_COLORS } from '../config/uiColors';

type InvasionDir = 'top' | 'bottom' | 'left' | 'right';

interface ArrowEntry {
  arrow: Phaser.GameObjects.Triangle;
  label: Phaser.GameObjects.Text;
  tween: Phaser.Tweens.Tween;
}

export class InvasionHUD {
  private scene: Phaser.Scene;
  private banner: HTMLDivElement | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private arrows: ArrowEntry[] = [];
  private bannerTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Show top slide-down banner with countdown */
  showCountdown(direction: InvasionDir, enemyCount: number, seconds: number): void {
    this.hideBanner();

    const dirLabels: Record<InvasionDir, string> = {
      top: '북쪽 ↑', bottom: '남쪽 ↓', left: '서쪽 ←', right: '동쪽 →',
    };

    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;top:-60px;left:50%;transform:translateX(-50%);
      background:rgba(120,0,0,0.88);border:1px solid #cc3333;
      border-radius:0 0 6px 6px;padding:8px 20px;z-index:200;
      color:${UI_COLORS.textPrimary};font:11px "Courier New",monospace;
      text-align:center;min-width:280px;transition:top 0.3s ease;
    `;
    el.innerHTML = `
      <div style="color:#ff6666;font-weight:bold;font-size:13px">⚠ 침략이 시작됩니다!</div>
      <div style="color:#ffaa66;margin-top:2px">
        방향: <b>${dirLabels[direction]}</b> &nbsp;|&nbsp; 적 수: <b>${enemyCount}명</b>
        &nbsp;|&nbsp; <span id="inv-cd">${seconds}</span>초 후
      </div>
    `;
    document.body.appendChild(el);
    this.banner = el;

    // Slide down after appending (next tick)
    setTimeout(() => { el.style.top = '0'; }, 10);

    let remaining = seconds;
    this.countdownTimer = setInterval(() => {
      remaining--;
      const cd = el.querySelector<HTMLSpanElement>('#inv-cd');
      if (cd) cd.textContent = String(Math.max(0, remaining));
      if (remaining <= 0) this.hideBanner();
    }, 1000);
  }

  hideBanner(): void {
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    if (this.banner) {
      this.banner.style.top = '-60px';
      setTimeout(() => { this.banner?.remove(); this.banner = null; }, 350);
    }
  }

  /** Show direction arrows on screen edges */
  showDirectionArrows(direction: InvasionDir, enemyCount: number): void {
    this.clearArrows();
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    const cfg: Record<InvasionDir, { x: number; y: number; angle: number }> = {
      top:    { x: W / 2, y: 24,      angle: 0   },
      bottom: { x: W / 2, y: H - 24,  angle: 180 },
      left:   { x: 24,     y: H / 2,  angle: -90 },
      right:  { x: W - 24, y: H / 2,  angle: 90  },
    };

    const { x, y, angle } = cfg[direction];

    // Triangle arrow
    const arrow = this.scene.add.triangle(x, y, 0, 0, 20, 10, 0, 20, 0xff2222, 0.9)
      .setAngle(angle - 90)
      .setScrollFactor(0)
      .setDepth(85);

    const label = this.scene.add.text(x, y + 22, `×${enemyCount}`, {
      fontSize: '11px',
      fontFamily: '"Courier New", monospace',
      color: '#ffaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setDepth(85).setOrigin(0.5);

    const tween = this.scene.tweens.add({
      targets: [arrow, label],
      alpha: { from: 0.4, to: 1.0 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    this.arrows.push({ arrow, label, tween });
  }

  clearArrows(): void {
    for (const a of this.arrows) {
      a.tween.stop();
      a.arrow.destroy();
      a.label.destroy();
    }
    this.arrows = [];
  }

  destroy(): void {
    this.hideBanner();
    this.clearArrows();
  }
}
