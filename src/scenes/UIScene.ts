import Phaser from 'phaser';
import { InventoryUI } from '../systems/InventoryUI';
import { EquipmentPanel } from '../systems/EquipmentPanel';

// Runtime reference only — no import to avoid circular dep
type GameSceneRef = {
  survival: import('../systems/SurvivalStats').SurvivalStats;
  charStats: import('../entities/CharacterStats').CharacterStats;
  gameTime: import('../systems/GameTime').GameTime;
  inventory: import('../systems/Inventory').Inventory;
  combat: import('../systems/CombatSystem').CombatSystem;
  weather: import('../systems/WeatherSystem').WeatherSystem;
  proficiency: import('../systems/ProficiencySystem').ProficiencySystem;
  equipmentSystem: import('../systems/EquipmentSystem').EquipmentSystem;
  seed: string;
  mapX: number;
  mapY: number;
  isNearTable(): boolean;
};

export class UIScene extends Phaser.Scene {
  public inventoryUI!: InventoryUI;
  private equipmentPanel!: EquipmentPanel;

  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private frenzyOverlay!: Phaser.GameObjects.Rectangle;
  private hitFlash!: Phaser.GameObjects.Rectangle;

  private hudTimeText!: Phaser.GameObjects.Text;
  private hudInfoText!: Phaser.GameObjects.Text;
  private hudStatBars!: {
    hp:      { bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
    hunger:  { bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
    fatigue: { bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
    action:  { bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text };
  };
  private hudCharStats!: Phaser.GameObjects.Text;
  private hudInventoryText!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'UIScene' }); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── 화면 전체 오버레이 (야간·광기·피격) ─────────────────
    this.nightOverlay = this.add
      .rectangle(W / 2, H / 2, W, H, 0x001133, 0).setDepth(50);
    this.frenzyOverlay = this.add
      .rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setDepth(51);
    this.hitFlash = this.add
      .rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setDepth(60).setVisible(false);

    // ── 좌상단: 시간 + 시드 ──────────────────────────────────
    this.hudTimeText = this.add.text(8, 8, '', {
      fontSize: '12px', color: '#ffe8a0', fontFamily: 'monospace',
      backgroundColor: '#00000099', padding: { x: 5, y: 3 },
    }).setDepth(100);

    this.hudInfoText = this.add.text(8, 30, '', {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
      backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setDepth(100);

    // ── 우상단: 스탯 바 ──────────────────────────────────────
    const BAR_W = 90, BAR_H = 7;
    const bx = W - 110, by0 = 12;

    const makebar = (y: number, color: number, labelStr: string) => {
      const bg   = this.add.rectangle(bx, y, BAR_W, BAR_H, 0x222222).setDepth(100).setOrigin(0, 0.5);
      const fill = this.add.rectangle(bx, y, BAR_W, BAR_H, color).setDepth(101).setOrigin(0, 0.5);
      const lbl  = this.add.text(bx - 52, y - 4, labelStr, {
        fontSize: '9px', color: '#cccccc', fontFamily: 'monospace',
      }).setDepth(100);
      return { bg, fill, label: lbl };
    };

    this.hudStatBars = {
      hp:      makebar(by0,      0xe05050, 'HP'),
      hunger:  makebar(by0 + 14, 0xe0a020, 'Hunger'),
      fatigue: makebar(by0 + 28, 0x4080e0, 'Fatigue'),
      action:  makebar(by0 + 42, 0x40c060, 'Action'),
    };

    // ── 좌하단: 캐릭터 스탯 + 인벤토리 요약 ─────────────────
    this.hudCharStats = this.add.text(8, H - 20, '', {
      fontSize: '10px', color: '#aaaaaa', fontFamily: 'monospace',
      backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setDepth(100);

    this.hudInventoryText = this.add.text(8, H - 40, '', {
      fontSize: '10px', color: '#dddddd', fontFamily: 'monospace',
      backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setDepth(100);

    // ── InventoryUI (무기 HUD + V키 패널) ────────────────────
    const gs = this.scene.get('GameScene') as unknown as GameSceneRef;
    this.inventoryUI = new InventoryUI(
      this, gs.inventory, gs.survival, gs.combat, gs.charStats,
      () => gs.isNearTable(),
      gs.equipmentSystem,
    );

    this.equipmentPanel = new EquipmentPanel(
      gs.equipmentSystem,
      gs.inventory,
      () => this.inventoryUI.getEquippedWeaponId(),
      () => gs.proficiency.getLevel('combat'),
    );

    // V키: 인벤토리 토글
    this.input.keyboard!.on('keydown-V', () => this.inventoryUI.toggle());
    // E키: 장비 패널 토글
    this.input.keyboard!.on('keydown-E', () => this.equipmentPanel.toggle());

    // 피격 플래시 콜백 등록
    gs.combat.setHitFlashCallback(() => {
      this.hitFlash.setVisible(true).setAlpha(0.35);
      this.tweens.add({
        targets: this.hitFlash,
        alpha: 0,
        duration: 300,
        onComplete: () => this.hitFlash.setVisible(false),
      });
    });
  }

  update() {
    const gs = this.scene.get('GameScene') as unknown as GameSceneRef;
    if (!gs) return;

    const s = gs.survival;
    const c = gs.charStats;
    const BAR_W = 90;

    // 시간 & 맵 & 날씨
    const weatherIcon = gs.weather.getWeatherIcon();
    this.hudTimeText.setText(`${gs.gameTime.toString()}  ${weatherIcon}`);
    this.hudInfoText.setText(`Seed: ${gs.seed}   Map (${gs.mapX},${gs.mapY})`);

    // 스탯 바
    this.hudStatBars.hp.fill.setSize(BAR_W * (s.hp / s.maxHp), 7);
    this.hudStatBars.hunger.fill.setSize(BAR_W * (s.hunger / 100), 7);
    this.hudStatBars.fatigue.fill.setSize(BAR_W * (s.fatigue / 100), 7);
    this.hudStatBars.action.fill.setSize(BAR_W * (s.action / 100), 7);

    this.hudStatBars.hp.label.setText(`HP ${Math.ceil(s.hp)}/${s.maxHp}`);
    this.hudStatBars.hunger.label.setText('Hunger');
    this.hudStatBars.fatigue.label.setText('Fatigue');
    this.hudStatBars.action.label.setText('Action');

    // 캐릭터 스탯
    this.hudCharStats.setText(
      `STR:${c.str}  AGI:${c.agi}  CON:${c.con}  INT:${c.int}` +
      (s.isFrenzy ? '   \u26a0 FRENZY' : '') +
      (s.isForcedSleep ? '   \ud83d\udca4 SLEEP' : ''),
    );

    // 인벤토리 요약
    const inv = gs.inventory.getAll()
      .map(st => `${st.key.replace('item_', '')}: ${st.count}`)
      .join('  ');
    this.hudInventoryText.setText(inv || '(인벤토리 비어있음)');

    // 야간 오버레이
    this.nightOverlay.setAlpha(gs.gameTime.nightOverlay.alpha);

    // 광기 오버레이
    if (s.isFrenzy) {
      const pulse = 0.15 + Math.abs(Math.sin(this.time.now * 0.005)) * 0.1;
      this.frenzyOverlay.setAlpha(pulse);
    } else {
      this.frenzyOverlay.setAlpha(0);
    }

    // 인벤토리 UI 업데이트 (무기 HUD 포함)
    this.inventoryUI.update();
    this.equipmentPanel.update();
  }

  shutdown() {
    this.inventoryUI?.destroy();
    this.equipmentPanel?.destroy();
  }
}
