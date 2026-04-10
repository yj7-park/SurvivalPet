import Phaser from 'phaser';
import type { WeatherType } from './WeatherSystem';
import {
  ColorGrade, Season,
  SEASON_GRADES, WEATHER_GRADES, ShakeType, SHAKE_CONFIGS,
  mergeGrades,
} from '../config/postfx';

// ── 색조 전환 보간 ────────────────────────────────────────────
class ColorGradeTransition {
  private current: ColorGrade = { saturation: 0, brightness: 0, hue: 0, contrast: 1 };
  private target: ColorGrade = { ...this.current };
  private readonly speed = 1 / (5 * 60); // 5초 = 300프레임

  constructor(private cam: Phaser.Cameras.Scene2D.Camera) {}

  setTarget(grade: ColorGrade): void {
    this.target = grade;
  }

  update(): void {
    const t = this.speed * 60;
    this.current.saturation += (this.target.saturation - this.current.saturation) * t;
    this.current.brightness += (this.target.brightness - this.current.brightness) * t;
    this.current.hue        += (this.target.hue        - this.current.hue)        * t;
    this.current.contrast   += (this.target.contrast   - this.current.contrast)   * t;
    this.apply(this.current);
  }

  private apply(g: ColorGrade): void {
    try {
      const fx = this.cam.postFX;
      if (!fx) return;
      fx.clear();
      const cm = fx.addColorMatrix();
      cm.saturate(g.saturation, false);
      cm.brightness(1 + g.brightness, false);
      cm.hue(g.hue, false);
      cm.contrast(g.contrast, false);
    } catch {
      // postFX not supported on this platform — silently skip
    }
  }
}

// ── 빈네트 오버레이 ─────────────────────────────────────────
const VIGNETTE_ALPHA: Record<string, number> = {
  normal:   0.30,
  night:    0.45,
  indoor:   0.20,
  danger:   0.50,
  blizzard: 0.55,
};

function createVignetteOverlay(scene: Phaser.Scene, W: number, H: number): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  gfx.setScrollFactor(0).setDepth(88);

  // 바깥 테두리 4변 (각 60px 두께) — 안쪽으로 갈수록 희미하게
  const layers = [
    { pad: 0,   alpha: 0.35 },
    { pad: 60,  alpha: 0.20 },
    { pad: 120, alpha: 0.08 },
    { pad: 180, alpha: 0.00 },
  ];

  for (const { pad, alpha } of layers) {
    if (alpha === 0) continue;
    const pw = W - pad * 2;
    const ph = H - pad * 2;

    gfx.fillStyle(0x000000, alpha);
    // top strip
    gfx.fillRect(pad, pad, pw, Math.min(60, ph));
    // bottom strip
    gfx.fillRect(pad, H - pad - 60, pw, Math.min(60, ph));
    // left strip
    gfx.fillRect(pad, pad, Math.min(60, pw), ph);
    // right strip
    gfx.fillRect(W - pad - 60, pad, Math.min(60, pw), ph);
  }

  return gfx;
}

// ── 화면 흔들림 ─────────────────────────────────────────────
export class ScreenShakeSystem {
  intensity = 1.0;

  constructor(private cam: Phaser.Cameras.Scene2D.Camera) {}

  shake(type: ShakeType): void {
    if (this.intensity === 0) return;
    const cfg = SHAKE_CONFIGS[type];
    this.cam.shake(cfg.duration, cfg.magnitude * this.intensity);
  }
}

// ── 동적 해상도 ─────────────────────────────────────────────
class DynamicResolution {
  private fpsHistory: number[] = [];
  private currentScale = 1.0;
  enabled = true;

  constructor(private game: Phaser.Game) {}

  update(fps: number): void {
    if (!this.enabled) return;
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 60) this.fpsHistory.shift();
    if (this.fpsHistory.length < 30) return; // 충분한 샘플 후 판단

    const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    if (avgFps < 40 && this.currentScale > 0.75) {
      this.setScale(0.75);
    } else if (avgFps < 50 && this.currentScale > 0.88) {
      this.setScale(0.88);
    } else if (avgFps >= 58 && this.currentScale < 1.0) {
      this.setScale(1.0);
    }
  }

  private setScale(s: number): void {
    if (this.currentScale === s) return;
    this.currentScale = s;
    try {
      this.game.scale.setGameSize(Math.floor(800 * s), Math.floor(600 * s));
      this.game.scale.setZoom(1 / s);
    } catch {
      // scale API not available
    }
  }
}

// ── 게임 컨텍스트 ────────────────────────────────────────────
export interface GameContext {
  season: Season;
  weather: WeatherType;
  gameHour: number;
  fps: number;
  isNight: boolean;
  isIndoor: boolean;
  isBlizzard: boolean;
  hpRatio: number;
}

// ── PostFxSystem 통합 클래스 ─────────────────────────────────
export class PostFxSystem {
  private colorGrade: ColorGradeTransition;
  private vignetteGfx: Phaser.GameObjects.Graphics;
  private shakeSystem: ScreenShakeSystem;
  private dynRes: DynamicResolution;

  constructor(scene: Phaser.Scene) {
    const cam = scene.cameras.main;
    cam.roundPixels = true;

    this.colorGrade  = new ColorGradeTransition(cam);
    this.vignetteGfx = createVignetteOverlay(scene, scene.scale.width, scene.scale.height);
    this.shakeSystem = new ScreenShakeSystem(cam);
    this.dynRes      = new DynamicResolution(scene.game);
  }

  update(_delta: number, ctx: GameContext): void {
    // 컬러 그레이딩 타깃 갱신
    const target = mergeGrades(
      SEASON_GRADES[ctx.season],
      WEATHER_GRADES[ctx.weather],
      ctx.gameHour,
    );
    this.colorGrade.setTarget(target);
    this.colorGrade.update();

    // 빈네트 강도 결정
    let alphaKey = 'normal';
    if (ctx.isBlizzard)         alphaKey = 'blizzard';
    else if (ctx.hpRatio < 0.3) alphaKey = 'danger';
    else if (ctx.isIndoor)       alphaKey = 'indoor';
    else if (ctx.isNight)        alphaKey = 'night';
    this.vignetteGfx.setAlpha(VIGNETTE_ALPHA[alphaKey]);

    // 동적 해상도
    this.dynRes.update(ctx.fps);
  }

  shake(type: ShakeType): void { this.shakeSystem.shake(type); }
  setShakeIntensity(v: number): void { this.shakeSystem.intensity = v; }
  setDynResEnabled(v: boolean): void { this.dynRes.enabled = v; }

  destroy(): void {
    this.vignetteGfx?.destroy();
  }
}
