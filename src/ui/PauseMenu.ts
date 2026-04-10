import { SaveSystem, SaveData } from '../systems/SaveSystem';

function formatPlaytime(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

function showStatusToast(msg: string, isError = false): void {
  const popup = document.createElement('div');
  popup.style.cssText = `
    position:fixed;top:40%;left:50%;transform:translateX(-50%);
    color:${isError ? '#ffaa44' : '#aaffaa'};font:12px monospace;
    background:rgba(0,0,0,0.85);padding:6px 14px;border-radius:4px;
    z-index:2000;pointer-events:none;opacity:1;transition:opacity 1.5s ease;
    white-space:nowrap;
  `;
  popup.textContent = msg;
  document.body.appendChild(popup);
  setTimeout(() => { popup.style.opacity = '0'; setTimeout(() => popup.remove(), 1500); }, 800);
}

export class PauseMenu {
  private overlay: HTMLDivElement | null = null;
  private subPanel: HTMLDivElement | null = null;

  constructor(
    private saveSystem: SaveSystem,
    private onCollectSaveData: () => SaveData,
    private onLoadGame: (saveData: SaveData) => void,
    private onReturnToTitle: () => void,
  ) {}

  toggle(): void {
    if (this.overlay) { this.close(); } else { this.open(); }
  }

  open(): void {
    if (this.overlay) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,15,25,0.97);border:1px solid #446;
      border-radius:8px;padding:24px;z-index:900;color:#eee;
      font:14px monospace;min-width:200px;text-align:center;
    `;
    overlay.innerHTML = `<div style="font-size:16px;font-weight:bold;color:#e2b96f;margin-bottom:16px">일시정지</div>`;

    const makeBtn = (label: string, bg: string, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        display:block;width:180px;margin:0 auto 8px;padding:10px;
        background:${bg};color:#fff;border:none;border-radius:4px;
        cursor:pointer;font:13px monospace;
      `;
      btn.onmouseenter = () => (btn.style.opacity = '0.8');
      btn.onmouseleave = () => (btn.style.opacity = '1');
      btn.onclick = onClick;
      return btn;
    };

    overlay.appendChild(makeBtn('저장하기', '#2a4a2a', () => this.openSavePanel()));
    overlay.appendChild(makeBtn('불러오기', '#2a3a4a', () => this.openLoadPanel()));
    overlay.appendChild(makeBtn('타이틀로', '#3a2a2a', () => {
      this.close();
      this.onReturnToTitle();
    }));

    // Close on outside click
    overlay.addEventListener('click', (e) => e.stopPropagation());
    const outsideClose = (e: MouseEvent) => {
      if (!overlay.contains(e.target as Node) && !this.subPanel?.contains(e.target as Node)) {
        this.close();
        document.removeEventListener('mousedown', outsideClose);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', outsideClose), 0);

    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  close(): void {
    this.subPanel?.remove();
    this.subPanel = null;
    this.overlay?.remove();
    this.overlay = null;
  }

  isOpen(): boolean { return this.overlay !== null; }

  private openSavePanel(): void {
    this.subPanel?.remove();
    const meta = this.saveSystem.getSlotMeta();
    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed;top:50%;left:calc(50% + 150px);transform:translateY(-50%);
      background:rgba(10,15,25,0.97);border:1px solid #446;
      border-radius:8px;padding:16px;z-index:901;color:#eee;
      font:12px monospace;min-width:270px;
    `;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:13px;font-weight:bold;color:#e2b96f">저장 슬롯 선택</span>
        <button id="sp-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
      </div>
    `;

    for (let i = 0; i < 3; i++) {
      const m = meta[i];
      const row = document.createElement('div');
      row.style.cssText = `border:1px solid #334;border-radius:4px;padding:8px;margin-bottom:8px`;
      const info = m.occupied
        ? `${m.day + 1}일차  ${formatPlaytime(m.playtime)}  [${m.seed}]`
        : '(비어 있음)';
      row.innerHTML = `
        <div style="margin-bottom:6px;color:#bbb">슬롯 ${i + 1} — ${info}</div>
        <div style="display:flex;gap:4px;justify-content:flex-end">
          <button class="sp-save" data-slot="${i}" style="padding:4px 10px;background:#2a6e4a;color:#fff;border:none;border-radius:3px;cursor:pointer;font:11px monospace">저장</button>
          ${m.occupied ? `<button class="sp-del" data-slot="${i}" style="padding:4px 10px;background:#6e2a2a;color:#fff;border:none;border-radius:3px;cursor:pointer;font:11px monospace">삭제</button>` : ''}
        </div>
      `;
      panel.appendChild(row);
    }

    panel.querySelector('#sp-close')!.addEventListener('click', () => {
      panel.remove();
      this.subPanel = null;
    });
    panel.querySelectorAll('.sp-save').forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = parseInt((btn as HTMLElement).dataset.slot ?? '0');
        const m = meta[slot];
        if (m.occupied) {
          if (!confirm(`슬롯 ${slot + 1}을 덮어쓰시겠습니까?\n(${m.day + 1}일차, ${formatPlaytime(m.playtime)})`)) return;
        }
        const data = this.onCollectSaveData();
        data.savedAt = Date.now();
        const res = this.saveSystem.save(slot, data);
        if (res.ok) {
          showStatusToast('💾 저장되었습니다');
          panel.remove();
          this.subPanel = null;
        } else {
          showStatusToast('⚠ 저장 실패: ' + (res as { ok: false; reason: string }).reason, true);
        }
      });
    });
    panel.querySelectorAll('.sp-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = parseInt((btn as HTMLElement).dataset.slot ?? '0');
        if (confirm(`슬롯 ${slot + 1}의 데이터를 삭제하시겠습니까?`)) {
          this.saveSystem.deleteSave(slot);
          this.openSavePanel();
        }
      });
    });

    document.body.appendChild(panel);
    this.subPanel = panel;
  }

  private openLoadPanel(): void {
    this.subPanel?.remove();
    const meta = this.saveSystem.getSlotMeta();
    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed;top:50%;left:calc(50% + 150px);transform:translateY(-50%);
      background:rgba(10,15,25,0.97);border:1px solid #446;
      border-radius:8px;padding:16px;z-index:901;color:#eee;
      font:12px monospace;min-width:270px;
    `;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:13px;font-weight:bold;color:#e2b96f">게임 불러오기</span>
        <button id="lp-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
      </div>
    `;

    for (let i = 0; i < 3; i++) {
      const m = meta[i];
      const row = document.createElement('div');
      row.style.cssText = `border:1px solid #334;border-radius:4px;padding:8px;margin-bottom:8px`;
      if (m.occupied) {
        const date = new Date(m.savedAt).toLocaleString('ko-KR', {
          month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        row.innerHTML = `
          <div style="margin-bottom:2px">슬롯 ${i + 1} — ${m.day + 1}일차  ${formatPlaytime(m.playtime)}</div>
          <div style="color:#888;font-size:10px;margin-bottom:6px">저장: ${date}</div>
          <div style="text-align:right">
            <button class="lp-load" data-slot="${i}" style="padding:4px 10px;background:#2a3a6e;color:#fff;border:none;border-radius:3px;cursor:pointer;font:11px monospace">불러오기</button>
          </div>
        `;
      } else {
        row.innerHTML = `<div style="color:#666">슬롯 ${i + 1} — (비어 있음)</div>`;
      }
      panel.appendChild(row);
    }

    panel.querySelector('#lp-close')!.addEventListener('click', () => {
      panel.remove();
      this.subPanel = null;
    });
    panel.querySelectorAll('.lp-load').forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = parseInt((btn as HTMLElement).dataset.slot ?? '0');
        const data = this.saveSystem.load(slot);
        if (data) {
          this.saveSystem.setLastUsedSlot(slot);
          this.close();
          this.onLoadGame(data);
        } else {
          showStatusToast('⚠ 불러오기 실패', true);
        }
      });
    });

    document.body.appendChild(panel);
    this.subPanel = panel;
  }
}

/** Reusable load-slot panel for MainMenuScene */
export function openLoadSlotPanel(
  saveSystem: SaveSystem,
  onLoad: (saveData: SaveData) => void,
): void {
  const existing = document.getElementById('main-load-panel');
  existing?.remove();

  const meta = saveSystem.getSlotMeta();
  const panel = document.createElement('div');
  panel.id = 'main-load-panel';
  panel.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    background:rgba(10,15,25,0.97);border:1px solid #446;
    border-radius:8px;padding:20px;z-index:200;color:#eee;
    font:12px monospace;min-width:300px;
  `;
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <span style="font-size:14px;font-weight:bold;color:#e2b96f">게임 불러오기</span>
      <button id="mlp-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
    </div>
  `;

  for (let i = 0; i < 3; i++) {
    const m = meta[i];
    const row = document.createElement('div');
    row.style.cssText = `border:1px solid #334;border-radius:4px;padding:10px;margin-bottom:8px`;
    if (m.occupied) {
      const date = new Date(m.savedAt).toLocaleString('ko-KR', {
        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      row.innerHTML = `
        <div style="margin-bottom:2px">슬롯 ${i + 1} — ${m.day + 1}일차  ${formatPlaytime(m.playtime)}</div>
        <div style="color:#888;font-size:10px;margin-bottom:6px">저장: ${date}</div>
        <div style="text-align:right">
          <button class="mlp-load" data-slot="${i}" style="padding:5px 14px;background:#2a3a6e;color:#fff;border:none;border-radius:3px;cursor:pointer;font:12px monospace">불러오기</button>
        </div>
      `;
    } else {
      row.innerHTML = `<div style="color:#666;padding:4px 0">슬롯 ${i + 1} — (비어 있음)</div>`;
    }
    panel.appendChild(row);
  }

  panel.querySelector('#mlp-close')!.addEventListener('click', () => panel.remove());
  panel.querySelectorAll('.mlp-load').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = parseInt((btn as HTMLElement).dataset.slot ?? '0');
      const data = saveSystem.load(slot);
      if (data) {
        saveSystem.setLastUsedSlot(slot);
        panel.remove();
        onLoad(data);
      } else {
        showStatusToast('⚠ 불러오기 실패', true);
      }
    });
  });

  document.body.appendChild(panel);
}
