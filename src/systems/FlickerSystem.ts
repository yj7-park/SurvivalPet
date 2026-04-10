import type { WeatherType } from './WeatherSystem';

/**
 * 광원별 독립적인 3중 사인파 깜빡임.
 * DarknessLayer의 단순 사인파를 대체하는 고품질 버전.
 */
export class FlickerSystem {
  private seeds = new Map<string, number>();

  private readonly AMP: Record<string, number> = {
    player_torch: 8,
    placed_torch: 6,
    campfire:     14,
    player_body:  0,
  };

  /** 광원 ID별 독립적인 깜빡임 반경 계산 */
  getFlickerRadius(lightId: string, lightType: string, baseRadius: number, timeMs: number): number {
    if (!this.seeds.has(lightId)) {
      // 각 광원마다 다른 위상
      let hash = 0;
      for (let i = 0; i < lightId.length; i++) hash = (hash * 31 + lightId.charCodeAt(i)) >>> 0;
      this.seeds.set(lightId, (hash % 1000) + 1);
    }
    const seed = this.seeds.get(lightId)!;
    const t = timeMs / 1000 + seed;

    const s1 = Math.sin(t * 2.1) * 0.5;
    const s2 = Math.sin(t * 3.7 + 1.3) * 0.3;
    const s3 = Math.sin(t * 7.3 + 2.7) * 0.2;
    const noise = s1 + s2 + s3;

    const amp = this.AMP[lightType] ?? 6;
    return baseRadius + noise * amp;
  }

  /** 강한 바람/폭풍 시 깜빡임 증폭 */
  getWindMultiplier(weather: WeatherType): number {
    return weather === 'storm' || weather === 'blizzard' ? 1.8 : 1.0;
  }

  removeSeed(lightId: string): void {
    this.seeds.delete(lightId);
  }
}
