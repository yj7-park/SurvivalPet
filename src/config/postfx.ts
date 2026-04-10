import type { WeatherType } from '../systems/WeatherSystem';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface ColorGrade {
  saturation: number;   // -1~1  (0 = no change)
  brightness: number;   // -1~1  (0 = no change)
  hue:        number;   // degrees
  contrast:   number;   // 0~2   (1 = no change)
}

export const SEASON_GRADES: Record<Season, ColorGrade> = {
  spring: { saturation:  0.10, brightness:  0.03, hue:   5, contrast: 1.02 },
  summer: { saturation:  0.20, brightness:  0.05, hue:   0, contrast: 1.05 },
  autumn: { saturation:  0.05, brightness: -0.02, hue:  12, contrast: 1.08 },
  winter: { saturation: -0.25, brightness: -0.05, hue:  -8, contrast: 0.96 },
};

export const WEATHER_GRADES: Record<WeatherType, Partial<ColorGrade>> = {
  clear:    {},
  cloudy:   { saturation: -0.10, brightness: -0.04 },
  rain:     { saturation: -0.15, brightness: -0.08, contrast: 0.95 },
  fog:      { saturation: -0.30, brightness:  0.05, contrast: 0.90 },
  snow:     { saturation: -0.20, brightness:  0.08 },
  storm:    { saturation: -0.20, brightness: -0.12, contrast: 0.92 },
  blizzard: { saturation: -0.40, brightness: -0.08, contrast: 0.88 },
  leaves:   { saturation:  0.10, hue: 8, brightness: 0, contrast: 1 },
};

export type ShakeType =
  | 'mine_hit' | 'explosion' | 'player_hit'
  | 'boss_attack' | 'tree_fall' | 'thunder' | 'map_transition';

export const SHAKE_CONFIGS: Record<ShakeType, { duration: number; magnitude: number }> = {
  mine_hit:       { duration:  60, magnitude: 0.003 },
  explosion:      { duration: 200, magnitude: 0.008 },
  player_hit:     { duration: 100, magnitude: 0.005 },
  boss_attack:    { duration: 200, magnitude: 0.010 },
  tree_fall:      { duration: 150, magnitude: 0.004 },
  thunder:        { duration: 300, magnitude: 0.006 },
  map_transition: { duration:  80, magnitude: 0.002 },
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function mergeGrades(season: ColorGrade, weather: Partial<ColorGrade>, gameHour: number): ColorGrade {
  let sat = clamp(season.saturation + (weather.saturation ?? 0), -1, 1);
  let bri = clamp(season.brightness + (weather.brightness ?? 0), -1, 1);
  let hue = (season.hue ?? 0) + (weather.hue ?? 0);
  let con = clamp((season.contrast ?? 1) * (weather.contrast ?? 1), 0.5, 1.5);

  if (gameHour >= 22 || gameHour < 6) {
    sat = clamp(sat - 0.15, -1, 1);
    hue -= 15;
  }

  return { saturation: sat, brightness: bri, hue, contrast: con };
}
