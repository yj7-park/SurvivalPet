export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export class GameTime {
  private elapsed = 0;
  static readonly MS_PER_GAME_DAY = 30 * 60 * 1000; // 30 real min = 1 game day
  private readonly START_OFFSET_SECONDS = 9 * 3600; // 09:00 시작

  update(delta: number) { this.elapsed += delta; }

  get totalGameSeconds(): number {
    return this.START_OFFSET_SECONDS + (this.elapsed / GameTime.MS_PER_GAME_DAY) * 86400;
  }

  get day(): number { return Math.floor(this.totalGameSeconds / 86400); }
  get hour(): number { return Math.floor((this.totalGameSeconds % 86400) / 3600); }
  get minute(): number { return Math.floor((this.totalGameSeconds % 3600) / 60); }

  // 0=midnight, 0.25=6am, 0.5=noon, 0.75=6pm
  get dayProgress(): number { return (this.totalGameSeconds % 86400) / 86400; }

  // 계절: 봄(1~24), 여름(25~48), 가을(49~72), 겨울(73~96)
  get season(): Season {
    const dayInCycle = ((this.day) % 96) + 1;
    if (dayInCycle <= 24) return 'spring';
    if (dayInCycle <= 48) return 'summer';
    if (dayInCycle <= 72) return 'autumn';
    return 'winter';
  }

  get seasonLabel(): string {
    const labels: Record<Season, string> = {
      spring: '봄',
      summer: '여름',
      autumn: '가을',
      winter: '겨울',
    };
    return labels[this.season];
  }

  get dayInSeason(): number {
    const dayInCycle = ((this.day) % 96) + 1;
    if (dayInCycle <= 24) return dayInCycle;
    if (dayInCycle <= 48) return dayInCycle - 24;
    if (dayInCycle <= 72) return dayInCycle - 48;
    return dayInCycle - 72;
  }

  get nightOverlay(): { alpha: number } {
    const p = this.dayProgress;
    let alpha = 0;
    if (p < 0.2)       alpha = 0.55 - p * 0.75;
    else if (p < 0.3)  alpha = 0.4 - (p - 0.2) * 4;
    else if (p < 0.7)  alpha = 0;
    else if (p < 0.8)  alpha = (p - 0.7) * 4;
    else               alpha = 0.4 + (p - 0.8) * 0.75;
    return { alpha: Math.max(0, Math.min(0.7, alpha)) };
  }

  toString(): string {
    return `${this.seasonLabel} ${this.dayInSeason}일  ${String(this.hour).padStart(2,'0')}:${String(this.minute).padStart(2,'0')}`;
  }
}
