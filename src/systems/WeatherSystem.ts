import Phaser from 'phaser';
import { GameTime, Season } from './GameTime';

export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'fog' | 'leaves' | 'snow' | 'storm' | 'blizzard';

interface WeatherConfig {
  icon: string;
  speedMod: number;      // 이동속도 배수 (1.0 = 기준)
  fisherBonus: number;   // 낚시 성공률 보정 (0.1 = +10%)
  hungerMod: number;     // 허기 감소 속도 배수
}

const WEATHER_CONFIGS: Record<WeatherType, WeatherConfig> = {
  clear:     { icon: '☀', speedMod: 1.0, fisherBonus: 0, hungerMod: 1.0 },
  cloudy:    { icon: '☁', speedMod: 1.0, fisherBonus: 0, hungerMod: 1.0 },
  rain:      { icon: '🌧', speedMod: 0.9, fisherBonus: 0.1, hungerMod: 1.0 },
  fog:       { icon: '🌫', speedMod: 1.0, fisherBonus: 0, hungerMod: 1.0 },
  leaves:    { icon: '🍂', speedMod: 1.0, fisherBonus: 0, hungerMod: 1.0 },
  snow:      { icon: '❄', speedMod: 0.85, fisherBonus: 0, hungerMod: 1.2 },
  storm:     { icon: '⛈', speedMod: 0.8, fisherBonus: 0, hungerMod: 1.0 },
  blizzard:  { icon: '🌨', speedMod: 0.6, fisherBonus: 0, hungerMod: 1.4 },
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

  constructor(
    private scene: Phaser.Scene,
    private gameTime: GameTime,
    private seed: string,
  ) {
    this.updateWeatherForDay();
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

    this.currentWeather = selected;
    this.lastDay = day;
  }

  getWeather(): WeatherType {
    return this.currentWeather;
  }

  getWeatherIcon(): string {
    return WEATHER_CONFIGS[this.currentWeather].icon;
  }

  getSpeedModifier(): number {
    return WEATHER_CONFIGS[this.currentWeather].speedMod;
  }

  getHungerModifier(): number {
    return WEATHER_CONFIGS[this.currentWeather].hungerMod;
  }

  getFisherBonus(): number {
    return WEATHER_CONFIGS[this.currentWeather].fisherBonus;
  }

  update(delta: number): void {
    // 하루 변경 감지 시 날씨 업데이트
    if (this.gameTime.day !== this.lastDay) {
      this.updateWeatherForDay();
    }
  }
}
