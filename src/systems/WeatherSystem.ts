import Phaser from 'phaser';
import { GameTime, Season } from './GameTime';
import { WeatherEffectSystem, SEASON_FISH_BONUS, SEASON_INVASION_MULT } from './WeatherEffectSystem';
import { WeatherParticleSystem } from './WeatherParticleSystem';
import { SoundSystem } from './SoundSystem';

export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'fog' | 'leaves' | 'snow' | 'storm' | 'blizzard';

const WEATHER_ICONS: Record<WeatherType, string> = {
  clear: '☀', cloudy: '☁', rain: '🌧', fog: '🌫',
  leaves: '🍂', snow: '🌨', storm: '⛈', blizzard: '❄',
};

// 계절별 날씨 확률 (합계 100%)
const SEASON_WEATHER_CHANCES: Record<Season, Record<WeatherType, number>> = {
  spring:  { clear: 50, cloudy: 25, rain: 20, fog: 5, leaves: 0, snow: 0, storm: 0, blizzard: 0 },
  summer:  { clear: 40, cloudy: 20, rain: 25, fog: 0, leaves: 0, snow: 0, storm: 15, blizzard: 0 },
  autumn:  { clear: 30, cloudy: 25, rain: 30, fog: 10, leaves: 5, snow: 0, storm: 0, blizzard: 0 },
  winter:  { clear: 20, cloudy: 30, rain: 0, fog: 10, leaves: 0, snow: 25, storm: 0, blizzard: 15 },
};

// 간단한 해시 함수 (시드 기반 날씨 결정용)
function hashNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }
  return Math.abs(hash);
}

export class WeatherSystem {
  private currentWeather: WeatherType = 'clear';
  private lastDay = -1;
  readonly effectSystem = new WeatherEffectSystem();
  particleSystem: WeatherParticleSystem | null = null;

  constructor(
    private scene: Phaser.Scene,
    private gameTime: GameTime,
    private seed: string,
  ) {
    this.updateWeatherForDay();
  }

  initParticles(sound: SoundSystem): void {
    this.particleSystem = new WeatherParticleSystem(this.scene, sound);
    this.particleSystem.setWeather(this.currentWeather, 0);
  }

  private updateWeatherForDay(): void {
    const day = this.gameTime.day;
    const season = this.gameTime.season;
    const hash = hashNumber(`${this.seed}_weather_${day}`);
    const roll = hash % 100;

    const chances = SEASON_WEATHER_CHANCES[season];
    let accumulated = 0;
    let selected: WeatherType = 'clear';

    for (const [weather, chance] of Object.entries(chances)) {
      accumulated += chance;
      if (roll < accumulated) {
        selected = weather as WeatherType;
        break;
      }
    }

    const prev = this.currentWeather;
    this.currentWeather = selected;
    this.lastDay = day;
    this.effectSystem.onWeatherChanged(selected, season);
    if (prev !== selected) {
      this.particleSystem?.setWeather(selected, 3000);
    }
  }

  getWeather(): WeatherType { return this.currentWeather; }
  getWeatherIcon(): string { return WEATHER_ICONS[this.currentWeather]; }

  /** 낚시 성공률 보정 (날씨 + 계절) */
  getFisherBonus(): number {
    return SEASON_FISH_BONUS[this.gameTime.season] ?? 0;
  }

  /** 계절별 침략 빈도 배율 */
  getInvasionFrequencyMultiplier(): number {
    return SEASON_INVASION_MULT[this.gameTime.season] ?? 1.0;
  }

  setIndoor(indoor: boolean): void {
    this.particleSystem?.setIndoor(indoor);
  }

  update(delta: number): void {
    if (this.gameTime.day !== this.lastDay) {
      this.updateWeatherForDay();
    }
    this.effectSystem.update(delta);
    this.particleSystem?.update(delta);
  }

  destroy(): void {
    this.particleSystem?.destroy();
  }
}
