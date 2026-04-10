import { SurvivalStats } from './SurvivalStats';
import { GameTime } from './GameTime';

// Fatigue recovery per game hour by chair type
const CHAIR_REGEN: Record<string, number> = {
  chair_wood:  6,
  chair_stone: 9,
};

const MS_PER_GAME_HOUR = GameTime.MS_PER_GAME_DAY / 24; // 75_000 ms

export class SitSystem {
  private sitting = false;
  private chairType = '';

  /** Returns true if sitting started successfully. */
  startSitting(chairType: string): boolean {
    this.sitting = true;
    this.chairType = chairType;
    return true;
  }

  stopSitting(): void {
    this.sitting = false;
    this.chairType = '';
  }

  isSitting(): boolean { return this.sitting; }
  getChairType(): string { return this.chairType; }

  /** Call every frame. Slowly recovers fatigue while seated. */
  update(delta: number, survival: SurvivalStats, isIndoor = false): void {
    if (!this.sitting) return;
    const rate = CHAIR_REGEN[this.chairType] ?? CHAIR_REGEN['chair_wood'];
    const indoorMult = isIndoor ? 1.1 : 1.0;
    // rate = fatigue per game hour; recover proportional to real time elapsed
    const recovered = (rate / MS_PER_GAME_HOUR) * delta * indoorMult;
    survival.sleep(recovered);
  }
}
