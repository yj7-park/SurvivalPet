import Phaser from 'phaser';
import { generateSeed } from '../utils/seedRandom';
import { SaveSystem, SaveData } from '../systems/SaveSystem';
import { openLoadSlotPanel } from '../ui/PauseMenu';

export class MainMenuScene extends Phaser.Scene {
  private seedInput!: HTMLInputElement;
  private overlay!: HTMLDivElement;
  private saveSystem = new SaveSystem();

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create() {
    const { width, height } = this.scale;

    // 배경
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a2332);

    // 타이틀
    this.add.text(width / 2, height * 0.25, 'SURVIVAL SIM', {
      fontSize: '48px',
      color: '#e8d5b0',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.35, '2D 실시간 생존 시뮬레이션', {
      fontSize: '18px',
      color: '#9ab',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // HTML 오버레이 UI
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, 0%);
      margin-top: -80px;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      z-index: 100;
    `;

    // Seed 입력
    this.seedInput = document.createElement('input');
    this.seedInput.type = 'text';
    this.seedInput.maxLength = 8;
    this.seedInput.placeholder = 'Seed 입력 (공란 시 자동 생성)';
    this.seedInput.style.cssText = `
      padding: 10px 16px; font-size: 16px; font-family: monospace;
      background: #0f1923; color: #e8d5b0; border: 1px solid #446;
      border-radius: 4px; width: 260px; text-align: center;
      outline: none;
    `;
    this.overlay.appendChild(this.seedInput);

    // 새 게임 버튼
    const newGameBtn = this.createButton('새 게임 만들기', '#2a6e4a', () => {
      const seed = this.seedInput.value.trim() || generateSeed();
      this.startGame(seed);
    });

    // 참가 버튼
    const joinBtn = this.createButton('Seed로 참가', '#4a6e2a', () => {
      const seed = this.seedInput.value.trim();
      if (!seed) {
        this.seedInput.placeholder = 'Seed를 입력하세요!';
        this.seedInput.style.borderColor = '#f66';
        return;
      }
      this.startGame(seed);
    });

    // 불러오기 버튼
    const loadBtn = this.createButton('불러오기', '#2a3a6e', () => {
      openLoadSlotPanel(this.saveSystem, (saveData: SaveData) => {
        this.overlay.remove();
        this.scene.start('GameScene', { seed: saveData.seed, saveData });
      });
    });
    // 저장 슬롯이 하나도 없으면 회색 처리
    const hasSaves = this.saveSystem.getSlotMeta().some(m => m.occupied);
    if (!hasSaves) {
      loadBtn.style.opacity = '0.4';
      loadBtn.style.cursor = 'default';
      loadBtn.onclick = null;
    }

    this.overlay.appendChild(newGameBtn);
    this.overlay.appendChild(joinBtn);
    this.overlay.appendChild(loadBtn);
    document.body.appendChild(this.overlay);

    this.events.once('shutdown', () => this.overlay.remove());
    this.events.once('destroy', () => this.overlay.remove());
  }

  private createButton(label: string, bg: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      padding: 12px 32px; font-size: 16px; font-family: monospace;
      background: ${bg}; color: #fff; border: none;
      border-radius: 4px; cursor: pointer; width: 260px;
      transition: opacity 0.15s;
    `;
    btn.onmouseenter = () => (btn.style.opacity = '0.8');
    btn.onmouseleave = () => (btn.style.opacity = '1');
    btn.onclick = onClick;
    return btn;
  }

  private startGame(seed: string) {
    this.overlay.remove();
    this.scene.start('GameScene', { seed });
  }
}
