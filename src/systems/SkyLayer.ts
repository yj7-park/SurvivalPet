import Phaser from 'phaser';
import { MoonSystem } from './MoonSystem';

/** 색 lerp 유틸 */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bi = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bi;
}

/**
 * 하늘·태양·달·달빛 오버레이 통합.
 * 이미 존재하는 TransitionSystem/StarLayer와 병렬로 동작 (대체하지 않음).
 */
export class SkyLayer {
  private sunGfx: Phaser.GameObjects.Graphics;
  private moonlightGfx: Phaser.GameObjects.Graphics;
  readonly moonSystem: MoonSystem;

  constructor(private scene: Phaser.Scene, seed: string) {
    void seed;
    // 태양 그래픽 (depth 0, scrollFactor 0)
    this.sunGfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(0).setVisible(false);

    // 달빛 블루 오버레이 (depth 48)
    this.moonlightGfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(48).setVisible(false);

    this.moonSystem = new MoonSystem(scene);
  }

  update(gameHour: number, gameDay: number): void {
    this.updateSun(gameHour);
    this.moonSystem.update(gameHour, gameDay);
    this.updateMoonlightOverlay(gameHour, this.moonSystem.getMoonPhase(gameDay));
  }

  private updateSun(gameHour: number): void {
    if (gameHour < 6 || gameHour > 18) {
      this.sunGfx.setVisible(false);
      return;
    }
    this.sunGfx.setVisible(true);

    const t = (gameHour - 6) / 12;
    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;
    const x = W * 0.1 + W * 0.8 * t;
    const y = H * 0.25 - Math.sin(t * Math.PI) * (H * 0.18);

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
    if (isDaytime) {
      this.moonlightGfx.setVisible(false);
      return;
    }

    const moonStrength = Math.sin(moonPhase * Math.PI) * 0.12;
    if (moonStrength < 0.01) {
      this.moonlightGfx.setVisible(false);
      return;
    }

    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;
    this.moonlightGfx.clear().setVisible(true);
    this.moonlightGfx.fillStyle(0x1830a0, moonStrength);
    this.moonlightGfx.fillRect(0, 0, W, H);
  }

  destroy(): void {
    this.sunGfx.destroy();
    this.moonlightGfx.destroy();
    this.moonSystem.destroy();
  }
}
