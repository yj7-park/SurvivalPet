import Phaser from 'phaser';
import { MapGenerator, TileType, TILE_SIZE } from '../world/MapGenerator';
import { registerTextures } from '../world/SpriteGenerator';
import { SaveSystem, SaveData } from '../systems/SaveSystem';
import { SeedInputScreen } from '../ui/SeedInputScreen';
import { CharacterCreateScreen, CharacterData } from '../ui/CharacterCreateScreen';
import { SettingsPanel } from '../ui/SettingsPanel';
import { openLoadSlotPanel } from '../ui/PauseMenu';
import { SoundSystem } from '../systems/SoundSystem';

const MAP_W = 100;
const MAP_H = 100;
const TREE_OVERHANG = 16;

export class TitleScene extends Phaser.Scene {
  private tileRT!: Phaser.GameObjects.RenderTexture;
  private overlay!: HTMLDivElement;
  private saveSystem = new SaveSystem();
  private soundSystem = new SoundSystem();
  private seedScreen = new SeedInputScreen();
  private charScreen = new CharacterCreateScreen();
  private settingsPanel!: SettingsPanel;
  private pendingSeed = '';
  private treeSprites: Phaser.GameObjects.Image[] = [];

  constructor() { super({ key: 'TitleScene' }); }

  create() {
    registerTextures(this);
    this.settingsPanel = new SettingsPanel(this.saveSystem, this.soundSystem);

    // Generate background map
    const bgSeed = Math.random().toString(36).substring(2, 8);
    const mapGen = new MapGenerator(bgSeed);
    const mapData = mapGen.generateMap(0, 0);
    const tiles = mapData.tiles;

    this.tileRT = this.add.renderTexture(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE)
      .setDepth(0).setOrigin(0, 0);

    const groundKey: Record<TileType, string> = {
      [TileType.Dirt]:  'tile_dirt',
      [TileType.Water]: 'tile_water',
      [TileType.Rock]:  'tile_rock',
      [TileType.Tree]:  'tile_dirt',
    };

    for (let ty = 0; ty < MAP_H; ty++)
      for (let tx = 0; tx < MAP_W; tx++)
        this.tileRT.draw(groundKey[tiles[ty][tx]], tx * TILE_SIZE, ty * TILE_SIZE);

    for (let ty = 0; ty < MAP_H; ty++)
      for (let tx = 0; tx < MAP_W; tx++)
        if (tiles[ty][tx] === TileType.Tree) {
          const img = this.add.image(tx * TILE_SIZE, ty * TILE_SIZE - TREE_OVERHANG, 'obj_tree')
            .setOrigin(0, 0).setDepth((ty + 1) * TILE_SIZE);
          this.treeSprites.push(img);
        }

    this.cameras.main.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);
    this.cameras.main.setZoom(2);
    this.cameras.main.centerOn(MAP_W * TILE_SIZE / 2, MAP_H * TILE_SIZE / 2);

    this.buildUI();

    this.events.once('shutdown', () => this.cleanupUI());
    this.events.once('destroy', () => this.cleanupUI());
  }

  update() {
    const t = this.time.now / 1000;
    const cx = MAP_W * TILE_SIZE / 2 + Math.cos(t * 0.06) * (MAP_W * TILE_SIZE * 0.28);
    const cy = MAP_H * TILE_SIZE / 2 + Math.sin(t * 0.04) * (MAP_H * TILE_SIZE * 0.22);
    this.cameras.main.centerOn(cx, cy);
  }

  private buildUI(): void {
    const hasSaves = this.saveSystem.getSlotMeta().some(m => m.occupied);
    const version = '0.26.0';

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      z-index:100;pointer-events:none;
    `;

    // Title
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `
      text-align:center;margin-bottom:32px;pointer-events:none;
    `;
    titleDiv.innerHTML = `
      <div style="font:bold 36px monospace;color:#e8d5b0;text-shadow:0 0 20px #6a4;letter-spacing:2px">
        🌲 생존 시뮬레이터 🌲
      </div>
      <div style="font:14px monospace;color:#9ab;margin-top:8px">2D 실시간 생존 시뮬레이션</div>
    `;
    this.overlay.appendChild(titleDiv);

    // Buttons container
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;flex-direction:column;gap:10px;pointer-events:all';

    const initSoundOnce = (() => {
      let done = false;
      return () => {
        if (done) return;
        done = true;
        const savedSettings = this.saveSystem.loadSettings();
        void this.soundSystem.init().then(() => {
          this.soundSystem.setMasterVolume(savedSettings.masterVolume ?? 0.7);
          this.soundSystem.setSFXVolume(savedSettings.sfxVolume ?? 0.8);
          this.soundSystem.setBGMVolume(savedSettings.bgmVolume ?? 0.4);
          this.soundSystem.setBGMTheme('title', 1000);
        });
      };
    })();

    const makeBtn = (label: string, bg: string, disabled: boolean, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.disabled = disabled;
      btn.style.cssText = `
        padding:12px 0;width:220px;font:15px monospace;
        background:${disabled ? '#333' : bg};color:${disabled ? '#555' : '#fff'};
        border:1px solid ${disabled ? '#444' : '#557'};
        border-radius:4px;cursor:${disabled ? 'default' : 'pointer'};
        transition:opacity 0.12s;
      `;
      if (!disabled) {
        btn.onmouseenter = () => (btn.style.opacity = '0.82');
        btn.onmouseleave = () => (btn.style.opacity = '1');
        btn.onclick = () => { initSoundOnce(); onClick(); };
      }
      return btn;
    };

    btnContainer.appendChild(makeBtn('새 게임 만들기', '#2a5a3a', false, () => this.openSeedScreen()));
    const loadBtn = makeBtn('게임 불러오기', '#2a3a5a', !hasSaves, () => this.openLoadPanel());
    if (!hasSaves) {
      loadBtn.title = '저장된 게임이 없습니다';
    }
    btnContainer.appendChild(loadBtn);
    btnContainer.appendChild(makeBtn('설    정', '#3a3a5a', false, () => this.settingsPanel.toggle()));

    this.overlay.appendChild(btnContainer);

    // Version + copyright
    const footer = document.createElement('div');
    footer.style.cssText = `
      position:fixed;bottom:12px;left:50%;transform:translateX(-50%);
      font:11px monospace;color:#556;pointer-events:none;
      display:flex;gap:40px;
    `;
    footer.innerHTML = `<span>v${version}</span><span>© 2026</span>`;
    this.overlay.appendChild(footer);

    document.body.appendChild(this.overlay);
  }

  private cleanupUI(): void {
    this.overlay?.remove();
    this.seedScreen.close();
    this.charScreen.close();
    this.settingsPanel.close();
    this.soundSystem.silenceBGM();
  }

  private pendingIsMultiplayer = false;

  private openSeedScreen(): void {
    this.seedScreen.open(
      (seed: string, isMultiplayer: boolean) => {
        this.pendingSeed = seed;
        this.pendingIsMultiplayer = isMultiplayer;
        this.charScreen.open(
          (charData: CharacterData) => this.openSlotSelect(charData),
          () => this.openSeedScreen(),
        );
      },
      () => { /* back to title — already visible */ },
    );
  }

  private openLoadPanel(): void {
    openLoadSlotPanel(this.saveSystem, (saveData: SaveData) => {
      this.cleanupUI();
      this.scene.start('LoadingScene', { saveData, seed: saveData.seed, isLoad: true });
    });
  }

  private openSlotSelect(charData: CharacterData): void {
    const existing = document.getElementById('title-slot-select');
    existing?.remove();

    const meta = this.saveSystem.getSlotMeta();
    const panel = document.createElement('div');
    panel.id = 'title-slot-select';
    panel.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(10,15,25,0.97);border:1px solid #446;
      border-radius:8px;padding:20px;z-index:600;color:#eee;
      font:12px monospace;min-width:300px;
    `;

    panel.innerHTML = `
      <div style="font-size:14px;font-weight:bold;color:#e2b96f;margin-bottom:4px">어느 슬롯에 저장하시겠습니까?</div>
      <div style="color:#668;font-size:11px;margin-bottom:14px">슬롯을 선택한 뒤 게임이 시작됩니다</div>
    `;

    meta.forEach((m, i) => {
      const row = document.createElement('div');
      row.style.cssText = `
        border:1px solid #334;border-radius:4px;padding:10px;
        margin-bottom:8px;cursor:pointer;transition:background 0.1s;
      `;
      const info = m.occupied
        ? `${m.day + 1}일차  ${m.seed}  <span style="color:#f88">[덮어씀]</span>`
        : '<span style="color:#668">(비어 있음)</span>';
      row.innerHTML = `<div>슬롯 ${i + 1} — ${info}</div>`;
      row.onmouseenter = () => (row.style.background = '#1a2a3a');
      row.onmouseleave = () => (row.style.background = '');
      row.onclick = () => {
        if (m.occupied) {
          if (!confirm(`슬롯 ${i + 1}의 데이터를 덮어쓰시겠습니까?`)) return;
        }
        panel.remove();
        this.saveSystem.setLastUsedSlot(i);
        this.cleanupUI();
        this.scene.start('LoadingScene', {
          seed: this.pendingSeed,
          saveSlot: i,
          characterName: charData.name,
          appearance: charData.appearance,
          characterStats: charData.stats,
          isLoad: false,
          isMultiplayer: this.pendingIsMultiplayer,
        });
      };
      panel.appendChild(row);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '취소';
    cancelBtn.style.cssText = `
      width:100%;padding:8px;background:#333;color:#aaa;
      border:none;border-radius:4px;cursor:pointer;font:12px monospace;
    `;
    cancelBtn.onclick = () => {
      panel.remove();
      this.charScreen.open(
        (cd: CharacterData) => this.openSlotSelect(cd),
        () => this.openSeedScreen(),
      );
    };
    panel.appendChild(cancelBtn);

    document.body.appendChild(panel);
  }
}
