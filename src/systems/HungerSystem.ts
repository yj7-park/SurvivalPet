import { FoodDef } from '../config/foods';
import { SurvivalStats } from './SurvivalStats';
import { CharacterStats } from '../entities/CharacterStats';

export interface FoodPoisoning {
  active: boolean;
  timeLeft: number; // ms (2 minutes = 120_000)
}

export interface EatResult {
  hungerRecovered: number;
  hpChanged: number;
  poisoned: boolean;
  diningBonus: boolean;
}

const POISON_DURATION_MS = 120_000;  // 2 real minutes
const POISON_HP_TICK_MS  =  10_000;  // HP -3 every 10s
const POISON_HP_DAMAGE   = 3;
const MAX_HP_DEBUFF_TICK_MS = 75_000; // 75s per -5 debuff
const MAX_HP_DEBUFF_PER_TICK = 5;
const DINING_BONUS = 1.3;

export class HungerSystem {
  /** Max HP reduction accumulated from starvation */
  maxHpDebuff = 0;
  private maxHpDebuffTimer = 0;

  private poisoning: FoodPoisoning = { active: false, timeLeft: 0 };
  private poisonHpTimer = 0;

  /** Called each frame. Updates debuff accumulation, poisoning timers, and applies effects to survival. */
  update(delta: number, survival: SurvivalStats, charStats: CharacterStats): void {
    // ── Max HP debuff accumulation ──────────────────────────────
    const maxDebuffCap = charStats.maxHp - 10;
    if (survival.hunger <= 0) {
      this.maxHpDebuffTimer += delta;
      if (this.maxHpDebuffTimer >= MAX_HP_DEBUFF_TICK_MS) {
        this.maxHpDebuffTimer -= MAX_HP_DEBUFF_TICK_MS;
        this.maxHpDebuff = Math.min(maxDebuffCap, this.maxHpDebuff + MAX_HP_DEBUFF_PER_TICK);
      }
    } else {
      this.maxHpDebuffTimer = 0;
      if (this.maxHpDebuff > 0) {
        // Recovery rate: 2~10 per game day depending on hunger level
        const recoveryRate = 2 + (survival.hunger / 100) * 8;
        this.maxHpDebuff = Math.max(0, this.maxHpDebuff - (recoveryRate / 1_800_000) * delta);
      }
    }

    // ── Apply debuff to SurvivalStats ────────────────────────────
    survival.setMaxHpDebuff(Math.round(this.maxHpDebuff));

    // ── Food poisoning ───────────────────────────────────────────
    if (this.poisoning.active) {
      this.poisoning.timeLeft -= delta;
      this.poisonHpTimer += delta;

      if (this.poisonHpTimer >= POISON_HP_TICK_MS) {
        this.poisonHpTimer -= POISON_HP_TICK_MS;
        survival.hp = Math.max(1, survival.hp - POISON_HP_DAMAGE);
      }

      if (this.poisoning.timeLeft <= 0) {
        this.poisoning = { active: false, timeLeft: 0 };
        this.poisonHpTimer = 0;
      }
    }
  }

  /** Process eating a food item. Returns the result. Inventory removal is handled by the caller. */
  eat(food: FoodDef, survival: SurvivalStats, charStats: CharacterStats, nearDiningTable: boolean): EatResult {
    const diningBonus = nearDiningTable;
    const mult = diningBonus ? DINING_BONUS : 1.0;
    const hungerRecovered = Math.round(food.hungerRecovery * mult);
    const hpChanged = food.hpChange;

    // Apply hunger recovery
    survival.eat(hungerRecovered);

    // Apply HP change
    if (hpChanged > 0) {
      survival.hp = Math.min(survival.maxHp, survival.hp + hpChanged);
    } else if (hpChanged < 0) {
      survival.hp = Math.max(1, survival.hp + hpChanged);
    }

    // Action bonus
    survival.addAction(5);

    // Food poisoning check
    let poisoned = false;
    if (food.poisonChance > 0 && Math.random() < food.poisonChance) {
      poisoned = true;
      this.poisoning = { active: true, timeLeft: POISON_DURATION_MS };
      this.poisonHpTimer = 0;
    }

    return { hungerRecovered, hpChanged, poisoned, diningBonus };
  }

  isPoisoned(): boolean { return this.poisoning.active; }

  /** Clear poisoning on wake (sleep cures poison) */
  clearPoisonOnWake(): void {
    if (this.poisoning.active) {
      this.poisoning = { active: false, timeLeft: 0 };
      this.poisonHpTimer = 0;
    }
  }

  getMaxHpDebuff(): number { return Math.round(this.maxHpDebuff); }

  serialize(): { maxHpDebuff: number; poisoning: FoodPoisoning } {
    return {
      maxHpDebuff: this.maxHpDebuff,
      poisoning: { ...this.poisoning },
    };
  }

  deserialize(data: { maxHpDebuff?: number; poisoning?: Partial<FoodPoisoning> }): void {
    this.maxHpDebuff = data.maxHpDebuff ?? 0;
    this.maxHpDebuffTimer = 0;
    this.poisoning = {
      active: data.poisoning?.active ?? false,
      timeLeft: data.poisoning?.timeLeft ?? 0,
    };
    this.poisonHpTimer = 0;
  }
}
