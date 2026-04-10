import Phaser from 'phaser';
import { SaveData, SaveSystem } from '../systems/SaveSystem';

interface LoadingData {
  seed: string;
  isLoad: boolean;
  saveData?: SaveData;
  saveSlot?: number;
  characterName?: string;
  appearance?: number;
  characterStats?: { str: number; agi: number; con: number; int: number };
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
    this.cameras.main.setBackgroundColor('#0a0f0a');

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(5,10,5,0.95);border:1px solid #446;
      border-radius:8px;padding:32px 40px;z-index:300;color:#eee;
      font:13px monospace;min-width:340px;text-align:center;
    `;
    overlay.innerHTML = `
      <div style="font-size:20px;margin-bottom:20px">🌍 세계를 생성하는 중…</div>
      <div style="background:#111;border-radius:6px;overflow:hidden;height:18px;margin-bottom:10px;border:1px solid #334">
        <div id="ld-fill" style="height:100%;background:linear-gradient(90deg,#2a6e4a,#4aae7a);width:0%;transition:width 0.3s ease;border-radius:6px"></div>
      </div>
      <div id="ld-pct" style="color:#6ac;margin-bottom:6px">0%</div>
      <div id="ld-label" style="color:#778;font-size:11px">초기화 중…</div>
      <div style="color:#446;font-size:11px;margin-top:14px">seed: ${this.loadData.seed}</div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.events.once('shutdown', () => overlay.remove());
    this.events.once('destroy', () => overlay.remove());

    this.runSteps(0);
  }

  private runSteps(idx: number): void {
    if (idx >= STEPS.length) {
      this.time.delayedCall(200, () => this.launchGame());
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
    });
  }
}
