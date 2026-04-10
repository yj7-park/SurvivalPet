import { SeededRandom } from '../utils/seedRandom';

export class CharacterStats {
  readonly str: number;
  readonly agi: number;
  readonly con: number;
  readonly int: number;

  constructor(
    seed: string,
    playerId: string,
    overrideStats?: { str: number; agi: number; con: number; int: number },
  ) {
    if (overrideStats) {
      this.str = overrideStats.str;
      this.agi = overrideStats.agi;
      this.con = overrideStats.con;
      this.int = overrideStats.int;
    } else {
      const rng = new SeededRandom(`${seed}_stats_${playerId}`);
      const s = [2, 2, 2, 2];
      let rem = 12;
      while (rem > 0) {
        const i = rng.int(0, 3);
        if (s[i] < 10) { s[i]++; rem--; }
      }
      [this.str, this.agi, this.con, this.int] = s;
    }
  }

  get moveSpeed(): number { return 120 + (this.agi - 5) * 12; }
  get maxHp(): number { return 80 + this.con * 8; }
  get hungerDecayPerDay(): number { return 40 - (this.str - 5) * 2; }
  get fatigueDecayPerDay(): number { return 50 - (this.con - 5) * 3; }
  get logTime(): number { return Math.max(2, 5 - (this.str - 5) * 0.4); }
  get mineTime(): number { return Math.max(3, 8 - (this.str - 5) * 0.6); }
  get fishTime(): number { return Math.max(5, 10 - (this.agi - 5) * 0.6); }
  get fishRate(): number { return Math.min(0.95, (40 + this.agi * 4 + this.int * 3) / 100); }

  /** 플레이어 공격력 */
  get attackDamage(): number { return 10 + this.str * 2; }
  /** 공격 쿨다운 (ms) */
  get attackCooldown(): number { return Math.max(800, 1500 - (this.agi - 5) * 80); }
  /** 공격 사거리 (px) — 2타일 */
  get attackRange(): number { return 64; }
  /** 채굴 소요 시간 (ms) */
  get mineTimeMs(): number { return Math.max(3000, 8000 - (this.str - 5) * 600); }
  /** 벌목 소요 시간 (ms) */
  get logTimeMs(): number { return Math.max(2000, 5000 - (this.str - 5) * 400); }
  /** 낚시 소요 시간 (ms) */
  get fishTimeMs(): number { return Math.max(5000, 10000 - (this.agi - 5) * 600); }
  /** 제작 소요 시간 (ms) */
  get craftTime(): number { return Math.max(2000, 6000 - (this.int - 5) * 400); }
  /** 요리 소요 시간 (ms) */
  get cookTime(): number { return Math.max(3000, 8000 - (this.int - 5) * 400); }
  /** 건설 소요 시간 base (ms, STR 5 기준) */
  buildTime(baseSec: number): number {
    return Math.max(1000, baseSec * 1000 - (this.str - 5) * 300);
  }
}
