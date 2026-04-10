import { PlacedStructure, STRUCTURE_DEFS } from '../systems/BuildSystem';
import { calcRepairCost, calcRepairAmount, calcRepairTime } from '../systems/DurabilitySystem';
import { Inventory } from '../systems/Inventory';
import { CharacterStats } from '../entities/CharacterStats';

function durColor(ratio: number): string {
  if (ratio >= 0.70) return '#44ff44';
  if (ratio >= 0.40) return '#ffff44';
  if (ratio >= 0.20) return '#ff8844';
  return '#ff3322';
}

function makeDurBar(ratio: number): string {
  const filled = Math.round(ratio * 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const pct = Math.round(ratio * 100);
  return `<span style="color:${durColor(ratio)}">${bar}</span> <span style="color:#aaa">${pct}%</span>`;
}

export class HoverTooltip {
  private tooltipEl: HTMLDivElement | null = null;
  private repairPanel: HTMLDivElement | null = null;
  private repairStruct: PlacedStructure | null = null;
  private repairTimer: number | null = null; // ms remaining
  private repairFull = false;
  private repairProgressBar: HTMLDivElement | null = null;
  private onRepairComplete: ((struct: PlacedStructure, full: boolean) => void) | null = null;
  private onRepairStart: (() => void) | null = null;

  constructor(
    private getInventory: () => Inventory,
    private getCharStats: () => CharacterStats,
  ) {}

  setRepairCallbacks(
    onStart: () => void,
    onComplete: (struct: PlacedStructure, full: boolean) => void,
  ): void {
    this.onRepairStart = onStart;
    this.onRepairComplete = onComplete;
  }

  showStructTooltip(struct: PlacedStructure, screenX: number, screenY: number): void {
    this.hideTooltip();
    const def = STRUCTURE_DEFS[struct.defName];
    if (!def) return;

    const ratio = struct.durability / struct.maxDurability;
    const inv = this.getInventory();
    const stats = this.getCharStats();

    const partialCosts = calcRepairCost(struct, false);
    const fullCosts = calcRepairCost(struct, true);
    const partialSec = Math.round(calcRepairTime(false, stats.str) / 1000);
    const fullSec = Math.round(calcRepairTime(true, stats.str) / 1000);

    const canPartial = ratio < 1 && partialCosts.every(c => inv.has(c.itemKey, c.count));
    const canFull = ratio < 1 && fullCosts.every(c => inv.has(c.itemKey, c.count));

    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;top:${screenY - 10}px;left:${screenX + 12}px;
      background:rgba(10,15,25,0.95);border:1px solid #446;
      border-radius:6px;padding:10px 12px;z-index:300;color:#eee;
      font:11px monospace;min-width:200px;pointer-events:none;
    `;

    const partialCostStr = partialCosts.map(c => `${c.itemKey.replace('item_','')} ×${c.count}`).join(', ');
    const fullCostStr = fullCosts.map(c => `${c.itemKey.replace('item_','')} ×${c.count}`).join(', ');

    el.innerHTML = `
      <div style="font-size:12px;color:#e2b96f;font-weight:bold;margin-bottom:6px">${def.label}</div>
      <div style="margin-bottom:4px">내구도: ${makeDurBar(ratio)}</div>
      <div style="color:#888;font-size:10px;margin-bottom:8px">${Math.ceil(struct.durability)} / ${struct.maxDurability}</div>
      <div style="color:#aaa;font-size:10px">🔨 수리: ${partialCostStr} (${partialSec}초)</div>
      <div style="color:#aaa;font-size:10px">🔧 완전수리: ${fullCostStr} (${fullSec}초)</div>
      <div style="color:#555;font-size:9px;margin-top:4px">우클릭으로 수리</div>
    `;

    document.body.appendChild(el);
    this.tooltipEl = el;
    void canPartial; void canFull; // used in repair panel
  }

  hideTooltip(): void {
    this.tooltipEl?.remove();
    this.tooltipEl = null;
  }

  openRepairPanel(struct: PlacedStructure): void {
    this.closeRepairPanel();
    const def = STRUCTURE_DEFS[struct.defName];
    if (!def) return;
    if (struct.durability >= struct.maxDurability) {
      this.showStatusMsg('이미 완전한 상태입니다', '#aaffaa');
      return;
    }

    const inv = this.getInventory();
    const stats = this.getCharStats();
    const partialCosts = calcRepairCost(struct, false);
    const fullCosts = calcRepairCost(struct, true);
    const partialAmount = calcRepairAmount(struct, false);
    const fullAmount = calcRepairAmount(struct, true);

    const canPartial = partialCosts.every(c => inv.has(c.itemKey, c.count));
    const canFull = fullCosts.every(c => inv.has(c.itemKey, c.count));

    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,15,25,0.97);border:1px solid #446;
      border-radius:8px;padding:18px;z-index:400;color:#eee;
      font:12px monospace;min-width:260px;text-align:center;
    `;
    panel.innerHTML = `
      <div style="font-size:13px;color:#e2b96f;font-weight:bold;margin-bottom:10px">🔨 ${def.label} 수리</div>
      <div style="margin-bottom:12px;font-size:11px;color:#aaa">
        내구도: ${Math.ceil(struct.durability)} / ${struct.maxDurability}
      </div>
    `;

    const makeCostLine = (costs: {itemKey:string;count:number}[]) =>
      costs.map(c => `${c.itemKey.replace('item_','')} ×${c.count}${inv.has(c.itemKey,c.count) ? '' : ' <span style="color:#ff6644">(부족)</span>'}`).join(' ');

    const makeBtn = (label: string, enabled: boolean, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.style.cssText = `
        display:block;width:220px;margin:0 auto 8px;padding:9px;
        background:${enabled ? '#2a5a3a' : '#333'};color:${enabled ? '#fff' : '#666'};
        border:none;border-radius:4px;cursor:${enabled ? 'pointer' : 'default'};font:11px monospace;
        text-align:left;
      `;
      btn.innerHTML = label;
      if (enabled) btn.onclick = onClick;
      return btn;
    };

    panel.appendChild(makeBtn(
      `🔨 수리하기 (+${partialAmount})<br><span style="font-size:10px;color:#aaa">${makeCostLine(partialCosts)}</span>`,
      canPartial,
      () => this.startRepair(struct, false, stats),
    ));
    panel.appendChild(makeBtn(
      `🔧 완전 수리 (+${fullAmount})<br><span style="font-size:10px;color:#aaa">${makeCostLine(fullCosts)}</span>`,
      canFull,
      () => this.startRepair(struct, true, stats),
    ));

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '취소';
    closeBtn.style.cssText = `padding:6px 16px;background:#333;color:#aaa;border:none;border-radius:4px;cursor:pointer;font:11px monospace;`;
    closeBtn.onclick = () => this.closeRepairPanel();
    panel.appendChild(closeBtn);

    // Close on outside click
    const outsideClose = (e: MouseEvent) => {
      if (!panel.contains(e.target as Node)) {
        this.closeRepairPanel();
        document.removeEventListener('mousedown', outsideClose);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', outsideClose), 0);

    document.body.appendChild(panel);
    this.repairPanel = panel;
  }

  private startRepair(struct: PlacedStructure, full: boolean, stats: CharacterStats): void {
    const totalMs = calcRepairTime(full, stats.str);
    this.repairStruct = struct;
    this.repairFull = full;
    this.repairTimer = totalMs;
    this.onRepairStart?.();

    // Replace panel with progress bar
    if (this.repairPanel) {
      this.repairPanel.innerHTML = `
        <div style="font-size:12px;color:#e2b96f;margin-bottom:10px">🔨 수리 중…</div>
        <div style="background:#111;border-radius:4px;overflow:hidden;height:12px;margin:0 0 8px;border:1px solid #334">
          <div id="repair-fill" style="height:100%;background:linear-gradient(90deg,#2a6e4a,#4aae7a);width:0%;transition:none;border-radius:4px"></div>
        </div>
        <div id="repair-pct" style="color:#6ac;font-size:11px;margin-bottom:8px">0%</div>
      `;
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '취소';
      cancelBtn.style.cssText = `padding:6px 16px;background:#333;color:#aaa;border:none;border-radius:4px;cursor:pointer;font:11px monospace;`;
      cancelBtn.onclick = () => this.cancelRepair();
      this.repairPanel.appendChild(cancelBtn);
      this.repairProgressBar = this.repairPanel.querySelector('#repair-fill') as HTMLDivElement;
    }
  }

  cancelRepair(): void {
    this.repairStruct = null;
    this.repairTimer = null;
    this.closeRepairPanel();
  }

  isRepairing(): boolean { return this.repairStruct !== null && this.repairTimer !== null; }

  /** Call from GameScene update(). Returns true if repair completed. */
  updateRepair(delta: number): boolean {
    if (!this.isRepairing()) return false;
    this.repairTimer! -= delta;
    const totalMs = calcRepairTime(this.repairFull, 5); // approx for progress
    const pct = Math.min(100, Math.round((1 - this.repairTimer! / (totalMs || 1)) * 100));

    if (this.repairProgressBar) {
      this.repairProgressBar.style.width = pct + '%';
      const pctEl = this.repairPanel?.querySelector('#repair-pct') as HTMLDivElement | null;
      if (pctEl) pctEl.textContent = pct + '%';
    }

    if (this.repairTimer! <= 0) {
      const struct = this.repairStruct!;
      const full = this.repairFull;
      this.repairStruct = null;
      this.repairTimer = null;
      this.closeRepairPanel();
      this.onRepairComplete?.(struct, full);
      return true;
    }
    return false;
  }

  cancelRepairOnMove(): void {
    if (this.isRepairing()) this.cancelRepair();
  }

  closeRepairPanel(): void {
    this.repairPanel?.remove();
    this.repairPanel = null;
    this.repairStruct = null;
    this.repairTimer = null;
    this.repairProgressBar = null;
  }

  private showStatusMsg(msg: string, color: string): void {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;top:40%;left:50%;transform:translateX(-50%);
      color:${color};font:12px monospace;background:rgba(0,0,0,0.85);
      padding:6px 14px;border-radius:4px;z-index:500;pointer-events:none;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 1s'; setTimeout(() => el.remove(), 1000); }, 1000);
  }

  destroy(): void {
    this.hideTooltip();
    this.closeRepairPanel();
  }
}
