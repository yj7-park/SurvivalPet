import { SurvivalStats } from './SurvivalStats';

export type ActionType =
  | 'woodcut' | 'mine' | 'fish'
  | 'build' | 'demolish'
  | 'kill_enemy'
  | 'cook' | 'craft' | 'research'
  | 'eat' | 'sleep';

interface ActionCombo {
  type: ActionType;
  count: number;
  lastAt: number; // Date.now()
}

const BASE_RECOVERY: Record<ActionType, number> = {
  woodcut:    12,
  mine:       12,
  fish:       10,
  build:      15,
  demolish:   8,
  kill_enemy: 18,
  cook:       8,
  craft:      8,
  research:   10,
  eat:        5,
  sleep:      30,
};

const COMBO_RESET_MS = 30_000; // 30초 이상 경과 시 콤보 리셋

export class ActionSystem {
  private combo: ActionCombo | null = null;
  private warnedLow = false;
  private warnedCritical = false;

  onActionDone(type: ActionType, survival: SurvivalStats): void {
    const now = Date.now();
    if (this.combo && this.combo.type === type && now - this.combo.lastAt < COMBO_RESET_MS) {
      this.combo.count++;
      this.combo.lastAt = now;
    } else {
      this.combo = { type, count: 1, lastAt: now };
    }

    const mult = Math.max(0.3, 1.0 - (this.combo.count - 1) * 0.15);
    const amount = Math.round(BASE_RECOVERY[type] * mult);
    survival.addAction(amount);
  }

  /** 경고 구간 진입 체크. onWarn 콜백으로 알림 메시지 전달. */
  checkWarnings(
    value: number,
    onWarn: (msg: string, color: string) => void,
  ): void {
    if (value > 20) {
      this.warnedLow = false;
    } else if (value > 10) {
      if (!this.warnedLow) {
        this.warnedLow = true;
        onWarn('⚠ 행복 수치가 낮습니다', '#ffaa44');
      }
    }

    if (value > 10) {
      this.warnedCritical = false;
    } else if (value > 0) {
      if (!this.warnedCritical) {
        this.warnedCritical = true;
        onWarn('⚠ 곧 광란 상태에 돌입합니다!', '#ff4444');
      }
    }
  }

  /** 저장용 직렬화 */
  serialize(): { combo: ActionCombo | null } {
    return { combo: this.combo };
  }

  /** 불러오기용 복원 */
  deserialize(data: { combo: ActionCombo | null }): void {
    this.combo = data.combo;
  }
}
