import Phaser from 'phaser';
import { SaveData, SaveSystem } from '../systems/SaveSystem';
import { UI_COLORS } from '../config/uiColors';

interface LoadingData {
  seed: string;
  isLoad: boolean;
  saveData?: SaveData;
  saveSlot?: number;
  characterName?: string;
  appearance?: number;
  characterStats?: { str: number; agi: number; con: number; int: number };
  isMultiplayer?: boolean;
}

const STEPS = [
  { pct: 20,  label: '높이맵 생성 중…' },
  { pct: 35,  label: '타일 분류 중…' },
  { pct: 50,  label: '강·호수 생성 중…' },
  { pct: 65,  label: '나무 배치 중…' },
  { pct: 75,  label: '건설물 초기화 중…' },
  { pct: 90,  label: '시스템 초기화 중…' },
  { pct: 100, label: '완료' },
];

export class LoadingScene extends Phaser.Scene {
  private overlay!: HTMLDivElement;
  private loadData!: LoadingData;

  constructor() { super({ key: 'LoadingScene' }); }

  init(data: LoadingData) {
    this.loadData = data;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0e0a06');

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:${UI_COLORS.panelBg};border:1px solid ${UI_COLORS.panelBorder};
      border-radius:8px;padding:36px 48px;z-index:300;color:${UI_COLORS.textPrimary};
      font:11px 'Courier New',monospace;min-width:360px;text-align:center;
    `;
    overlay.innerHTML = `
      <div style="font-size:24px;font-weight:bold;margin-bottom:6px;letter-spacing:4px">⛺ BASECAMP</div>
      <div style="color:${UI_COLORS.textSecondary};margin-bottom:24px;font-size:10px">생존 시뮬레이션</div>
      <div style="background:${UI_COLORS.gaugeBg};border-radius:6px;overflow:hidden;height:10px;margin-bottom:10px;border:1px solid ${UI_COLORS.slotBorder}">
        <div id="ld-fill" style="height:100%;background:linear-gradient(90deg,#5a3a1a,#c8884a);width:0%;transition:width 0.3s ease;border-radius:6px"></div>
      </div>
      <div id="ld-label" style="color:${UI_COLORS.textSecondary};font-size:10px;margin-bottom:8px">초기화 중…</div>
      <div id="ld-pct" style="color:${UI_COLORS.textWarning};font-size:13px;margin-bottom:12px">0%</div>
      <div style="color:${UI_COLORS.textDisabled};font-size:10px">seed: ${this.loadData.seed}</div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.events.once('shutdown', () => overlay.remove());
    this.events.once('destroy', () => overlay.remove());

    this.runSteps(0);
  }

  private runSteps(idx: number): void {
    if (idx >= STEPS.length) {
      // Brief pause then flash transition
      this.time.delayedCall(300, () => {
        this.cameras.main.flash(400, 255, 255, 255, false, () => {
          this.launchGame();
        });
      });
      return;
    }
    const step = STEPS[idx];
    this.time.delayedCall(idx === 0 ? 0 : 220, () => {
      const fill = document.getElementById('ld-fill');
      const pct = document.getElementById('ld-pct');
      const lbl = document.getElementById('ld-label');
      if (fill) fill.style.width = step.pct + '%';
      if (pct) pct.textContent = step.pct + '%';
      if (lbl) lbl.textContent = step.label;
      this.runSteps(idx + 1);
    });
  }

  private launchGame(): void {
    const d = this.loadData;

    if (d.isLoad && d.saveData) {
      this.overlay.remove();
      this.scene.start('GameScene', { seed: d.saveData.seed, saveData: d.saveData });
      return;
    }

    // New game — create initial save if slot provided
    if (d.saveSlot !== undefined) {
      const saveSystem = new SaveSystem();
      saveSystem.setLastUsedSlot(d.saveSlot);
    }

    this.overlay.remove();
    this.scene.start('GameScene', {
      seed: d.seed,
      characterName: d.characterName,
      appearance: d.appearance,
      characterStats: d.characterStats,
      saveSlot: d.saveSlot,
      isMultiplayer: d.isMultiplayer ?? false,
    });
  }
}
