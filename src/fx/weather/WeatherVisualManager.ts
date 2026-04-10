import { RainSystem }       from './RainSystem';
import { SnowSystem }       from './SnowSystem';
import { FogWeatherSystem } from './FogWeatherSystem';
import { SandstormSystem }  from './SandstormSystem';
import { LightningSystem }  from './LightningSystem';

export type WeatherVisualType =
  | 'clear' | 'rain' | 'heavy_rain' | 'snow' | 'fog'
  | 'sandstorm' | 'thunderstorm' | 'blizzard';

interface WeatherVisual {
  create(scene: Phaser.Scene): void;
  stop(scene: Phaser.Scene): void;
}

class ThunderstormVisual implements WeatherVisual {
  private rain      = new RainSystem();
  private lightning = new LightningSystem();
  private stormTimer?: Phaser.Time.TimerEvent;

  create(scene: Phaser.Scene): void {
    this.rain.create(scene);
    this.rain.setIntensity('heavy');
    this.lightning.create(scene);
    this.scheduleNext(scene);
  }

  private scheduleNext(scene: Phaser.Scene): void {
    const delay = 5000 + Math.random() * 10000;
    this.stormTimer = scene.time.delayedCall(delay, () => {
      this.lightning.triggerStrike(scene);
      this.scheduleNext(scene);
    });
  }

  stop(scene: Phaser.Scene): void {
    this.stormTimer?.remove();
    this.rain.stop(scene);
    this.lightning.destroy();
  }
}

export class WeatherVisualManager {
  private current: WeatherVisual | null = null;
  private currentType: WeatherVisualType = 'clear';

  transition(scene: Phaser.Scene, toWeather: WeatherVisualType): void {
    if (toWeather === this.currentType) return;
    this.currentType = toWeather;

    if (this.current) {
      this.current.stop(scene);
      this.current = null;
    }

    scene.time.delayedCall(1500, () => {
      switch (toWeather) {
        case 'rain':
        case 'heavy_rain': {
          const rain = new RainSystem();
          this.current = rain;
          rain.create(scene);
          rain.setIntensity(toWeather === 'heavy_rain' ? 'heavy' : 'moderate');
          break;
        }
        case 'snow': {
          const snow = new SnowSystem();
          this.current = snow;
          snow.create(scene);
          break;
        }
        case 'fog': {
          const fog = new FogWeatherSystem();
          this.current = fog;
          fog.create(scene, 'light');
          break;
        }
        case 'sandstorm': {
          const sand = new SandstormSystem();
          this.current = sand;
          sand.create(scene);
          break;
        }
        case 'thunderstorm': {
          const thunder = new ThunderstormVisual();
          this.current  = thunder;
          thunder.create(scene);
          break;
        }
        case 'blizzard': {
          // Heavy snow + strong wind
          const blizz = new SnowSystem();
          this.current = blizz;
          blizz.create(scene);
          break;
        }
        default:
          this.current = null;
      }
    });
  }

  stopAll(scene: Phaser.Scene): void {
    this.current?.stop(scene);
    this.current    = null;
    this.currentType = 'clear';
  }
}
