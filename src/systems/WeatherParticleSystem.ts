import Phaser from 'phaser';
import { WeatherType } from './WeatherSystem';
import { SoundSystem } from './SoundSystem';
import { isTouchDevice } from './TouchInputSystem';

// Target quantities for each weather type (emitter: quantity per fire)
const TARGET_QUANTITY: Partial<Record<WeatherType, number>> = {
  rain:     isTouchDevice ? 3 : 6,
  fog:      0,
  leaves:   1,
  snow:     isTouchDevice ? 1 : 2,
  storm:    isTouchDevice ? 5 : 10,
  blizzard: isTouchDevice ? 4 : 8,
};

export class WeatherParticleSystem {
  private scene: Phaser.Scene;
  private sound: SoundSystem | null;

  // Active emitters per weather type
  private rainEmitter:     Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private rippleEmitter:   Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private snowEmitter:     Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private leafEmitter:     Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  // Overlays
  private fogOverlay:      Phaser.GameObjects.Rectangle | null = null;
  private fogLayerA:       Phaser.GameObjects.Image | null = null;
  private fogLayerB:       Phaser.GameObjects.Image | null = null;
  private fogTweenA:       Phaser.Tweens.Tween | null = null;
  private fogTweenB:       Phaser.Tweens.Tween | null = null;
  private blizzardOverlay: Phaser.GameObjects.Rectangle | null = null;
  private waterSlide:      Phaser.GameObjects.RenderTexture | null = null;
  private waterSlideTimer: Phaser.Time.TimerEvent | null = null;

  // Storm
  private lightningTimer:  Phaser.Time.TimerEvent | null = null;
  private stormShake      = 0;

  private current: WeatherType = 'clear';
  private indoor  = false;

  constructor(scene: Phaser.Scene, sound: SoundSystem | null = null) {
    this.scene = scene;
    this.sound = sound;
  }

  setWeather(type: WeatherType, fadeDuration = 2000): void {
    if (type === this.current) return;
    const prev = this.current;
    this.current = type;

    // Fade out old
    this.fadeOutWeather(prev, fadeDuration / 2);

    // Fade in new after quarter overlap
    this.scene.time.delayedCall(fadeDuration / 4, () => {
      this.startWeather(type);
    });
  }

  setIndoor(indoor: boolean): void {
    this.indoor = indoor;
    const visible = !indoor;
    this.setAllVisible(visible);
  }

  update(delta: number): void {
    if (this.indoor) return;

    // Storm camera shake
    if (this.current === 'storm') {
      this.stormShake += delta;
      if (this.stormShake > Phaser.Math.Between(2000, 5000)) {
        this.scene.cameras.main.shake(300, 0.002);
        this.stormShake = 0;
      }
    }

    // Snow drift
    if (this.snowEmitter) {
      const now = this.scene.time.now;
      this.snowEmitter.forEachAlive((p: Phaser.GameObjects.Particles.Particle) => {
        p.x += Math.sin(now * 0.001 + p.angle) * 0.3;
      }, this);
    }

    // Leaf sway
    if (this.leafEmitter) {
      const now = this.scene.time.now;
      this.leafEmitter.forEachAlive((p: Phaser.GameObjects.Particles.Particle) => {
        p.x += Math.sin(now * 0.0008 + (p as unknown as { lifeT: number }).lifeT * 10) * 0.6;
      }, this);
    }
  }

  destroy(): void {
    this.stopAll();
  }

  // ── private ──────────────────────────────────────────────────────────────

  private startWeather(type: WeatherType): void {
    if (type === 'rain')     this.startRain();
    if (type === 'storm')    this.startStorm();
    if (type === 'snow')     this.startSnow();
    if (type === 'fog')      this.startFog();
    if (type === 'blizzard') this.startBlizzard();
    if (type === 'leaves')   this.startLeaves();
  }

  private fadeOutWeather(type: WeatherType, duration: number): void {
    if (type === 'rain' || type === 'storm') {
      this.fadeEmitter(this.rainEmitter,   duration, () => { this.rainEmitter?.destroy();   this.rainEmitter = null; });
      this.fadeEmitter(this.rippleEmitter, duration, () => { this.rippleEmitter?.destroy(); this.rippleEmitter = null; });
      this.stopWaterSlide();
      if (type === 'storm') this.stopLightning();
    }
    if (type === 'snow')     { this.fadeEmitter(this.snowEmitter, duration, () => { this.snowEmitter?.destroy(); this.snowEmitter = null; }); }
    if (type === 'leaves')   { this.fadeEmitter(this.leafEmitter, duration, () => { this.leafEmitter?.destroy(); this.leafEmitter = null; }); }
    if (type === 'fog')      { this.stopFog(duration); }
    if (type === 'blizzard') {
      this.fadeEmitter(this.snowEmitter, duration, () => { this.snowEmitter?.destroy(); this.snowEmitter = null; });
      this.scene.tweens.add({
        targets: this.blizzardOverlay,
        alpha: 0, duration,
        onComplete: () => { this.blizzardOverlay?.destroy(); this.blizzardOverlay = null; },
      });
    }
  }

  // ── Rain ──────────────────────────────────────────────────────────────────

  private startRain(): void {
    const W = this.scene.scale.width;
    if (!this.scene.textures.exists('fx_raindrop')) return;

    this.rainEmitter = this.scene.add.particles(0, -10, 'fx_raindrop', {
      x:        { min: -50, max: W + 50 },
      y:        -10,
      speedX:   { min: -30, max: -10 },
      speedY:   { min: 380, max: 460 },
      scale:    { min: 0.8, max: 1.2 },
      alpha:    { min: 0.4, max: 0.7 },
      lifespan: { min: 800, max: 1200 },
      quantity:  TARGET_QUANTITY.rain ?? 4,
      frequency: 16,
      blendMode: Phaser.BlendModes.ADD,
    }).setScrollFactor(0).setDepth(50);

    this.rippleEmitter = this.scene.add.particles(0, 0, 'fx_raindrop', {
      x:        { min: 0, max: W },
      y:        { min: this.scene.scale.height - 60, max: this.scene.scale.height - 10 },
      speedX:   0,
      speedY:   0,
      scaleX:   { start: 0.15, end: 1.2 },
      scaleY:   { start: 0.05, end: 0.3 },
      alpha:    { start: 0.45, end: 0 },
      lifespan: 380,
      quantity:  1,
      frequency: 40,
      tint:      0xaaccff,
    }).setScrollFactor(0).setDepth(50);

    this.startWaterSlide();
  }

  private startWaterSlide(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    this.waterSlide = this.scene.add.renderTexture(0, 0, W, H)
      .setScrollFactor(0).setDepth(49).setAlpha(0.08);

    this.waterSlideTimer = this.scene.time.addEvent({
      delay: 300, loop: true,
      callback: () => {
        if (!this.waterSlide) return;
        const gfx = this.scene.make.graphics({});
        gfx.fillStyle(0xaaddff, 1.0);
        gfx.fillRect(
          Phaser.Math.Between(0, W),
          Phaser.Math.Between(0, Math.floor(H * 0.7)),
          1,
          Phaser.Math.Between(30, 80),
        );
        this.waterSlide.draw(gfx);
        gfx.destroy();
        if (this.waterSlide.alpha > 0.04) {
          this.waterSlide.setAlpha(this.waterSlide.alpha - 0.005);
        }
      },
    });
  }

  private stopWaterSlide(): void {
    this.waterSlideTimer?.destroy();
    this.waterSlideTimer = null;
    this.waterSlide?.destroy();
    this.waterSlide = null;
  }

  // ── Storm ─────────────────────────────────────────────────────────────────

  private startStorm(): void {
    const W = this.scene.scale.width;
    if (!this.scene.textures.exists('fx_raindrop')) return;

    this.rainEmitter = this.scene.add.particles(0, -10, 'fx_raindrop', {
      x:        { min: -50, max: W + 50 },
      y:        -10,
      speedX:   { min: -120, max: -80 },
      speedY:   { min: 500, max: 620 },
      scale:    { min: 0.8, max: 1.4 },
      alpha:    { min: 0.5, max: 0.85 },
      lifespan: { min: 600, max: 900 },
      quantity:  TARGET_QUANTITY.storm ?? 10,
      frequency: 16,
      blendMode: Phaser.BlendModes.ADD,
    }).setScrollFactor(0).setDepth(50);

    this.startWaterSlide();
    this.scheduleLightning();
  }

  private scheduleLightning(): void {
    const delay = Phaser.Math.Between(8000, 25000);
    this.lightningTimer = this.scene.time.delayedCall(delay, () => {
      if (this.current === 'storm' && !this.indoor) {
        this.triggerLightning();
        this.scheduleLightning();
      }
    });
  }

  private triggerLightning(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // Double flash
    this.scene.cameras.main.flash(80, 255, 255, 255, false);
    this.scene.time.delayedCall(120, () => {
      this.scene.cameras.main.flash(40, 255, 255, 255, false);
    });

    // Bolt
    const boltGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(60);
    const startX = Phaser.Math.Between(80, W - 80);
    this.drawLightningBolt(boltGfx, startX, 0, startX + Phaser.Math.Between(-60, 60), H);
    this.scene.time.delayedCall(120, () => boltGfx.destroy());

    // Thunder SFX
    this.scene.time.delayedCall(Phaser.Math.Between(200, 800), () => {
      this.sound?.play('thunder', { volume: 0.6 });
    });
  }

  private drawLightningBolt(
    gfx: Phaser.GameObjects.Graphics,
    x1: number, y1: number, x2: number, y2: number,
    depth = 0,
  ): void {
    if (depth > 4 || Math.abs(y2 - y1) < 20) {
      gfx.lineStyle(depth === 0 ? 3 : 1, 0xffffff, depth === 0 ? 0.9 : 0.5);
      gfx.beginPath();
      gfx.moveTo(x1, y1);
      gfx.lineTo(x2, y2);
      gfx.strokePath();
      return;
    }
    const mx = (x1 + x2) / 2 + Phaser.Math.Between(-40, 40);
    const my = (y1 + y2) / 2;
    this.drawLightningBolt(gfx, x1, y1, mx, my, depth + 1);
    this.drawLightningBolt(gfx, mx, my, x2, y2, depth + 1);
  }

  private stopLightning(): void {
    this.lightningTimer?.destroy();
    this.lightningTimer = null;
  }

  // ── Snow ──────────────────────────────────────────────────────────────────

  private startSnow(): void {
    const W = this.scene.scale.width;
    if (!this.scene.textures.exists('fx_snowflake')) return;

    this.snowEmitter = this.scene.add.particles(0, -10, 'fx_snowflake', {
      x:        { min: -20, max: W + 20 },
      y:        -10,
      speedX:   { min: -15, max: 15 },
      speedY:   { min: 40, max: 90 },
      rotate:   { min: -60, max: 60 },
      scale:    { min: 0.6, max: 1.8 },
      alpha:    { min: 0.5, max: 0.95 },
      lifespan: { min: 3000, max: 5000 },
      quantity:  TARGET_QUANTITY.snow ?? 2,
      frequency: 30,
      gravityY:  20,
    }).setScrollFactor(0).setDepth(50);
  }

  // ── Fog ───────────────────────────────────────────────────────────────────

  private startFog(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    this.fogOverlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0xc8d0d8)
      .setScrollFactor(0).setAlpha(0).setDepth(48);
    this.scene.tweens.add({ targets: this.fogOverlay, alpha: 0.28, duration: 3000 });

    if (this.scene.textures.exists('fx_fog_cloud')) {
      this.fogLayerA = this.scene.add.image(-W * 0.5, H * 0.3, 'fx_fog_cloud')
        .setScrollFactor(0).setDepth(47).setAlpha(0).setScale(W / 128);
      this.fogLayerB = this.scene.add.image(W * 0.3, H * 0.6, 'fx_fog_cloud')
        .setScrollFactor(0).setDepth(47).setAlpha(0).setScale(W / 128);

      this.scene.tweens.add({ targets: [this.fogLayerA, this.fogLayerB], alpha: 0.5, duration: 3000 });

      this.fogTweenA = this.scene.tweens.add({
        targets: this.fogLayerA,
        x: `+=${W * 1.5}`,
        duration: 90000,
        repeat: -1,
        onRepeat: () => { if (this.fogLayerA) this.fogLayerA.x -= W * 1.5; },
      });
      this.fogTweenB = this.scene.tweens.add({
        targets: this.fogLayerB,
        x: `-=${W * 1.2}`,
        duration: 110000,
        repeat: -1,
        onRepeat: () => { if (this.fogLayerB) this.fogLayerB.x += W * 1.2; },
      });
    }
  }

  private stopFog(duration: number): void {
    if (this.fogOverlay) {
      this.scene.tweens.add({
        targets: this.fogOverlay, alpha: 0, duration,
        onComplete: () => { this.fogOverlay?.destroy(); this.fogOverlay = null; },
      });
    }
    if (this.fogLayerA) {
      this.fogTweenA?.stop();
      this.scene.tweens.add({
        targets: this.fogLayerA, alpha: 0, duration,
        onComplete: () => { this.fogLayerA?.destroy(); this.fogLayerA = null; },
      });
    }
    if (this.fogLayerB) {
      this.fogTweenB?.stop();
      this.scene.tweens.add({
        targets: this.fogLayerB, alpha: 0, duration,
        onComplete: () => { this.fogLayerB?.destroy(); this.fogLayerB = null; },
      });
    }
  }

  // ── Blizzard ──────────────────────────────────────────────────────────────

  private startBlizzard(): void {
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    if (this.scene.textures.exists('fx_snowflake')) {
      this.snowEmitter = this.scene.add.particles(W + 20, 0, 'fx_snowflake', {
        x:        W + 20,
        y:        { min: 0, max: H },
        speedX:   { min: -600, max: -400 },
        speedY:   { min: -30, max: 80 },
        scale:    { min: 0.4, max: 1.2 },
        alpha:    { min: 0.4, max: 0.8 },
        lifespan: { min: 1200, max: 2000 },
        quantity:  TARGET_QUANTITY.blizzard ?? 8,
        frequency: 16,
        tint:      [0xffffff, 0xddeeff],
      }).setScrollFactor(0).setDepth(50);
    }

    this.blizzardOverlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0xb0c0d8)
      .setScrollFactor(0).setAlpha(0).setDepth(48);
    this.scene.tweens.add({ targets: this.blizzardOverlay, alpha: 0.20, duration: 3000 });
  }

  // ── Leaves ────────────────────────────────────────────────────────────────

  private startLeaves(): void {
    const W = this.scene.scale.width;
    if (!this.scene.textures.exists('fx_leaf_fall')) return;

    this.leafEmitter = this.scene.add.particles(0, -10, 'fx_leaf_fall', {
      x:        { min: -20, max: W + 20 },
      y:        -10,
      speedX:   { min: -40, max: 20 },
      speedY:   { min: 30, max: 70 },
      rotate:   { min: -180, max: 180 },
      scale:    { min: 0.7, max: 1.4 },
      alpha:    { min: 0.6, max: 0.9 },
      lifespan: { min: 4000, max: 7000 },
      quantity:  TARGET_QUANTITY.leaves ?? 1,
      frequency: 200,
      tint:      [0xc86010, 0xe88030, 0xa04808, 0xdd6020, 0xf0a030],
    }).setScrollFactor(0).setDepth(50);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private fadeEmitter(
    emitter: Phaser.GameObjects.Particles.ParticleEmitter | null,
    duration: number,
    onDone: () => void,
  ): void {
    if (!emitter) return;
    const steps = Math.floor(duration / 200);
    let step = 0;
    const origQ = emitter.quantity as unknown as { propertyValue: number };
    const startQ = (typeof origQ === 'object' ? origQ.propertyValue : (emitter.quantity as unknown as number)) || 1;
    const timer = this.scene.time.addEvent({
      delay: 200,
      repeat: steps - 1,
      callback: () => {
        step++;
        // Just stop emitting new particles — existing ones will expire naturally
        if (step >= steps) {
          timer.destroy();
          emitter.stop();
          this.scene.time.delayedCall(2000, onDone);
        }
      },
    });
    void startQ; // suppress unused warning
  }

  private stopAll(): void {
    this.rainEmitter?.destroy();   this.rainEmitter = null;
    this.rippleEmitter?.destroy(); this.rippleEmitter = null;
    this.snowEmitter?.destroy();   this.snowEmitter = null;
    this.leafEmitter?.destroy();   this.leafEmitter = null;
    this.stopWaterSlide();
    this.stopFog(0);
    this.stopLightning();
    this.blizzardOverlay?.destroy(); this.blizzardOverlay = null;
  }

  private setAllVisible(visible: boolean): void {
    this.rainEmitter?.setVisible(visible);
    this.rippleEmitter?.setVisible(visible);
    this.snowEmitter?.setVisible(visible);
    this.leafEmitter?.setVisible(visible);
    this.fogOverlay?.setVisible(visible);
    this.fogLayerA?.setVisible(visible);
    this.fogLayerB?.setVisible(visible);
    this.blizzardOverlay?.setVisible(visible);
    this.waterSlide?.setVisible(visible);
  }
}
