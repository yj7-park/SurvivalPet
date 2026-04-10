import type { WeatherType } from './WeatherSystem';
import type { Season } from './GameTime';

export interface WeatherMultipliers {
  moveSpeed:     number;  // 이동속도 배율
  hungerDecay:   number;  // 허기 감소 배율
  fatigueDecay:  number;  // 피로 감소 배율
  torchDuration: number;  // 횃불 수명 배율 (작을수록 빨리 소진)
  lightRadius:   number;  // 광원 반경 배율
}

const NEUTRAL: WeatherMultipliers = {
  moveSpeed: 1.0, hungerDecay: 1.0, fatigueDecay: 1.0,
  torchDuration: 1.0, lightRadius: 1.0,
};

const WEATHER_MULTS: Record<WeatherType, WeatherMultipliers> = {
  clear:    { moveSpeed: 1.0,  hungerDecay: 1.0, fatigueDecay: 1.0, torchDuration: 1.0, lightRadius: 1.0 },
  cloudy:   { moveSpeed: 1.0,  hungerDecay: 1.0, fatigueDecay: 1.0, torchDuration: 1.0, lightRadius: 0.9 },
  rain:     { moveSpeed: 0.9,  hungerDecay: 1.1, fatigueDecay: 1.1, torchDuration: 0.6, lightRadius: 1.0 },
  fog:      { moveSpeed: 0.95, hungerDecay: 1.0, fatigueDecay: 1.0, torchDuration: 1.0, lightRadius: 0.6 },
  leaves:   { moveSpeed: 1.0,  hungerDecay: 1.0, fatigueDecay: 1.0, torchDuration: 1.0, lightRadius: 1.0 },
  snow:     { moveSpeed: 0.75, hungerDecay: 1.3, fatigueDecay: 1.2, torchDuration: 0.5, lightRadius: 1.0 },
  storm:    { moveSpeed: 0.7,  hungerDecay: 1.2, fatigueDecay: 1.3, torchDuration: 0.3, lightRadius: 0.8 },
  blizzard: { moveSpeed: 0.5,  hungerDecay: 1.5, fatigueDecay: 1.5, torchDuration: 0.1, lightRadius: 0.9 },
};

/** 계절별 낚시 성공률 보정 (가산) */
export const SEASON_FISH_BONUS: Record<Season, number> = {
  spring: 0.05,
  summer: 0.10,
  autumn: 0.00,
  winter: -0.15,
};

/** 계절별 침략 빈도 배율 */
export const SEASON_INVASION_MULT: Record<Season, number> = {
  spring: 1.0,
  summer: 1.2,
  autumn: 1.1,
  winter: 0.7,
};

/** 계절별 나무 밀도 */
export const SEASON_TREE_DENSITY: Record<Season, number> = {
  spring: 0.20,
  summer: 0.25,
  autumn: 0.18,
  winter: 0.12,
};

/** 겨울 기본 허기 배율 (맑은 날에도 ×1.1) */
const WINTER_BASE_HUNGER_MULT = 1.1;

const TRANSITION_STORM_TYPES: WeatherType[] = ['storm', 'blizzard'];
const TRANSITION_DURATION_MS = 5 * 60 * 1000; // 5 real minutes

export class WeatherEffectSystem {
  private currentWeather: WeatherType = 'clear';
  private currentSeason: Season = 'spring';
  private transitionTimer = 0;
  private fromMults: WeatherMultipliers = NEUTRAL;
  private toMults: WeatherMultipliers = NEUTRAL;
  private activeMults: WeatherMultipliers = NEUTRAL;

  onWeatherChanged(weather: WeatherType, season: Season): void {
    const prev = this.currentWeather;
    this.currentWeather = weather;
    this.currentSeason = season;
    const newMults = WEATHER_MULTS[weather] ?? NEUTRAL;
    if (TRANSITION_STORM_TYPES.includes(weather) || TRANSITION_STORM_TYPES.includes(prev)) {
      this.fromMults = { ...this.activeMults };
      this.toMults = newMults;
      this.transitionTimer = TRANSITION_DURATION_MS;
    } else {
      this.activeMults = newMults;
      this.transitionTimer = 0;
    }
  }

  update(delta: number): void {
    if (this.transitionTimer > 0) {
      this.transitionTimer -= delta;
      const t = Math.max(0, 1 - this.transitionTimer / TRANSITION_DURATION_MS);
      this.activeMults = lerpMults(this.fromMults, this.toMults, t);
      if (this.transitionTimer <= 0) {
        this.activeMults = this.toMults;
      }
    }
  }

  getMultipliers(isIndoor: boolean): WeatherMultipliers {
    if (isIndoor) return NEUTRAL;
    const m = { ...this.activeMults };
    // 겨울 기본 허기 패널티 중첩
    if (this.currentSeason === 'winter') {
      m.hungerDecay *= WINTER_BASE_HUNGER_MULT;
    }
    return m;
  }

  getCurrentWeather(): WeatherType { return this.currentWeather; }
  getCurrentSeason(): Season { return this.currentSeason; }

  /** 현재 날씨·계절에 대한 설명 툴팁 */
  getTooltip(isIndoor: boolean): string {
    if (isIndoor) return '실내에서는 날씨 패널티 없음';
    const m = WEATHER_MULTS[this.currentWeather];
    const lines: string[] = [];
    if (m.moveSpeed !== 1.0) lines.push(`• 이동속도 ${pct(m.moveSpeed)}`);
    if (m.hungerDecay !== 1.0) lines.push(`• 허기 소모 ${pct(m.hungerDecay)}`);
    if (m.fatigueDecay !== 1.0) lines.push(`• 피로 소모 ${pct(m.fatigueDecay)}`);
    if (m.torchDuration !== 1.0) lines.push(`• 횃불 수명 ${pct(m.torchDuration)}`);
    if (m.lightRadius !== 1.0) lines.push(`• 시야 ${pct(m.lightRadius)}`);
    if (this.currentSeason === 'winter') lines.push('• 허기 소모 +10% (겨울 기본)');
    if (lines.length === 0) return '';
    return lines.join('\n') + '\n실내에서는 패널티 없음';
  }
}

function pct(v: number): string {
  const diff = Math.round((v - 1) * 100);
  return diff >= 0 ? `+${diff}%` : `${diff}%`;
}

function lerpMults(a: WeatherMultipliers, b: WeatherMultipliers, t: number): WeatherMultipliers {
  return {
    moveSpeed:     lerp(a.moveSpeed,     b.moveSpeed,     t),
    hungerDecay:   lerp(a.hungerDecay,   b.hungerDecay,   t),
    fatigueDecay:  lerp(a.fatigueDecay,  b.fatigueDecay,  t),
    torchDuration: lerp(a.torchDuration, b.torchDuration, t),
    lightRadius:   lerp(a.lightRadius,   b.lightRadius,   t),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
