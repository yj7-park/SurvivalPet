import { CloudLayerSystem } from './CloudLayerSystem';
import { WeatherType } from './SkyLayer';

export function showRainbow(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  const cx = cam.width * 0.6;
  const cy = cam.height * 0.55;
  const gfx = scene.add.graphics()
    .setScrollFactor(0)
    .setDepth(6)
    .setAlpha(0);

  const RAINBOW_COLORS = [0xff2020, 0xff8020, 0xffc020, 0x40c020, 0x2080ff, 0x8020ff];
  RAINBOW_COLORS.forEach((color, i) => {
    gfx.lineStyle(4, color, 0.18);
    gfx.beginPath();
    gfx.arc(cx, cy, 120 + i * 8, Math.PI * 0.9, Math.PI * 2.1, false);
    gfx.strokePath();
  });

  scene.tweens.add({ targets: gfx, alpha: 1, duration: 3000 });
  scene.time.delayedCall(20000, () => {
    scene.tweens.add({
      targets: gfx, alpha: 0, duration: 5000,
      onComplete: () => gfx.destroy(),
    });
  });
}

export function applyWeatherClouds(
  cloudSystem: CloudLayerSystem,
  weather: WeatherType
): void {
  switch (weather) {
    case 'clear':
      cloudSystem.setMaxClouds(4);
      break;
    case 'cloudy':
      cloudSystem.setMaxClouds(10);
      break;
    case 'rain':
    case 'storm':
      cloudSystem.replaceWithStormClouds();
      cloudSystem.setMaxClouds(14);
      break;
    case 'blizzard':
      cloudSystem.setStormCloudSpeed(1.8);
      cloudSystem.setMaxClouds(16);
      break;
    case 'fog':
      cloudSystem.setMaxClouds(0);
      break;
    default:
      cloudSystem.setMaxClouds(8);
  }
}
