import { SurvivalStats } from './SurvivalStats';
import { CharacterStats } from '../entities/CharacterStats';
import { HungerSystem } from './HungerSystem';

const OUT_OF_COMBAT_DELAY = 10_000; // ms — 마지막 피격 후 10초

export class HPSystem {
  private timeSinceLastHit: number = OUT_OF_COMBAT_DELAY; // starts regen-ready

  /** 매 프레임 자연 회복 업데이트 */
  update(delta: number, survival: SurvivalStats, charStats: CharacterStats, hungerSystem: HungerSystem): void {
    this.timeSinceLastHit += delta;

    if (!this.canRegenerate(survival, hungerSystem)) return;

    // CON 기반 자연 회복: CON×2 per game day (1,800,000ms)
    const regenPerDay = charStats.con * 2;
    const regen = (regenPerDay / 1_800_000) * delta;
    survival.hp = Math.min(survival.maxHp, survival.hp + regen);
  }

  /** 피격 시 호출 — 전투 외 타이머 리셋 */
  onHit(): void {
    this.timeSinceLastHit = 0;
  }

  /** 기상 시 CON×3 즉시 회복 */
  onWakeUp(charStats: CharacterStats, survival: SurvivalStats): void {
    const heal = charStats.con * 3;
    survival.hp = Math.min(survival.maxHp, survival.hp + heal);
  }

  canRegenerate(survival: SurvivalStats, hungerSystem: HungerSystem): boolean {
    return (
      this.timeSinceLastHit >= OUT_OF_COMBAT_DELAY &&
      survival.hunger > 20 &&
      !hungerSystem.isPoisoned() &&
      !survival.isFrenzy
    );
  }

  isOutOfCombat(): boolean {
    return this.timeSinceLastHit >= OUT_OF_COMBAT_DELAY;
  }
}
