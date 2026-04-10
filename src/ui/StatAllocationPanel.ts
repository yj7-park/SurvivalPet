import Phaser from 'phaser';
import { CharacterStats, StatKey, calcDerivedStats, BASE_STATS, STAT_CAP } from '../systems/CharacterStats';
import { PlayerLevelData, getXpProgress, resetStats } from '../systems/LevelSystem';

const STAT_ICONS: Record<StatKey, string> = {
  CON: '❤', STR: '⚔', AGI: '💨', INT: '🧠', LUK: '🍀'
};
const STAT_LABELS: Record<StatKey, string> = {
  CON: '체력', STR: '힘  ', AGI: '민첩', INT: '지력', LUK: '행운'
};
const STAT_ORDER: StatKey[] = ['CON', 'STR', 'AGI', 'INT', 'LUK'];

const RESET_COST = 500;

export class StatAllocationPanel {
  private overlay: HTMLDivElement | null = null;
  private tempStats: Record<StatKey, number> = { STR: 1, AGI: 1, CON: 1, INT: 1, LUK: 1 };
  private tempUnspent = 0;
  private data: PlayerLevelData | null = null;
  private getGold: () => number;
  private onApply: (data: PlayerLevelData) => void;
  private onGoldDeduct: (amount: number) => void;

  constructor(
    getGold: () => number,
    onApply: (data: PlayerLevelData) => void,
    onGoldDeduct: (amount: number) => void
  ) {
    this.getGold = getGold;
    this.onApply = onApply;
    this.onGoldDeduct = onGoldDeduct;
  }

  open(data: PlayerLevelData): void {
    this.data = data;
    this.tempStats = { ...data.stats };
    this.tempUnspent = data.unspentPoints;
    this.render();
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  isOpen(): boolean { return this.overlay !== null; }

  private render(): void {
    this.overlay?.remove();
    if (!this.data) return;

    const data    = this.data;
    const derived = calcDerivedStats(this.tempStats);
    const xpProg  = getXpProgress(data);

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,8,5,0.97);border:1.5px solid #5a4428;
      border-radius:8px;padding:18px 20px;z-index:1001;color:#e8d8b0;
      font:12px monospace;min-width:340px;
    `;

    const pct = Math.round(xpProg.ratio * 100);
    overlay.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <span style="font-weight:bold;color:#f0c030">능력치 배분</span>
        <span>Lv.${data.level}</span>
      </div>
      <div style="margin-bottom:4px;font-size:10px;color:#a09070">
        경험치 <span style="color:#e8d8b0">${xpProg.current} / ${xpProg.required} XP</span>
      </div>
      <div style="background:#2a1a08;border-radius:3px;height:6px;margin-bottom:12px">
        <div style="background:#f0c030;width:${pct}%;height:100%;border-radius:3px"></div>
      </div>
      <div style="margin-bottom:14px;color:#f0c030;font-size:11px">
        미배분 포인트: <span id="sp-unspent" style="font-weight:bold">${this.tempUnspent}</span>
      </div>
      <div id="sp-stats"></div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid #3a2a14;font-size:10px;color:#a09070">
        <span style="color:#e8d8b0">파생 능력치:</span>
        HP ${derived.maxHp} &nbsp; 이속 ${derived.moveSpeed} &nbsp;
        공격 ${derived.attackPower} &nbsp; 크리 ${(derived.critChance*100).toFixed(1)}%
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
        <button id="sp-reset" style="padding:5px 12px;background:#333;border:1px solid #5a4428;color:#c8a030;border-radius:4px;cursor:pointer;font:11px monospace">
          초기화 (💰${RESET_COST})
        </button>
        <button id="sp-confirm" style="padding:5px 14px;background:#4a3010;border:1px solid #c8a030;color:#f0c030;border-radius:4px;cursor:pointer;font:11px monospace;font-weight:bold">
          확인
        </button>
      </div>
    `;

    const statsDiv = overlay.querySelector<HTMLDivElement>('#sp-stats')!;
    STAT_ORDER.forEach(key => {
      const val = this.tempStats[key];
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid #2a1a08';

      const barPct = Math.round((val / STAT_CAP) * 100);
      row.innerHTML = `
        <span style="width:22px;font-size:13px">${STAT_ICONS[key]}</span>
        <span style="width:50px;color:#c8b88a">${STAT_LABELS[key]} (${key})</span>
        <div style="flex:1;background:#2a1a08;border-radius:2px;height:5px;margin:0 6px">
          <div style="background:#c8a030;width:${barPct}%;height:100%;border-radius:2px;transition:width 0.15s"></div>
        </div>
        <span style="width:24px;text-align:right;color:#e8d8b0">${val}</span>
        <button data-key="${key}" data-dir="-1" style="padding:1px 7px;background:#2a1a08;border:1px solid #5a4428;color:#c8b88a;border-radius:3px;cursor:pointer;font:10px monospace">−</button>
        <button data-key="${key}" data-dir="1"  style="padding:1px 7px;background:#2a1a08;border:1px solid #5a4428;color:#e8d8b0;border-radius:3px;cursor:pointer;font:10px monospace">+</button>
      `;
      statsDiv.appendChild(row);
    });

    statsDiv.querySelectorAll<HTMLButtonElement>('button[data-key]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.key as StatKey;
        const dir = parseInt(btn.dataset.dir!);
        if (dir > 0) {
          if (this.tempUnspent <= 0 || this.tempStats[key] >= STAT_CAP) return;
          this.tempStats[key]++;
          this.tempUnspent--;
        } else {
          if (this.tempStats[key] <= (BASE_STATS[key] as number)) return;
          this.tempStats[key]--;
          this.tempUnspent++;
        }
        this.data = { ...this.data!, stats: { ...this.tempStats }, unspentPoints: this.tempUnspent };
        this.render();
      };
    });

    overlay.querySelector('#sp-reset')!.addEventListener('click', () => {
      if (!this.data) return;
      if (this.getGold() < RESET_COST) {
        alert(`골드가 부족합니다. (필요: ${RESET_COST})`);
        return;
      }
      this.onGoldDeduct(RESET_COST);
      this.data = resetStats(this.data);
      this.tempStats = { ...this.data.stats };
      this.tempUnspent = this.data.unspentPoints;
      this.render();
    });

    overlay.querySelector('#sp-confirm')!.addEventListener('click', () => {
      if (this.data) this.onApply(this.data);
      this.close();
    });

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }
}
