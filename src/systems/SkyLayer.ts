import Phaser from 'phaser';
import { MoonSystem } from './MoonSystem';
import { CloudLayerSystem } from './CloudLayerSystem';
import { CloudShadowLayer } from './CloudShadowLayer';
import { SunRayEffect }     from './SunRayEffect';

export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'storm' | 'blizzard' | 'fog' | 'snow';

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bi = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bi;
}

export class SkyLayer {
  private sunGfx:       Phaser.GameObjects.Graphics;
  private moonlightGfx: Phaser.GameObjects.Graphics;
  private moonHaloGfx?: Phaser.GameObjects.Graphics;
  readonly moonSystem:  MoonSystem;

  private cloudSystem:  CloudLayerSystem;
  private cloudShadow:  CloudShadowLayer;
  private sunRayEffect: SunRayEffect;
  private currentWeather: WeatherType = 'clear';

  constructor(private scene: Phaser.Scene, seed: string) {
    void seed;
    this.sunGfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(0).setVisible(false);
    this.moonlightGfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(48).setVisible(false);
    this.moonSystem = new MoonSystem(scene);

    this.cloudSystem  = new CloudLayerSystem(scene);
    this.cloudShadow  = new CloudShadowLayer(scene);
    this.sunRayEffect = new SunRayEffect(scene);

    // init clouds after scene is ready (next tick)
    scene.time.delayedCall(0, () => {
      this.cloudSystem.init(scene.cameras.main);
    });
  }

  update(gameHour: number, gameDay: number): void {
    this.updateSun(gameHour);
    this.moonSystem.update(gameHour, gameDay);
    this.updateMoonlightOverlay(gameHour, this.moonSystem.getMoonPhase(gameDay));

    const delta = this.scene.game.loop.delta;
    this.cloudSystem.update(delta, gameHour);
    this.cloudShadow.update(this.cloudSystem.clouds, this.scene.cameras.main);

    // sun ray: use computed sun position
    const { x: sunX, y: sunY } = this.getSunScreenPos(gameHour);
    this.sunRayEffect.update(gameHour, sunX, sunY);

    // moon halo
    const moonPhase = this.moonSystem.getMoonPhase(gameDay);
    if (gameHour >= 20 || gameHour < 6) {
      const { x: mx, y: my } = this.getMoonScreenPos(gameHour);
      this.drawMoonHalo(mx, my, moonPhase);
    } else {
      this.moonHaloGfx?.setVisible(false);
    }
  }

  setWeather(weather: WeatherType): void {
    if (this.currentWeather === weather) return;
    this.currentWeather = weather;
    switch (weather) {
      case 'clear':    this.cloudSystem.setMaxClouds(4);  break;
      case 'cloudy':   this.cloudSystem.setMaxClouds(10); break;
      case 'rain':
      case 'storm':
        this.cloudSystem.replaceWithStormClouds();
        this.cloudSystem.setMaxClouds(14);
        break;
      case 'blizzard':
        this.cloudSystem.setStormCloudSpeed(1.8);
        this.cloudSystem.setMaxClouds(16);
        break;
      case 'fog':      this.cloudSystem.setMaxClouds(0);  break;
      default:         this.cloudSystem.setMaxClouds(8);  break;
    }
  }

  private getSunScreenPos(gameHour: number): { x: number; y: number } {
    const cam = this.scene.cameras.main;
    const W = cam.width, H = cam.height;
    const t = (gameHour - 6) / 12;
    return {
      x: W * 0.1 + W * 0.8 * t,
      y: H * 0.25 - Math.sin(t * Math.PI) * (H * 0.18),
    };
  }

  private getMoonScreenPos(gameHour: number): { x: number; y: number } {
    const cam = this.scene.cameras.main;
    const W = cam.width, H = cam.height;
    const t = gameHour >= 20 ? (gameHour - 20) / 10 : (gameHour + 4) / 10;
    return {
      x: W * 0.85 - W * 0.7 * t,
      y: H * 0.20 - Math.sin(t * Math.PI) * (H * 0.15),
    };
  }

  private updateSun(gameHour: number): void {
    if (gameHour < 6 || gameHour > 18) {
      this.sunGfx.setVisible(false);
      return;
    }
    this.sunGfx.setVisible(true);

    const t = (gameHour - 6) / 12;
    const { x, y } = this.getSunScreenPos(gameHour);
    const size = 12 + Math.abs(t - 0.5) * 2 * 8;
    const sunColor = t < 0.5
      ? lerpColor(0xff8020, 0xffe040, t * 2)
      : lerpColor(0xffe040, 0xff4010, (t - 0.5) * 2);

    this.sunGfx.clear().setPosition(x, y);
    this.sunGfx.fillStyle(sunColor, 0.2).fillCircle(0, 0, size * 2);
    this.sunGfx.fillStyle(sunColor, 0.6).fillCircle(0, 0, size * 1.3);
    this.sunGfx.fillStyle(0xffffff, 0.9).fillCircle(0, 0, size);
  }

  private updateMoonlightOverlay(gameHour: number, moonPhase: number): void {
    const isDaytime = gameHour >= 6 && gameHour < 20;
    if (isDaytime) { this.moonlightGfx.setVisible(false); return; }

    const moonStrength = Math.sin(moonPhase * Math.PI) * 0.12;
    if (moonStrength < 0.01) { this.moonlightGfx.setVisible(false); return; }

    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;
    this.moonlightGfx.clear().setVisible(true);
    this.moonlightGfx.fillStyle(0x1830a0, moonStrength);
    this.moonlightGfx.fillRect(0, 0, W, H);
  }

  private drawMoonHalo(moonX: number, moonY: number, phase: number): void {
    if (!this.moonHaloGfx) {
      this.moonHaloGfx = this.scene.add.graphics()
        .setScrollFactor(0).setDepth(1.5);
    }
    this.moonHaloGfx.clear().setVisible(true);

    const strength = Math.max(0, 1 - Math.abs(phase - 0.5) * 4);
    if (strength < 0.1) return;

    const haloDef = [
      { r: 26, color: 0xffeedd, alpha: 0.12 },
      { r: 32, color: 0xddeeff, alpha: 0.08 },
      { r: 38, color: 0xffeedd, alpha: 0.05 },
    ];
    haloDef.forEach(h => {
      this.moonHaloGfx!.lineStyle(3, h.color, h.alpha * strength);
      this.moonHaloGfx!.strokeCircle(moonX, moonY, h.r);
    });
  }

  destroy(): void {
    this.sunGfx.destroy();
    this.moonlightGfx.destroy();
    this.moonSystem.destroy();
    this.cloudSystem.destroy();
    this.cloudShadow.destroy();
    this.sunRayEffect.destroy();
    this.moonHaloGfx?.destroy();
  }
}
