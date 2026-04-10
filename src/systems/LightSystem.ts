import Phaser from 'phaser';
import { DarknessLayer } from '../ui/DarknessLayer';
import type { LightSource } from '../ui/DarknessLayer';

const TORCH_DURATION_MS = 10 * 60 * 1000;   // 10 minutes real time
const TORCH_WARN_MS = 30_000;

export type { LightSource };

export class LightSystem {
  private lights = new Map<string, LightSource>();
  private darknessLayer: DarknessLayer;
  private darknessAlpha = 0;

  // Torch state
  private torchRemainingMs = 0;
  private torchWarnedOnce = false;
  private onTorchExpired?: () => void;
  private onTorchWarning?: () => void;

  constructor(scene: Phaser.Scene) {
    this.darknessLayer = new DarknessLayer(scene);
  }

  addLight(light: LightSource): void {
    this.lights.set(light.id, { ...light });
  }

  removeLight(id: string): void {
    this.lights.delete(id);
  }

  updateLight(id: string, x: number, y: number): void {
    const l = this.lights.get(id);
    if (l) { l.x = x; l.y = y; }
  }

  /** Equip carried torch: register player_torch light, start countdown */
  equipTorch(): void {
    this.torchRemainingMs = TORCH_DURATION_MS;
    this.torchWarnedOnce = false;
    this.lights.set('player_torch', {
      id: 'player_torch', x: 0, y: 0, radius: 160, flicker: true, type: 'player_torch',
    });
  }

  unequipTorch(): void {
    this.lights.delete('player_torch');
    this.torchRemainingMs = 0;
    this.torchWarnedOnce = false;
  }

  hasTorch(): boolean { return this.lights.has('player_torch'); }
  getTorchRemaining(): number { return this.torchRemainingMs; }
  setTorchRemaining(ms: number): void { this.torchRemainingMs = ms; }

  setOnTorchExpired(cb: () => void): void { this.onTorchExpired = cb; }
  setOnTorchWarning(cb: () => void): void { this.onTorchWarning = cb; }

  getDarknessAlpha(): number { return this.darknessAlpha; }
  isNight(): boolean { return this.darknessAlpha > 0.3; }
  getAllLights(): LightSource[] { return [...this.lights.values()]; }

  update(
    delta: number,
    gameHour: number,
    playerX: number,
    playerY: number,
    camera: Phaser.Cameras.Scene2D.Camera,
    time: number,
    isIndoor: boolean,
    weatherLightRadius = 1.0,
    weatherTorchDuration = 1.0,
  ): void {
    this.darknessAlpha = isIndoor ? 0 : getDarknessAlpha(gameHour);

    // Update player body light position
    const bodyLight = this.lights.get('player_body');
    if (bodyLight) { bodyLight.x = playerX; bodyLight.y = playerY; }

    // Update torch light position
    const torchLight = this.lights.get('player_torch');
    if (torchLight) {
      torchLight.x = playerX;
      torchLight.y = playerY;

      // Countdown (weather torchDuration < 1 → faster drain)
      this.torchRemainingMs -= delta * (weatherTorchDuration > 0 ? 1 / weatherTorchDuration : 1);
      if (!this.torchWarnedOnce && this.torchRemainingMs <= TORCH_WARN_MS) {
        this.torchWarnedOnce = true;
        this.onTorchWarning?.();
      }
      if (this.torchRemainingMs <= 0) {
        this.lights.delete('player_torch');
        this.torchRemainingMs = 0;
        this.onTorchExpired?.();
      }
    }

    // Apply weather light radius multiplier to a copy of lights
    const lightsWithWeather = [...this.lights.values()].map(l => ({
      ...l,
      radius: l.radius * (isIndoor ? 1.0 : weatherLightRadius),
    }));

    this.darknessLayer.update(
      this.darknessAlpha,
      lightsWithWeather,
      camera,
      time,
    );
  }

  /** Sync campfire light sources (prefix 'cf_'): add new, update existing, remove stale */
  syncCampfireLights(sources: LightSource[]): void {
    const incoming = new Map(sources.map(l => [l.id, l]));
    // Remove stale campfire lights
    for (const id of [...this.lights.keys()]) {
      if (id.startsWith('cf_') && !incoming.has(id)) {
        this.lights.delete(id);
      }
    }
    // Add/update
    for (const l of sources) {
      this.lights.set(l.id, { ...l });
    }
  }

  /** Ensure player_body always exists as base light */
  initPlayerBody(x: number, y: number): void {
    this.lights.set('player_body', {
      id: 'player_body', x, y, radius: 64, flicker: false, type: 'player_body',
    });
  }

  destroy(): void {
    this.darknessLayer.destroy();
  }
}

function getDarknessAlpha(gameHour: number): number {
  if (gameHour >= 6  && gameHour < 8)  return lerp(0.85, 0.0,  (gameHour - 6)  / 2);
  if (gameHour >= 8  && gameHour < 18) return 0.0;
  if (gameHour >= 18 && gameHour < 20) return lerp(0.0,  0.55, (gameHour - 18) / 2);
  if (gameHour >= 20 && gameHour < 22) return lerp(0.55, 0.85, (gameHour - 20) / 2);
  return 0.85;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
