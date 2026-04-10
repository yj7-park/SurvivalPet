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

function getSkyPeriod(hour: number): 'dawn' | 'day' | 'dusk' | 'night' {
  if (hour >= 5 && hour < 8)  return 'dawn';
  if (hour >= 8 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'dusk';
  return 'night';
}

const TITLE_SKY_HEX: Record<'dawn' | 'day' | 'dusk' | 'night', { top: number; bottom: number }> = {
  dawn:  { top: 0x1a0a2a, bottom: 0xe06828 },
  day:   { top: 0x4a90d0, bottom: 0x8ec8f0 },
  dusk:  { top: 0x1a1040, bottom: 0xc05020 },
  night: { top: 0x050510, bottom: 0x0a0818 },
};

export function playGameStartTransition(scene: Phaser.Scene, onComplete: () => void): void {
  const W = scene.cameras.main.width;
  const H = scene.cameras.main.height;

  scene.cameras.main.zoomTo(1.15, 800, 'Linear');

  const flash = scene.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0)
    .setScrollFactor(0).setDepth(100);

  scene.tweens.add({
    targets: flash, alpha: 1,
    duration: 300, delay: 600, ease: 'Quad.easeIn',
    onComplete: () => onComplete(),
  });

  const txt = scene.add.text(W / 2, H / 2, '탐험을 시작합니다!', {
    fontSize: '20px', color: '#000000',
    fontFamily: 'Courier New', fontStyle: 'bold',
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setAlpha(0);

  scene.tweens.add({ targets: txt, alpha: 1, duration: 200, delay: 650 });
}

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
  private logoImage!: Phaser.GameObjects.Image;
  private pendingIsMultiplayer = false;

  constructor() { super({ key: 'TitleScene' }); }

  create() {
    registerTextures(this);
    this.settingsPanel = new SettingsPanel(this.saveSystem, this.soundSystem);

    const W = this.scale.width;
    const H = this.scale.height;

    // ── Sky gradient (screen-fixed) ───────────────────────────────────────────
    const skyGfx = this.add.graphics().setScrollFactor(0).setDepth(0);
    this.drawSky(skyGfx, W, H);

    // ── Mountain silhouette (screen-fixed, depth illusion) ────────────────────
    const mtGfx = this.add.graphics().setScrollFactor(0).setDepth(2);
    this.drawMountains(mtGfx, W, H);

    // ── Background map (fixed seed) ───────────────────────────────────────────
    const mapGen = new MapGenerator('title_bg_v1');
    const mapData = mapGen.generateMap(0, 0);
    const tiles = mapData.tiles;

    this.tileRT = this.add.renderTexture(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE)
      .setDepth(3).setOrigin(0, 0);

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
            .setOrigin(0, 0).setDepth(4);
          this.treeSprites.push(img);
        }

    this.cameras.main.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);
    this.cameras.main.setZoom(2);
    this.cameras.main.centerOn(MAP_W * TILE_SIZE / 2, MAP_H * TILE_SIZE / 2);

    // ── Foreground tree silhouettes (screen-fixed) ────────────────────────────
    const fgGfx = this.add.graphics().setScrollFactor(0).setDepth(6);
    this.drawForegroundTrees(fgGfx, W, H);

    // ── Campfire particles (lower-left) ───────────────────────────────────────
    this.add.particles(Math.floor(W * 0.15), Math.floor(H * 0.85), 'fx_raindrop', {
      tint: [0xff6600, 0xff9900, 0xffcc00],
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.8, end: 0 },
      speedY: { min: -60, max: -100 },
      speedX: { min: -10, max: 10 },
      lifespan: { min: 400, max: 700 },
      quantity: 1, frequency: 80,
      blendMode: Phaser.BlendModes.ADD,
    }).setScrollFactor(0).setDepth(5);

    // ── Logo with fade-in animation ───────────────────────────────────────────
    this.logoImage = this.add.image(W / 2, Math.floor(H * 0.2) - 20, 'title_logo')
      .setScrollFactor(0).setDepth(10).setAlpha(0);

    this.tweens.add({
      targets: this.logoImage,
      alpha: 1,
      y: Math.floor(H * 0.2),
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => this.spawnLogoSparkles(W, H),
    });

    // ── Firefly particles (night: 20:00~06:00) ────────────────────────────────
    const hour = new Date().getHours();
    if (hour >= 20 || hour < 6) {
      this.add.particles(0, 0, 'fx_snowflake', {
        x: { min: 0, max: W },
        y: { min: Math.floor(H * 0.5), max: Math.floor(H * 0.9) },
        tint: 0xccffaa,
        scale: { min: 0.3, max: 0.7 },
        alpha: { start: 0.7, end: 0 },
        lifespan: { min: 2000, max: 4000 },
        quantity: 1, frequency: 800,
        blendMode: Phaser.BlendModes.ADD,
      }).setScrollFactor(0).setDepth(8);
    }

    this.buildUI();
    this.events.once('shutdown', () => this.cleanupUI());
    this.events.once('destroy', () => this.cleanupUI());
  }

  private drawSky(gfx: Phaser.GameObjects.Graphics, W: number, H: number): void {
    const hour = new Date().getHours();
    const period = getSkyPeriod(hour);
    const { top, bottom } = TITLE_SKY_HEX[period];
    const steps = 16;
    const skyH = H * 0.65;

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = Math.round(((top >> 16) & 0xff) * (1 - t) + ((bottom >> 16) & 0xff) * t);
      const g = Math.round(((top >> 8) & 0xff) * (1 - t) + ((bottom >> 8) & 0xff) * t);
      const b = Math.round((top & 0xff) * (1 - t) + (bottom & 0xff) * t);
      gfx.fillStyle((r << 16) | (g << 8) | b, 1);
      const y = Math.floor(i * skyH / steps);
      gfx.fillRect(0, y, W, Math.ceil(skyH / steps) + 1);
    }
  }

  private drawMountains(gfx: Phaser.GameObjects.Graphics, W: number, H: number): void {
    const baseY = H * 0.58;

    // Far mountain layer
    gfx.fillStyle(0x1a2a1a, 0.5);
    gfx.beginPath();
    gfx.moveTo(0, baseY);
    for (let x = 0; x <= W; x += 40) {
      const ph = 45 + Math.abs(Math.sin(x * 0.023)) * 55 + Math.abs(Math.sin(x * 0.017 + 1)) * 30;
      gfx.lineTo(x, baseY - ph);
    }
    gfx.lineTo(W, baseY);
    gfx.closePath();
    gfx.fillPath();

    // Near mountain layer (darker)
    gfx.fillStyle(0x0e1a0e, 0.65);
    gfx.beginPath();
    gfx.moveTo(0, baseY);
    for (let x = 0; x <= W; x += 28) {
      const ph = 20 + Math.abs(Math.sin(x * 0.031 + 2)) * 38 + Math.abs(Math.sin(x * 0.019 + 3)) * 22;
      gfx.lineTo(x, baseY - ph);
    }
    gfx.lineTo(W, baseY);
    gfx.closePath();
    gfx.fillPath();
  }

  private drawForegroundTrees(gfx: Phaser.GameObjects.Graphics, W: number, H: number): void {
    const baseY = H;
    gfx.fillStyle(0x050803, 0.88);
    for (let x = -10; x < W + 20; x += 20) {
      const h = 30 + Math.abs(Math.sin(x * 0.047)) * 18;
      gfx.fillTriangle(x, baseY, x - 11, baseY - h, x + 11, baseY - h);
      const h2 = 22 + Math.abs(Math.cos(x * 0.063 + 1)) * 14;
      gfx.fillTriangle(x + 10, baseY, x + 1, baseY - h2, x + 19, baseY - h2);
    }
  }

  private spawnLogoSparkles(W: number, H: number): void {
    const logoY = Math.floor(H * 0.2);
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 80, () => {
        const x = W / 2 + Phaser.Math.Between(-120, 120);
        const y = logoY + Phaser.Math.Between(-30, 30);
        const spark = this.add.star(x, y, 4, 2, 5, 0xffd060)
          .setAlpha(0).setScrollFactor(0).setDepth(11);
        this.tweens.add({
          targets: spark,
          alpha: { from: 0, to: 0.9 },
          scale: { from: 0, to: 1.2 },
          duration: 200,
          yoyo: true,
          onComplete: () => spark.destroy(),
        });
      });
    }
  }

  update() {
    const t = this.time.now / 1000;
    const cx = MAP_W * TILE_SIZE / 2 + Math.cos(t * 0.06) * (MAP_W * TILE_SIZE * 0.28);
    const cy = MAP_H * TILE_SIZE / 2 + Math.sin(t * 0.04) * (MAP_H * TILE_SIZE * 0.22);
    this.cameras.main.centerOn(cx, cy);
  }

  private buildUI(): void {
    const hasSaves = this.saveSystem.getSlotMeta().some(m => m.occupied);

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      z-index:100;pointer-events:none;
    `;

    // Menu buttons (centered, shifted down to clear logo)
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;flex-direction:column;gap:10px;pointer-events:all;margin-top:130px';

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

    const makeBtn = (label: string, bg: string, bdColor: string, disabled: boolean, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.disabled = disabled;
      btn.style.cssText = `
        padding:10px 0;width:220px;font:14px monospace;
        background:${disabled ? 'rgba(20,15,8,0.5)' : bg};
        color:${disabled ? '#444' : '#c0a878'};
        border:1px solid ${disabled ? '#333' : bdColor};
        border-radius:6px;cursor:${disabled ? 'default' : 'pointer'};
        transition:all 0.12s;letter-spacing:0.5px;
      `;
      if (!disabled) {
        btn.onmouseenter = () => {
          btn.style.color = '#f0d090';
          btn.style.borderColor = '#a07030';
          btn.style.paddingLeft = '8px';
        };
        btn.onmouseleave = () => {
          btn.style.color = '#c0a878';
          btn.style.borderColor = bdColor;
          btn.style.paddingLeft = '0px';
        };
        btn.onclick = () => { initSoundOnce(); onClick(); };
      }
      return btn;
    };

    btnContainer.appendChild(makeBtn('새 게임 시작', 'rgba(26,36,16,0.75)', '#4a6a30', false, () => this.openSeedScreen()));
    const loadBtn = makeBtn('게임 불러오기', 'rgba(16,26,36,0.75)', '#304a6a', !hasSaves, () => this.openLoadPanel());
    if (!hasSaves) loadBtn.title = '저장된 게임이 없습니다';
    btnContainer.appendChild(loadBtn);
    btnContainer.appendChild(makeBtn('설    정', 'rgba(22,22,36,0.75)', '#3a3a6a', false, () => this.settingsPanel.toggle()));

    this.overlay.appendChild(btnContainer);

    // Version footer
    const footer = document.createElement('div');
    footer.style.cssText = `
      position:fixed;bottom:12px;left:50%;transform:translateX(-50%);
      font:11px monospace;color:#445;pointer-events:none;
      display:flex;gap:40px;
    `;
    footer.innerHTML = `<span>v0.48.0</span><span>© 2026</span>`;
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
