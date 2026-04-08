import seedrandom from 'seedrandom';

export class SeededRandom {
  private rng: seedrandom.PRNG;

  constructor(seed: string) {
    this.rng = seedrandom(seed);
  }

  /** 0 이상 1 미만 float */
  next(): number {
    return this.rng();
  }

  /** [min, max) 범위의 float */
  float(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }

  /** [min, max] 범위의 정수 */
  int(min: number, max: number): number {
    return Math.floor(min + this.rng() * (max - min + 1));
  }

  /** 배열에서 랜덤 요소 */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.rng() * arr.length)];
  }
}

/** 짧은 랜덤 Seed 문자열 생성 (새 게임용) */
export function generateSeed(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let seed = '';
  for (let i = 0; i < 6; i++) {
    seed += chars[Math.floor(Math.random() * chars.length)];
  }
  return seed;
}
