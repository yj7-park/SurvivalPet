export type TransitionType =
  | 'fade'
  | 'iris'
  | 'swipe_left'
  | 'swipe_right'
  | 'flash'
  | 'dissolve'
  | 'ripple';

export function pickTransitionType(trigger: string): TransitionType {
  if (trigger === 'teleport')      return 'flash';
  if (trigger === 'portal_magic')  return 'dissolve';
  if (trigger === 'water_surface') return 'ripple';
  if (trigger === 'dungeon_enter') return 'swipe_left';
  if (trigger === 'dungeon_exit')  return 'swipe_right';
  if (trigger === 'iris_door')     return 'iris';
  return 'fade';
}

export class MapTransitionFX {
  private scene:     Phaser.Scene;
  private overlay:   Phaser.GameObjects.Graphics;
  private pixelPool: Phaser.GameObjects.Rectangle[] = [];
  private flashRef?: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width: W, height: H } = scene.scale;

    this.overlay = scene.add.graphics()
      .setDepth(200).setAlpha(0).setScrollFactor(0);
    this.overlay.fillStyle(0x000000, 1).fillRect(0, 0, W, H);

    this._buildPixelPool(W, H);
  }

  private _buildPixelPool(W: number, H: number): void {
    const COLS = 20, ROWS = 15;
    const pw = W / COLS, ph = H / ROWS;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.pixelPool.push(
          this.scene.add
            .rectangle(c * pw + pw / 2, r * ph + ph / 2, pw, ph, 0x000000)
            .setDepth(200).setScrollFactor(0).setAlpha(0)
        );
      }
    }
  }

  out(type: TransitionType, duration = 400): Promise<void> {
    return new Promise(resolve => {
      switch (type) {
        case 'fade':        this._fadeOut(duration, resolve);             break;
        case 'iris':        this._irisClose(duration, resolve);           break;
        case 'swipe_left':  this._swipeOut('left',  duration, resolve);  break;
        case 'swipe_right': this._swipeOut('right', duration, resolve);  break;
        case 'flash':       this._flashOut(duration, resolve);            break;
        case 'dissolve':    this._dissolveOut(duration, resolve);         break;
        case 'ripple':      this._rippleOut(duration, resolve);           break;
        default:            this._fadeOut(duration, resolve);
      }
    });
  }

  in(type: TransitionType, duration = 400): Promise<void> {
    return new Promise(resolve => {
      switch (type) {
        case 'fade':        this._fadeIn(duration, resolve);               break;
        case 'iris':        this._irisOpen(duration, resolve);             break;
        case 'swipe_left':  this._swipeIn('right', duration, resolve);    break;
        case 'swipe_right': this._swipeIn('left',  duration, resolve);    break;
        case 'flash':       this._flashIn(duration, resolve);              break;
        case 'dissolve':    this._dissolveIn(duration, resolve);           break;
        case 'ripple':      this._fadeIn(duration, resolve);               break;
        default:            this._fadeIn(duration, resolve);
      }
    });
  }

  private _fadeOut(ms: number, done: () => void): void {
    this.overlay.setAlpha(0);
    this.scene.tweens.add({
      targets: this.overlay, alpha: 1,
      duration: ms, ease: 'Linear', onComplete: done,
    });
  }

  private _fadeIn(ms: number, done: () => void): void {
    this.overlay.setAlpha(1);
    this.scene.tweens.add({
      targets: this.overlay, alpha: 0,
      duration: ms, ease: 'Linear', onComplete: done,
    });
  }

  private _irisClose(ms: number, done: () => void): void {
    const { width: W, height: H } = this.scene.scale;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.hypot(W, H) / 2;

    const rt  = this.scene.add.renderTexture(0, 0, W, H).setDepth(200).setScrollFactor(0);
    const gfx = this.scene.add.graphics().setVisible(false);

    this.scene.tweens.add({
      targets: {}, progress: { from: 0, to: 1 },
      duration: ms, ease: 'Sine.easeIn',
      onUpdate: (_: unknown, __: unknown, ___: unknown, progress: number) => {
        const r = Phaser.Math.Linear(maxR, 0, progress);
        rt.clear();
        gfx.clear().fillStyle(0x000000, 1).fillRect(0, 0, W, H);
        rt.draw(gfx, 0, 0);
        gfx.clear().fillStyle(0xffffff, 1).fillCircle(cx, cy, r);
        rt.erase(gfx, 0, 0);
      },
      onComplete: () => { gfx.destroy(); rt.destroy(); done(); },
    });
  }

  private _irisOpen(ms: number, done: () => void): void {
    const { width: W, height: H } = this.scene.scale;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.hypot(W, H) / 2;

    const rt  = this.scene.add.renderTexture(0, 0, W, H).setDepth(200).setScrollFactor(0);
    const gfx = this.scene.add.graphics().setVisible(false);

    this.scene.tweens.add({
      targets: {}, progress: { from: 0, to: 1 },
      duration: ms, ease: 'Sine.easeOut',
      onUpdate: (_: unknown, __: unknown, ___: unknown, progress: number) => {
        const r = Phaser.Math.Linear(0, maxR, progress);
        rt.clear();
        gfx.clear().fillStyle(0x000000, 1).fillRect(0, 0, W, H);
        rt.draw(gfx, 0, 0);
        gfx.clear().fillStyle(0xffffff, 1).fillCircle(cx, cy, r);
        rt.erase(gfx, 0, 0);
      },
      onComplete: () => { gfx.destroy(); rt.destroy(); done(); },
    });
  }

  private _swipeOut(dir: 'left' | 'right', ms: number, done: () => void): void {
    const { width: W, height: H } = this.scene.scale;
    const startX = dir === 'left' ? W : -W;
    const panel  = this.scene.add
      .rectangle(startX + W / 2, H / 2, W, H, 0x000000)
      .setDepth(200).setScrollFactor(0);
    this.scene.tweens.add({
      targets: panel, x: W / 2,
      duration: ms, ease: 'Cubic.easeIn',
      onComplete: () => { panel.setVisible(false); done(); },
    });
  }

  private _swipeIn(dir: 'left' | 'right', ms: number, done: () => void): void {
    const { width: W, height: H } = this.scene.scale;
    const endX  = dir === 'left' ? -W / 2 : W * 1.5;
    const panel = this.scene.add
      .rectangle(W / 2, H / 2, W, H, 0x000000)
      .setDepth(200).setScrollFactor(0);
    this.scene.tweens.add({
      targets: panel, x: endX,
      duration: ms, ease: 'Cubic.easeOut',
      onComplete: () => { panel.destroy(); done(); },
    });
  }

  private _flashOut(ms: number, done: () => void): void {
    const { width: W, height: H } = this.scene.scale;
    const flash = this.scene.add
      .rectangle(W / 2, H / 2, W, H, 0xffffff)
      .setDepth(200).setScrollFactor(0).setAlpha(0);
    this.flashRef = flash;
    this.scene.tweens.add({
      targets: flash, alpha: 1,
      duration: ms * 0.3, ease: 'Expo.easeOut',
      onComplete: () => done(),
    });
  }

  private _flashIn(ms: number, done: () => void): void {
    const flash = this.flashRef;
    if (!flash) { this._fadeIn(ms, done); return; }
    this.scene.tweens.add({
      targets: flash, alpha: 0,
      duration: ms, ease: 'Linear',
      onComplete: () => { flash.destroy(); this.flashRef = undefined; done(); },
    });
  }

  private _dissolveOut(ms: number, done: () => void): void {
    const indices = Phaser.Utils.Array.Shuffle([...Array(this.pixelPool.length).keys()]);
    const delay   = ms / this.pixelPool.length;
    indices.forEach((idx, order) => {
      this.scene.time.delayedCall(order * delay, () => { this.pixelPool[idx].setAlpha(1); });
    });
    this.scene.time.delayedCall(ms + 50, done);
  }

  private _dissolveIn(ms: number, done: () => void): void {
    const indices = Phaser.Utils.Array.Shuffle([...Array(this.pixelPool.length).keys()]);
    const delay   = ms / this.pixelPool.length;
    indices.forEach((idx, order) => {
      this.scene.time.delayedCall(order * delay, () => { this.pixelPool[idx].setAlpha(0); });
    });
    this.scene.time.delayedCall(ms + 50, done);
  }

  private _rippleOut(ms: number, done: () => void): void {
    const cam = this.scene.cameras.main;
    cam.shake(ms * 0.4, 0.004);
    cam.fade(ms, 0, 0, 0, false, (_: unknown, progress: number) => {
      if (progress === 1) done();
    });
  }

  destroy(): void {
    this.overlay.destroy();
    this.pixelPool.forEach(r => r.destroy());
    this.pixelPool.length = 0;
    this.flashRef?.destroy();
  }
}

// ── Helper effects ────────────────────────────────────────────────────────────

export function playDoorExitTrail(
  scene: Phaser.Scene,
  playerX: number, playerY: number,
  dir: 'up' | 'down' | 'left' | 'right',
): void {
  const dx = dir === 'left' ? -6 : dir === 'right' ? 6 : 0;
  const dy = dir === 'up'   ? -6 : dir === 'down'  ? 6 : 0;

  for (let i = 0; i < 5; i++) {
    const fp = scene.add.graphics()
      .fillStyle(0xffffff, 0.4)
      .fillEllipse(playerX + dx * i, playerY + dy * i + 6, 6, 4)
      .setDepth(50);
    scene.tweens.add({
      targets: fp, alpha: 0,
      duration: 500, delay: i * 60,
      onComplete: () => fp.destroy(),
    });
  }
}

export function playTeleportLeaveEffect(scene: Phaser.Scene, x: number, y: number): void {
  for (let i = 0; i < 3; i++) {
    const ring = scene.add.graphics().setDepth(60);
    scene.tweens.add({
      targets: {}, progress: { from: 0, to: 1 },
      duration: 400, delay: i * 80,
      onUpdate: (_: unknown, __: unknown, ___: unknown, p: number) => {
        ring.clear();
        const r = Phaser.Math.Linear(10, 50, p);
        const a = Phaser.Math.Linear(0.8, 0, p);
        ring.lineStyle(3, 0xaaddff, a).strokeCircle(x, y, r);
      },
      onComplete: () => ring.destroy(),
    });
  }
  const dot = scene.add.circle(x, y, 12, 0xffffff).setDepth(61).setAlpha(1);
  scene.tweens.add({
    targets: dot, scaleX: 0, scaleY: 0, alpha: 0,
    duration: 200, ease: 'Expo.easeOut',
    onComplete: () => dot.destroy(),
  });
}

export function playTeleportArriveEffect(scene: Phaser.Scene, x: number, y: number): void {
  for (let i = 0; i < 3; i++) {
    const ring = scene.add.graphics().setDepth(60);
    scene.tweens.add({
      targets: {}, progress: { from: 0, to: 1 },
      duration: 350, delay: i * 70,
      onUpdate: (_: unknown, __: unknown, ___: unknown, p: number) => {
        ring.clear();
        const r = Phaser.Math.Linear(50, 8, p);
        const a = Phaser.Math.Linear(0, 0.7, p);
        ring.lineStyle(2, 0x88ccff, a).strokeCircle(x, y, r);
      },
      onComplete: () => ring.destroy(),
    });
  }
}

export function playPortalEnterEffect(
  scene: Phaser.Scene,
  x: number, y: number,
  color = 0x8844ff,
): void {
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const px = x + Math.cos(angle) * 30;
    const py = y + Math.sin(angle) * 30;
    const dot = scene.add.circle(px, py, 3, color).setDepth(62).setAlpha(0.9);
    scene.tweens.add({
      targets: dot, x, y, alpha: 0, scaleX: 0.2, scaleY: 0.2,
      duration: 300 + i * 20, ease: 'Sine.easeIn',
      onComplete: () => dot.destroy(),
    });
  }
  const ring = scene.add.graphics().setDepth(61);
  scene.tweens.add({
    targets: {}, progress: { from: 0, to: 1 },
    duration: 400,
    onUpdate: (_: unknown, __: unknown, ___: unknown, p: number) => {
      ring.clear();
      const r = Phaser.Math.Linear(8, 40, p);
      const a = Phaser.Math.Linear(1, 0, p);
      ring.lineStyle(4, color, a).strokeCircle(x, y, r);
    },
    onComplete: () => ring.destroy(),
  });
}

export function playStairsDescendFX(scene: Phaser.Scene, onMidpoint: () => void): void {
  const cam = scene.cameras.main;
  scene.tweens.add({
    targets: cam, scrollY: cam.scrollY + 20,
    duration: 200, ease: 'Sine.easeIn',
    onComplete: () => {
      cam.fade(200, 0, 0, 0, false, (_: unknown, p: number) => {
        if (p === 1) {
          onMidpoint();
          cam.scrollY -= 20;
          cam.fadeIn(300);
        }
      });
    },
  });
}

export function playStairsAscendFX(scene: Phaser.Scene, onMidpoint: () => void): void {
  const cam = scene.cameras.main;
  scene.tweens.add({
    targets: cam, scrollY: cam.scrollY - 20,
    duration: 200, ease: 'Sine.easeIn',
    onComplete: () => {
      cam.fade(200, 0, 0, 0, false, (_: unknown, p: number) => {
        if (p === 1) {
          onMidpoint();
          cam.scrollY += 20;
          cam.fadeIn(300);
        }
      });
    },
  });
}

export function showAreaNameBanner(scene: Phaser.Scene, areaName: string): void {
  const { width: W, height: H } = scene.scale;

  const panel = scene.add
    .rectangle(W / 2, H * 0.15 - 12, W * 0.5, 36, 0x000000, 0.55)
    .setDepth(150).setScrollFactor(0).setAlpha(0);

  const txt = scene.add.text(W / 2, H * 0.15 - 12, areaName, {
    fontSize: '18px', fontFamily: '"Noto Sans KR", sans-serif',
    color: '#ffffff', stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5).setDepth(151).setScrollFactor(0).setAlpha(0);

  scene.tweens.add({
    targets: [panel, txt], alpha: 1, y: H * 0.15,
    duration: 400, ease: 'Back.easeOut',
    onComplete: () => {
      scene.time.delayedCall(2000, () => {
        scene.tweens.add({
          targets: [panel, txt], alpha: 0, duration: 600,
          onComplete: () => { panel.destroy(); txt.destroy(); },
        });
      });
    },
  });
}
