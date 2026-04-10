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
  multiplayerSys: import('../systems/MultiplayerSystem').MultiplayerSystem;
  hungerSystem: import('../systems/HungerSystem').HungerSystem;
  isMultiplayer: boolean;
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
  private hudFrenzyCountdown!: Phaser.GameObjects.Text;
  private hudCharStats!: Phaser.GameObjects.Text;
  private hudInventoryText!: Phaser.GameObjects.Text;
  private hudPlayerCount!: Phaser.GameObjects.Text;
  private hudPoisonIcon!: Phaser.GameObjects.Text;
  private prevFrenzy = false;

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

    // 멀티플레이 접속자 수 (우상단, 스탯 바 아래)
    this.hudPlayerCount = this.add.text(W - 110, by0 + 58, '', {
      fontSize: '10px', color: '#7ab', fontFamily: 'monospace',
      backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setDepth(100).setVisible(false);

    // 광란 카운트다운 텍스트 (우상단)
    this.hudFrenzyCountdown = this.add.text(W - 110, by0 + 72, '', {
      fontSize: '12px', color: '#ff4444', fontFamily: 'monospace',
      fontStyle: 'bold', backgroundColor: '#00000099', padding: { x: 5, y: 2 },
    }).setDepth(100).setVisible(false);

    // 식중독 아이콘 (허기 바 오른쪽)
    this.hudPoisonIcon = this.add.text(W - 16, by0 + 14, '🤢', {
      fontSize: '11px', fontFamily: 'monospace',
    }).setDepth(102).setOrigin(1, 0.5).setVisible(false);

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
      gs.proficiency,
      gs.hungerSystem,
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

    // 허기 게이지 색상 (정상→배고픔→허기→굶주림)
    const hv = s.hunger;
    const hungerColor = hv > 40 ? 0xe0a020 : hv > 20 ? 0xe0c020 : hv > 10 ? 0xe07010 : 0xe03030;
    this.hudStatBars.hunger.fill.setFillStyle(hungerColor);
    // 굶주림 단계 깜빡임
    if (hv <= 10 && hv > 0) {
      const blinkH = Math.floor(this.time.now / 300) % 2 === 0;
      this.hudStatBars.hunger.fill.setVisible(blinkH);
    } else {
      this.hudStatBars.hunger.fill.setVisible(true);
    }

    // 식중독 아이콘
    const isPoisoned = gs.hungerSystem?.isPoisoned() ?? false;
    this.hudPoisonIcon.setVisible(isPoisoned);

    // 행복 수치 게이지 색상 (정상→주의→경고→위험)
    const av = s.action;
    const actionColor = av > 40 ? 0x40c060 : av > 20 ? 0xe0c020 : av > 10 ? 0xe06020 : 0xe03030;
    this.hudStatBars.action.fill.setFillStyle(actionColor);

    // 광란 진입/종료 알림
    if (s.isFrenzy && !this.prevFrenzy) {
      this.showFrenzyEntryEffect();
    } else if (!s.isFrenzy && this.prevFrenzy) {
      this.showNoticeText('광란 상태가 해제되었습니다', '#aaffaa');
    }
    this.prevFrenzy = s.isFrenzy;

    // 광란 카운트다운
    if (s.isFrenzy) {
      const sec = Math.ceil(s.frenzyTimer / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      this.hudFrenzyCountdown.setText(`⚡ 광란  [${mm}:${ss}]`).setVisible(true);
      // 게이지 깜빡임
      const blink = Math.floor(this.time.now / 300) % 2 === 0;
      this.hudStatBars.action.fill.setVisible(blink);
    } else {
      this.hudFrenzyCountdown.setVisible(false);
      this.hudStatBars.action.fill.setVisible(true);
    }

    const debuff = gs.hungerSystem?.getMaxHpDebuff() ?? 0;
    const baseMaxHp = gs.charStats.maxHp;
    const hpLabel = debuff > 0
      ? `HP ${Math.ceil(s.hp)}/${s.maxHp} (↓${debuff})`
      : `HP ${Math.ceil(s.hp)}/${s.maxHp}`;
    this.hudStatBars.hp.label.setText(hpLabel);
    void baseMaxHp;
    this.hudStatBars.hunger.label.setText('Hunger');
    this.hudStatBars.fatigue.label.setText('Fatigue');
    this.hudStatBars.action.label.setText('Action');

    // 캐릭터 스탯
    this.hudCharStats.setText(
      `STR:${c.str}  AGI:${c.agi}  CON:${c.con}  INT:${c.int}` +
      (s.isFrenzy ? '   \u26a0 FRENZY' : '') +
      (s.isForcedSleep ? '   \ud83d\udca4 SLEEP' : '') +
      ((gs.hungerSystem?.isPoisoned()) ? '   🤢 POISON' : ''),
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

    // 멀티플레이 접속자 수
    if (gs.isMultiplayer) {
      const total = gs.multiplayerSys.getAllRemotePlayers().length + 1;
      this.hudPlayerCount.setText(`🌐 ${total}명 접속 중`).setVisible(true);
    } else {
      this.hudPlayerCount.setVisible(false);
    }

    // 인벤토리 UI 업데이트 (무기 HUD 포함)
    this.inventoryUI.update();
    this.equipmentPanel.update();
  }

  private showNoticeText(msg: string, color: string): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const txt = this.add.text(W / 2, H / 2 + 40, msg, {
      fontSize: '14px', color, fontFamily: 'monospace',
      backgroundColor: '#00000099', padding: { x: 10, y: 5 },
    }).setDepth(200).setOrigin(0.5);
    this.tweens.add({
      targets: txt,
      alpha: 0,
      duration: 800,
      delay: 1400,
      onComplete: () => txt.destroy(),
    });
  }

  private showFrenzyEntryEffect(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const txt = this.add.text(W / 2, H / 2, '⚡ 광란 상태!', {
      fontSize: '24px', color: '#ff3333', fontFamily: 'monospace',
      fontStyle: 'bold', backgroundColor: '#00000099', padding: { x: 12, y: 6 },
    }).setDepth(200).setOrigin(0.5);
    this.tweens.add({
      targets: txt,
      alpha: 0,
      duration: 800,
      delay: 600,
      onComplete: () => txt.destroy(),
    });
  }

  shutdown() {
    this.inventoryUI?.destroy();
    this.equipmentPanel?.destroy();
  }
}
