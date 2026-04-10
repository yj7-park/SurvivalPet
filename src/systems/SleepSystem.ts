import { SurvivalStats } from './SurvivalStats';
import { GameTime } from './GameTime';

export type BedType = 'bed_wood' | 'bed_stone' | 'none';
export type WakeReason = 'recovered' | 'morning' | 'attacked' | 'starving' | 'user';

const SLEEP_TIME_MULT = 4.0;
const RECOVERY_PER_DAY: Record<BedType, number> = {
  bed_wood:  60,
  bed_stone: 75,
  none:      30,
};

export class SleepSystem {
  private sleeping = false;
  private forcedBySystem = false;
  private bedType: BedType = 'none';
  private isIndoor = false;
  private onWakeCallback?: (reason: WakeReason) => void;

  /** Returns true if voluntarily sleeping OR system-forced sleep */
  isSleeping(): boolean { return this.sleeping; }
  isVoluntarySleep(): boolean { return this.sleeping && !this.forcedBySystem; }
  isForcedSleep(): boolean { return this.sleeping && this.forcedBySystem; }

  /** 침대 클릭으로 수면 시작 */
  startSleep(bedType: BedType, isIndoor: boolean, onWake: (reason: WakeReason) => void): boolean {
    if (this.sleeping) return false;
    this.sleeping = true;
    this.forcedBySystem = false;
    this.bedType = bedType;
    this.isIndoor = isIndoor;
    this.onWakeCallback = onWake;
    return true;
  }

  /** 강제 수면 (피로 0) */
  startForcedSleep(onWake: (reason: WakeReason) => void): boolean {
    if (this.sleeping) return false;
    this.sleeping = true;
    this.forcedBySystem = true;
    this.bedType = 'none';
    this.isIndoor = false;
    this.onWakeCallback = onWake;
    return true;
  }

  wakeUp(reason: WakeReason): void {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.forcedBySystem = false;
    this.onWakeCallback?.(reason);
  }

  /**
   * Call every frame.
   * Returns the effective delta to use for GameTime/SurvivalStats (accelerated when sleeping).
   */
  update(delta: number, survival: SurvivalStats, gameTime: GameTime): number {
    if (!this.sleeping) return delta;

    const effectiveDelta = delta * SLEEP_TIME_MULT;
    const rate = this.calcRecoveryRate();
    // Recover fatigue proportional to time elapsed (game-day units)
    const secsPerDay = GameTime.MS_PER_GAME_DAY / 1000;
    const realSec = effectiveDelta / 1000;
    const recovered = rate * (realSec / secsPerDay);
    survival.sleep(recovered);

    // Wake conditions
    const wakeThreshold = this.forcedBySystem ? 40 : 70;
    if (survival.fatigue >= wakeThreshold) {
      this.wakeUp('recovered');
    } else if (gameTime.hour === 6 && gameTime.minute === 0) {
      this.wakeUp('morning');
    }

    return effectiveDelta;
  }

  /** Call when player is hit while sleeping */
  interruptByHit(): void {
    if (this.sleeping) this.wakeUp('attacked');
  }

  /** Call when hunger reaches 0 while sleeping */
  interruptByStarving(): void {
    if (this.sleeping) this.wakeUp('starving');
  }

  private calcRecoveryRate(): number {
    const base = RECOVERY_PER_DAY[this.bedType];
    return this.isIndoor ? base * 1.2 : base;
  }
}
