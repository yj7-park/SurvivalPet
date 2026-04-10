import { SaveSystem, SettingsSaveData } from '../systems/SaveSystem';

export class SettingsPanel {
  private overlay: HTMLDivElement | null = null;

  constructor(private saveSystem: SaveSystem) {}

  toggle(): void {
    if (this.overlay) { this.close(); } else { this.open(); }
  }

  open(): void {
    if (this.overlay) return;
    const settings = this.saveSystem.loadSettings();

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,15,25,0.97);border:1px solid #446;
      border-radius:8px;padding:20px;z-index:1000;color:#eee;
      font:13px monospace;min-width:320px;
    `;

    overlay.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-size:15px;font-weight:bold;color:#e2b96f">설정</span>
        <button id="sp-x" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px">✕</button>
      </div>
    `;

    const makeToggle = (label: string, key: keyof SettingsSaveData, currentVal: boolean) => {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #223`;
      const lbl = document.createElement('span');
      lbl.textContent = label;
      lbl.style.color = '#ccc';

      const btn = document.createElement('button');
      btn.dataset.key = key;
      btn.dataset.value = currentVal ? '1' : '0';
      btn.style.cssText = `
        padding:4px 12px;border:none;border-radius:12px;cursor:pointer;
        font:11px monospace;min-width:50px;
        background:${currentVal ? '#2a6e4a' : '#333'};color:${currentVal ? '#aff' : '#888'};
      `;
      btn.textContent = currentVal ? 'ON' : 'OFF';
      btn.onclick = () => {
        const newVal = btn.dataset.value !== '1';
        btn.dataset.value = newVal ? '1' : '0';
        btn.style.background = newVal ? '#2a6e4a' : '#333';
        btn.style.color = newVal ? '#aff' : '#888';
        btn.textContent = newVal ? 'ON' : 'OFF';
        (settings as unknown as Record<string, unknown>)[key] = newVal;
        this.saveSystem.saveSettings(settings);
      };
      row.appendChild(lbl);
      row.appendChild(btn);
      return row;
    };

    const makeSelect = (label: string, key: keyof SettingsSaveData, options: { v: string | number; l: string }[], currentVal: string | number) => {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #223`;
      const lbl = document.createElement('span');
      lbl.textContent = label;
      lbl.style.color = '#ccc';

      const sel = document.createElement('select');
      sel.style.cssText = `background:#222;color:#eee;border:1px solid #446;padding:4px 8px;font:11px monospace;border-radius:3px`;
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = String(opt.v);
        o.textContent = opt.l;
        if (String(opt.v) === String(currentVal)) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = () => {
        const parsed = isNaN(Number(sel.value)) ? sel.value : Number(sel.value);
        (settings as unknown as Record<string, unknown>)[key] = parsed;
        this.saveSystem.saveSettings(settings);
      };

      row.appendChild(lbl);
      row.appendChild(sel);
      return row;
    };

    overlay.appendChild(makeToggle('자동 픽업 (자원 아이템)', 'autoPickup', settings.autoPickup));
    overlay.appendChild(makeSelect('자동 저장 주기', 'autoSaveInterval', [
      { v: 1, l: '1분' }, { v: 3, l: '3분' }, { v: 5, l: '5분' }, { v: 10, l: '10분' }, { v: 0, l: '끄기' },
    ], settings.autoSaveInterval));

    const dispHeader = document.createElement('div');
    dispHeader.style.cssText = 'color:#7a9;font-size:10px;padding:10px 0 4px;letter-spacing:1px';
    dispHeader.textContent = '── 표시 ──────────────────────────';
    overlay.appendChild(dispHeader);

    overlay.appendChild(makeToggle('FPS 표시', 'showFPS', settings.showFPS));
    overlay.appendChild(makeToggle('좌표 표시', 'showCoords', settings.showCoords));

    const gameHeader = document.createElement('div');
    gameHeader.style.cssText = 'color:#7a9;font-size:10px;padding:10px 0 4px;letter-spacing:1px';
    gameHeader.textContent = '── 게임 ──────────────────────────';
    overlay.appendChild(gameHeader);

    overlay.appendChild(makeSelect('언어', 'language', [
      { v: 'ko', l: '한국어' },
    ], settings.language));

    overlay.querySelector('#sp-x')!.addEventListener('click', () => this.close());

    const closeOnOutside = (e: MouseEvent) => {
      if (!overlay.contains(e.target as Node)) {
        this.close();
        document.removeEventListener('mousedown', closeOnOutside);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeOnOutside), 0);

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  isOpen(): boolean { return this.overlay !== null; }
}
