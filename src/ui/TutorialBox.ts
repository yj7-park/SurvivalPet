export type TutorialBoxCallback = { onNext: () => void; onSkip: () => void };

export class TutorialBox {
  private el: HTMLDivElement | null = null;
  private nextBtn: HTMLButtonElement | null = null;

  show(stepNum: number, totalSteps: number, lines: string[], nextEnabled: boolean, cb: TutorialBoxCallback): void {
    this.destroy();
    const box = document.createElement('div');
    box.id = 'tutorial-box';
    box.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.82);border:1px solid #556;border-radius:6px;
      padding:14px 18px;z-index:500;color:#eee;font:13px monospace;
      min-width:360px;max-width:520px;pointer-events:all;
    `;

    const msg = document.createElement('div');
    msg.style.cssText = 'margin-bottom:10px;line-height:1.5';
    msg.innerHTML = `<span style="color:#ffe080">💡 </span>` + lines.map(l => `<span>${l}</span>`).join('<br>');
    box.appendChild(msg);

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center';

    const progress = document.createElement('span');
    progress.style.cssText = 'color:#778;font-size:11px';
    progress.textContent = `(${stepNum}/${totalSteps})`;
    footer.appendChild(progress);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px';

    const skipBtn = document.createElement('button');
    skipBtn.textContent = '건너뛰기';
    skipBtn.style.cssText = `
      padding:4px 10px;background:#333;color:#aaa;border:1px solid #446;
      border-radius:3px;cursor:pointer;font:11px monospace;
    `;
    skipBtn.onclick = () => cb.onSkip();
    btnRow.appendChild(skipBtn);

    this.nextBtn = document.createElement('button');
    this.nextBtn.textContent = '다음 →';
    this.nextBtn.disabled = !nextEnabled;
    this.nextBtn.style.cssText = `
      padding:4px 10px;border:1px solid #446;border-radius:3px;
      font:11px monospace;cursor:${nextEnabled ? 'pointer' : 'default'};
      background:${nextEnabled ? '#2a5a3a' : '#333'};
      color:${nextEnabled ? '#aff' : '#555'};
    `;
    if (nextEnabled) this.nextBtn.onclick = () => cb.onNext();
    btnRow.appendChild(this.nextBtn);
    footer.appendChild(btnRow);
    box.appendChild(footer);

    document.body.appendChild(box);
    this.el = box;
  }

  /** Enable/disable the Next button without re-rendering */
  setNextEnabled(enabled: boolean): void {
    if (!this.nextBtn) return;
    this.nextBtn.disabled = !enabled;
    this.nextBtn.style.background = enabled ? '#2a5a3a' : '#333';
    this.nextBtn.style.color = enabled ? '#aff' : '#555';
    this.nextBtn.style.cursor = enabled ? 'pointer' : 'default';
    if (enabled) {
      this.nextBtn.onclick = this.nextBtn.onclick; // preserve
    }
  }

  destroy(): void {
    this.el?.remove();
    this.el = null;
    this.nextBtn = null;
  }
}
