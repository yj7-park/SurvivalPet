import { CharacterStats } from '../entities/CharacterStats';
import { GameTime } from './GameTime';

export class SurvivalStats {
  hp: number;
  maxHp: number;
  hunger = 100;
  fatigue = 100;
  action = 100;

  isForcedSleep = false;
  isFrenzy = false;
  frenzyTimer = 0;

  private hungerDebuff = 0; // max HP reduction from starvation

  constructor(private stats: CharacterStats) {
    this.maxHp = stats.maxHp;
    this.hp = this.maxHp;
  }

  update(delta: number) {
    const realSec = delta / 1000;
    const secsPerDay = GameTime.MS_PER_GAME_DAY / 1000;
    const scale = realSec / secsPerDay;

    this.hunger  = Math.max(0, this.hunger  - this.stats.hungerDecayPerDay  * scale);
    this.fatigue = Math.max(0, this.fatigue - this.stats.fatigueDecayPerDay * scale);
    this.action  = Math.max(0, this.action  - 20 * scale);

    // Hunger → max HP debuff
    if (this.hunger === 0) {
      this.hungerDebuff = Math.min(this.stats.maxHp * 0.5, this.hungerDebuff + realSec * 0.5);
    } else {
      this.hungerDebuff = Math.max(0, this.hungerDebuff - realSec * (this.hunger / 100) * 0.2);
    }
    this.maxHp = Math.max(1, Math.round(this.stats.maxHp - this.hungerDebuff));
    this.hp = Math.min(this.hp, this.maxHp);

    // Fatigue → forced sleep
    if (this.fatigue === 0 && !this.isForcedSleep && !this.isFrenzy) {
      this.isForcedSleep = true;
    }
    if (this.isForcedSleep) {
      this.fatigue = Math.min(100, this.fatigue + realSec * 2);
      if (this.fatigue >= 30) this.isForcedSleep = false;
    }

    // Action → frenzy (30s)
    if (this.action === 0 && !this.isFrenzy && !this.isForcedSleep) {
      this.isFrenzy = true;
      this.frenzyTimer = 30_000;
    }
    if (this.isFrenzy) {
      this.frenzyTimer -= delta;
      if (this.frenzyTimer <= 0) {
        this.isFrenzy = false;
        this.action = Math.min(100, this.action + 20);
      }
    }
  }

  addAction(amount: number) { this.action = Math.min(100, this.action + amount); }
  eat(amount: number)        { this.hunger = Math.min(100, this.hunger + amount); }
  sleep(amount: number)      { this.fatigue = Math.min(100, this.fatigue + amount); }
  get isIncapacitated(): boolean { return this.isForcedSleep || this.isFrenzy; }
}
