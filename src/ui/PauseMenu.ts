import { SaveSystem, SaveData, SettingsSaveData } from '../systems/SaveSystem';
import type { SoundSystem } from '../systems/SoundSystem';

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
  private onPause?: () => void;
  private onResume?: () => void;

  constructor(
    private saveSystem: SaveSystem,
    private onCollectSaveData: () => SaveData,
    private onLoadGame: (saveData: SaveData) => void,
    private onReturnToTitle: () => void,
    private isMultiplayer = false,
    private soundSystem?: SoundSystem,
    private getHudSettings?: () => { showFPS: boolean; showCoords: boolean },
    private onSettingsChanged?: (settings: Partial<SettingsSaveData>) => void,
  ) {}

  setPauseCallbacks(onPause: () => void, onResume: () => void): void {
    this.onPause = onPause;
    this.onResume = onResume;
  }

  toggle(): void {
    if (this.overlay) { this.close(); } else { this.open(); }
  }

  open(): void {
    if (this.overlay) return;
    this.onPause?.();

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,15,25,0.97);border:1px solid #446;
      border-radius:8px;padding:24px;z-index:900;color:#eee;
      font:14px monospace;min-width:220px;text-align:center;
    `;
    overlay.innerHTML = `
      <div style="font-size:18px;font-weight:bold;color:#e2b96f;margin-bottom:4px">⛺ BASECAMP</div>
      <div style="font-size:11px;color:#666;margin-bottom:16px">일시정지</div>
    `;

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

    overlay.appendChild(makeBtn('계속하기', '#223344', () => this.close()));
    if (!this.isMultiplayer) {
      overlay.appendChild(makeBtn('지금 저장', '#2a4a2a', () => {
        const data = this.onCollectSaveData();
        data.savedAt = Date.now();
        const res = this.saveSystem.saveAuto(data);
        showStatusToast(res.ok ? '💾 저장되었습니다' : '⚠ 저장 실패');
      }));
      overlay.appendChild(makeBtn('불러오기', '#2a3a4a', () => this.openLoadPanel()));
    }
    overlay.appendChild(makeBtn('설정', '#2a2a3a', () => this.openSettingsPanel()));
    overlay.appendChild(makeBtn('타이틀로 돌아가기', '#3a2a2a', () => {
      this.openReturnConfirm();
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
    this.onResume?.();
  }

  isOpen(): boolean { return this.overlay !== null; }

  private openReturnConfirm(): void {
    this.subPanel?.remove();
    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,15,25,0.97);border:1px solid #664;
      border-radius:8px;padding:20px;z-index:950;color:#eee;
      font:12px monospace;min-width:300px;text-align:center;
    `;
    panel.innerHTML = `
      <div style="font-size:13px;color:#e2b96f;margin-bottom:8px;font-weight:bold">타이틀로 돌아가기</div>
      <div style="color:#aaa;margin-bottom:16px;line-height:1.6">
        타이틀 화면으로 돌아가시겠습니까?<br>
        저장하지 않은 진행 상황은 사라집니다.
      </div>
    `;
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';

    const makeConfirmBtn = (label: string, bg: string, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `padding:8px 14px;background:${bg};color:#fff;border:none;border-radius:4px;cursor:pointer;font:11px monospace`;
      btn.onclick = onClick;
      return btn;
    };

    btnRow.appendChild(makeConfirmBtn('저장 후 타이틀로', '#2a5a3a', () => {
      panel.remove();
      this.subPanel = null;
      // Save to last used slot then return
      const data = this.onCollectSaveData();
      data.savedAt = Date.now();
      this.saveSystem.saveAuto(data);
      this.close();
      this.onReturnToTitle();
    }));
    btnRow.appendChild(makeConfirmBtn('저장 없이 나가기', '#5a2a2a', () => {
      if (confirm('정말로 저장하지 않고 나가시겠습니까?')) {
        panel.remove();
        this.subPanel = null;
        this.close();
        this.onReturnToTitle();
      }
    }));
    btnRow.appendChild(makeConfirmBtn('취소', '#333', () => {
      panel.remove();
      this.subPanel = null;
    }));

    panel.appendChild(btnRow);
    document.body.appendChild(panel);
    this.subPanel = panel;
  }

  private openSettingsPanel(): void {
    this.subPanel?.remove();
    const settings = this.saveSystem.loadSettings();
    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed;top:50%;left:calc(50% + 150px);transform:translateY(-50%);
      background:rgba(10,15,25,0.97);border:1px solid #446;
      border-radius:8px;padding:16px;z-index:901;color:#eee;
      font:12px monospace;min-width:280px;
    `;

    const mkSlider = (label: string, value: number, onChange: (v: number) => void) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'flex:1;color:#bbb';
      lbl.textContent = label;
      const val = document.createElement('span');
      val.style.cssText = 'width:32px;text-align:right;color:#fff';
      val.textContent = Math.round(value * 100) + '%';
      const slider = document.createElement('input');
      slider.type = 'range'; slider.min = '0'; slider.max = '100';
      slider.value = String(Math.round(value * 100));
      slider.style.cssText = 'flex:2;accent-color:#5599ff';
      slider.addEventListener('input', () => {
        const v = parseInt(slider.value) / 100;
        val.textContent = slider.value + '%';
        onChange(v);
      });
      row.appendChild(lbl); row.appendChild(slider); row.appendChild(val);
      return row;
    };

    const mkToggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'color:#bbb';
      lbl.textContent = label;
      const btn = document.createElement('button');
      btn.textContent = checked ? 'ON' : 'OFF';
      btn.style.cssText = `padding:3px 10px;background:${checked ? '#2a6e4a' : '#444'};color:#fff;border:none;border-radius:3px;cursor:pointer;font:11px monospace`;
      btn.addEventListener('click', () => {
        checked = !checked;
        btn.textContent = checked ? 'ON' : 'OFF';
        btn.style.background = checked ? '#2a6e4a' : '#444';
        onChange(checked);
      });
      row.appendChild(lbl); row.appendChild(btn);
      return row;
    };

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:13px;font-weight:bold;color:#e2b96f">설정</span>
        <button id="set-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div id="set-body"></div>
    `;

    const body = panel.querySelector('#set-body') as HTMLDivElement;
    body.appendChild(mkSlider('🔊 마스터 볼륨', settings.masterVolume, (v) => {
      settings.masterVolume = v;
      this.soundSystem?.setMasterVolume(v);
      this.saveSystem.saveSettings(settings);
      this.onSettingsChanged?.({ masterVolume: v });
    }));
    body.appendChild(mkSlider('🎵 BGM 볼륨', settings.bgmVolume, (v) => {
      settings.bgmVolume = v;
      this.soundSystem?.setBGMVolume(v);
      this.saveSystem.saveSettings(settings);
      this.onSettingsChanged?.({ bgmVolume: v });
    }));
    body.appendChild(mkSlider('🔔 효과음 볼륨', settings.sfxVolume, (v) => {
      settings.sfxVolume = v;
      this.soundSystem?.setSFXVolume(v);
      this.saveSystem.saveSettings(settings);
      this.onSettingsChanged?.({ sfxVolume: v });
    }));
    const shakeVal = settings.screenShake ?? 1.0;
    body.appendChild(mkSlider('📳 화면 흔들림', shakeVal, (v) => {
      settings.screenShake = v;
      this.saveSystem.saveSettings(settings);
      this.onSettingsChanged?.({ screenShake: v });
    }));
    const hudSettings = this.getHudSettings?.() ?? { showFPS: false, showCoords: false };
    body.appendChild(mkToggle('FPS 표시', hudSettings.showFPS, (v) => {
      this.saveSystem.saveSettings({ ...settings, showFPS: v });
      this.onSettingsChanged?.({ showFPS: v });
    }));
    body.appendChild(mkToggle('좌표 표시', hudSettings.showCoords, (v) => {
      this.saveSystem.saveSettings({ ...settings, showCoords: v });
      this.onSettingsChanged?.({ showCoords: v });
    }));

    panel.querySelector('#set-close')!.addEventListener('click', () => {
      panel.remove();
      this.subPanel = null;
    });

    document.body.appendChild(panel);
    this.subPanel = panel;
  }

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
