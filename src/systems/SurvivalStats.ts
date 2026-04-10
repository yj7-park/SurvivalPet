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
  frenzyCooldown = 0; // ms — 광란 종료 후 5초간 재진입 방지

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

    // Fatigue → forced sleep (SleepSystem handles recovery; isForcedSleep is set externally)
    if (this.fatigue === 0 && !this.isForcedSleep && !this.isFrenzy) {
      this.isForcedSleep = true;
    }

    // 광란 쿨다운 처리
    if (this.frenzyCooldown > 0) {
      this.frenzyCooldown -= delta;
      if (this.action < 1) this.action = 1; // 쿨다운 중 action 바닥 1 고정
    }

    // Action → frenzy (30s)
    if (this.action <= 0 && !this.isFrenzy && !this.isForcedSleep && this.frenzyCooldown <= 0) {
      this.isFrenzy = true;
      this.frenzyTimer = 30_000;
    }
    if (this.isFrenzy) {
      this.frenzyTimer -= delta;
      if (this.frenzyTimer <= 0) {
        this.isFrenzy = false;
        this.action = 25; // 광란 종료 후 행복 수치 25로 회복
        this.frenzyCooldown = 5_000; // 5초 재진입 방지
      }
    }
  }

  addAction(amount: number) { this.action = Math.min(100, this.action + amount); }
  eat(amount: number)        { this.hunger = Math.min(100, this.hunger + amount); }
  sleep(amount: number)      { this.fatigue = Math.min(100, this.fatigue + amount); }

  /** 활동별 피로 소모 (CON 보정 적용) */
  addFatigue(amount: number): void {
    const conMult = Math.max(0.5, 1.0 - (this.stats.con - 5) * 0.06);
    this.fatigue = Math.max(0, this.fatigue - amount * conMult);
  }

  /** 피로 10 이하 → 이동 속도 0.8배 */
  get fatigueSpeedMult(): number { return this.fatigue <= 10 ? 0.8 : 1.0; }

  get isIncapacitated(): boolean { return this.isForcedSleep || this.isFrenzy; }
}
