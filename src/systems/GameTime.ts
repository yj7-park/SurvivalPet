export class GameTime {
  private elapsed = 0;
  static readonly MS_PER_GAME_DAY = 30 * 60 * 1000; // 30 real min = 1 game day

  update(delta: number) { this.elapsed += delta; }

  get totalGameSeconds(): number {
    return (this.elapsed / GameTime.MS_PER_GAME_DAY) * 86400;
  }
  get day(): number { return Math.floor(this.totalGameSeconds / 86400); }
  get hour(): number { return Math.floor((this.totalGameSeconds % 86400) / 3600); }
  get minute(): number { return Math.floor((this.totalGameSeconds % 3600) / 60); }
  // 0=midnight, 0.25=6am, 0.5=noon, 0.75=6pm
  get dayProgress(): number { return (this.totalGameSeconds % 86400) / 86400; }

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
    return `Day ${this.day + 1}  ${String(this.hour).padStart(2,'0')}:${String(this.minute).padStart(2,'0')}`;
  }
}
