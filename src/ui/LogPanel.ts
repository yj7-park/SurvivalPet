import type { LogEntry, NotifyType } from '../systems/NotifySystem';

const TYPE_ICON: Record<NotifyType, string> = {
  info: 'ℹ', warning: '⚠', danger: '❗', success: '✅', loot: '🎒',
};
const TYPE_COLOR: Record<NotifyType, string> = {
  info: '#ffffff', warning: '#ffee44', danger: '#ff8888', success: '#aaffaa', loot: '#88eeff',
};

export class LogPanel {
  private panel: HTMLDivElement | null = null;

  toggle(entries: LogEntry[]): void {
    if (this.panel) { this.close(); } else { this.open(entries); }
  }

  open(entries: LogEntry[]): void {
    if (this.panel) return;
    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed; top:60px; right:250px; width:280px; max-height:360px;
      background:rgba(10,15,25,0.95); border:1px solid #446;
      border-radius:6px; padding:8px; z-index:350; color:#eee;
      font:11px monospace; overflow-y:auto;
    `;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;border-bottom:1px solid #334;padding-bottom:4px">
        <span style="color:#e2b96f;font-weight:bold">📋 이벤트 로그</span>
        <button id="log-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div id="log-entries"></div>
    `;
    const entryDiv = panel.querySelector('#log-entries') as HTMLDivElement;
    for (const e of entries) {
      const row = document.createElement('div');
      row.style.cssText = `padding:2px 0;border-bottom:1px solid #1a2030;color:${TYPE_COLOR[e.type]};`;
      row.textContent = `${e.gameTime}  ${TYPE_ICON[e.type]} ${e.message}`;
      entryDiv.appendChild(row);
    }
    if (entries.length === 0) {
      entryDiv.innerHTML = '<div style="color:#555;padding:4px 0">기록 없음</div>';
    }
    panel.querySelector('#log-close')!.addEventListener('click', () => this.close());
    document.body.appendChild(panel);
    this.panel = panel;
  }

  close(): void {
    this.panel?.remove();
    this.panel = null;
  }

  isOpen(): boolean { return this.panel !== null; }
}
