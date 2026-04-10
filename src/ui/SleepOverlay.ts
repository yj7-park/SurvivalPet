import { SurvivalStats } from '../systems/SurvivalStats';
import { GameTime } from '../systems/GameTime';

export class SleepOverlay {
  private overlay: HTMLDivElement | null = null;
  private onWakeRequest: (() => void) | null = null;

  show(survival: SurvivalStats, gameTime: GameTime, onWakeRequest: () => void): void {
    if (this.overlay) return;
    this.onWakeRequest = onWakeRequest;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(5,5,15,0.72);z-index:150;
      display:flex;align-items:center;justify-content:center;
      pointer-events:all;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background:rgba(8,12,25,0.96);border:1px solid #446;
      border-radius:10px;padding:28px 36px;color:#eee;
      font:13px monospace;min-width:320px;text-align:center;
    `;

    box.innerHTML = `
      <div style="font-size:20px;margin-bottom:18px">💤 수면 중</div>
      <div id="sl-fatigue" style="margin-bottom:8px"></div>
      <div id="sl-hunger" style="margin-bottom:16px"></div>
      <div id="sl-time" style="color:#6ac;font-size:11px;margin-bottom:16px"></div>
    `;

    const wakeBtn = document.createElement('button');
    wakeBtn.textContent = '깨우기 (ESC)';
    wakeBtn.style.cssText = `
      padding:9px 22px;background:#333;color:#ccc;border:1px solid #556;
      border-radius:5px;cursor:pointer;font:12px monospace;
    `;
    wakeBtn.onmouseenter = () => (wakeBtn.style.background = '#445');
    wakeBtn.onmouseleave = () => (wakeBtn.style.background = '#333');
    wakeBtn.onclick = () => this.onWakeRequest?.();
    box.appendChild(wakeBtn);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.updateDisplay(survival, gameTime);
  }

  update(survival: SurvivalStats, gameTime: GameTime): void {
    if (!this.overlay) return;
    this.updateDisplay(survival, gameTime);
  }

  private updateDisplay(survival: SurvivalStats, gameTime: GameTime): void {
    if (!this.overlay) return;
    const fmt = (v: number, max: number, label: string, color: string) => {
      const pct = v / max;
      const bars = Math.round(pct * 10);
      const bar = '█'.repeat(bars) + '░'.repeat(10 - bars);
      return `<div style="margin-bottom:6px"><span style="color:#888">${label}</span>  <span style="color:${color}">${bar}</span>  <span style="color:#aaa">${Math.ceil(v)} / ${max}</span></div>`;
    };

    const fatigueEl = this.overlay.querySelector('#sl-fatigue');
    const hungerEl = this.overlay.querySelector('#sl-hunger');
    const timeEl = this.overlay.querySelector('#sl-time');
    if (fatigueEl) fatigueEl.innerHTML = fmt(survival.fatigue, 100, '피로', '#4aae7a');
    if (hungerEl)  hungerEl.innerHTML  = fmt(survival.hunger,  100, '허기', '#e0a020');
    if (timeEl)    timeEl.textContent  = `게임 내 시간: ${gameTime.toString()}`;
  }

  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.onWakeRequest = null;
  }

  isVisible(): boolean { return this.overlay !== null; }

  destroy(): void { this.hide(); }
}
