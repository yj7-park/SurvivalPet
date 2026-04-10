import Phaser from 'phaser';
import { Season } from './GameTime';

type MapExitDir = 'right' | 'left' | 'up' | 'down';

const SKY_COLORS: Record<Season, number> = {
  spring: 0x8ec8f0,
  summer: 0x60b0f0,
  autumn: 0xe0a860,
  winter: 0xb0c8e0,
};

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function getSkyTint(gameHour: number, season: Season): number {
  const seasonColor = SKY_COLORS[season];
  if (gameHour >= 5  && gameHour < 6)  return lerpColor(0x1a0a2a, 0xff8830, gameHour - 5);
  if (gameHour >= 6  && gameHour < 8)  return lerpColor(0xff8830, seasonColor, (gameHour - 6) / 2);
  if (gameHour >= 8  && gameHour < 18) return seasonColor;
  if (gameHour >= 18 && gameHour < 20) return lerpColor(seasonColor, 0xe06020, (gameHour - 18) / 2);
  if (gameHour >= 20 && gameHour < 22) return lerpColor(0xe06020, 0x0a0818, (gameHour - 20) / 2);
  return 0x0a0818;
}

export class TransitionSystem {
  private scene: Phaser.Scene;
  private skyRect: Phaser.GameObjects.Rectangle;
  private eyelidRT: Phaser.GameObjects.RenderTexture | null = null;
  private eyelidTimer: Phaser.Time.TimerEvent | null = null;
  private inputBlocked = false;

  constructor(scene: Phaser.Scene, canvasW: number, canvasH: number) {
    this.scene = scene;
    // Background sky color rect (behind everything, scroll-independent)
    this.skyRect = scene.add.rectangle(0, 0, canvasW * 10, canvasH * 10, 0x0e0a06)
      .setOrigin(0, 0)
      .setDepth(-10)
      .setScrollFactor(0);
  }

  /** Call from GameScene.create() — fade in from black */
  playIntro(): void {
    this.scene.cameras.main.fadeIn(600, 0, 0, 0);
  }

  /** Flash the camera at map boundary */
  playMapBoundaryFlash(): void {
    this.scene.cameras.main.flash(80, 255, 255, 255, false);
  }

  /** Full map transition: block input + flash */
  playMapTransition(onMidpoint: () => void): void {
    this.inputBlocked = true;
    this.scene.cameras.main.flash(80, 255, 255, 255, false);
    this.scene.time.delayedCall(200, () => {
      onMidpoint();
      this.scene.time.delayedCall(300, () => {
        this.inputBlocked = false;
      });
    });
  }

  isInputBlocked(): boolean { return this.inputBlocked; }

  /** Eyelid close animation → onComplete */
  playSleepIn(onComplete: () => void): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    this.eyelidRT = this.scene.add.renderTexture(0, 0, W, H)
      .setDepth(200)
      .setScrollFactor(0);

    let progress = 0;
    const totalFrames = 60;
    this.eyelidTimer = this.scene.time.addEvent({
      delay: 16,
      repeat: totalFrames - 1,
      callback: () => {
        progress += 1 / totalFrames;
        this.drawEyelid(progress, W, H);
        if (progress >= 1) {
          onComplete();
        }
      },
    });
  }

  /** Eyelid open animation → onComplete */
  playSleepOut(onComplete: () => void): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    if (!this.eyelidRT) {
      this.eyelidRT = this.scene.add.renderTexture(0, 0, W, H)
        .setDepth(200)
        .setScrollFactor(0);
      this.drawEyelid(1, W, H);
    }

    let progress = 1;
    const totalFrames = 48; // slightly faster wakeup
    this.eyelidTimer = this.scene.time.addEvent({
      delay: 16,
      repeat: totalFrames - 1,
      callback: () => {
        progress -= 1 / totalFrames;
        if (progress <= 0) {
          this.eyelidRT?.destroy();
          this.eyelidRT = null;
          // Morning flash
          this.scene.cameras.main.flash(300, 255, 240, 180, false);
          onComplete();
        } else {
          this.drawEyelid(progress, W, H);
        }
      },
    });
  }

  private drawEyelid(progress: number, W: number, H: number): void {
    if (!this.eyelidRT) return;
    const gfx = this.scene.make.graphics({});
    gfx.fillStyle(0x000000, 1);
    gfx.fillRect(0, 0, W, H);
    // Ellipse hole shrinks as progress → 1
    const rx = Math.max(0, (1 - progress) * W * 0.6);
    const ry = Math.max(0, (1 - Phaser.Math.Easing.Cubic.InOut(progress)) * H * 0.28);
    if (rx > 0 && ry > 0) {
      gfx.fillStyle(0x000000, 1);
      gfx.fillEllipse(W / 2, H / 2, rx * 2, ry * 2);
    }
    this.eyelidRT.clear();
    this.eyelidRT.fill(0x000000, 1.0);
    if (rx > 0 && ry > 0) {
      this.eyelidRT.erase(gfx);
    }
    gfx.destroy();
  }

  /** Death visual sequence: vignette + desaturate + fade */
  playDeathSequence(onPanelReady: () => void): void {
    // Just do the existing camera fade (vignette/postFX not available in all configs)
    this.scene.cameras.main.fadeOut(1000, 0, 0, 0, (_cam: unknown, progress: number) => {
      if (progress === 1) {
        onPanelReady();
      }
    });
  }

  /** Update sky background tint each frame */
  update(gameHour: number, season: Season): void {
    const color = getSkyTint(gameHour, season);
    this.skyRect.setFillStyle(color);
  }

  destroy(): void {
    this.eyelidTimer?.destroy();
    this.eyelidRT?.destroy();
    this.skyRect.destroy();
  }
}
