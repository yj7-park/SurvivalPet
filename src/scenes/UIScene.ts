import Phaser from 'phaser';
import { InventoryUI } from '../systems/InventoryUI';
import { EquipmentPanel } from '../systems/EquipmentPanel';
import { UIRenderer } from '../ui/UIRenderer';
import { UI_COLORS } from '../config/uiColors';

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
  soundSystem: import('../systems/SoundSystem').SoundSystem;
  sitSystem: import('../systems/SitSystem').SitSystem;
  tutorialSystem: import('../systems/TutorialSystem').TutorialSystem;
  lightSystem: import('../systems/LightSystem').LightSystem;
  playerIsIndoor: boolean;
  isMultiplayer: boolean;
  seed: string;
  mapX: number;
  mapY: number;
  isNearTable(): boolean;
  farmingSystem?: { getHarvestableCount(): number };
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
  private hudGaugeGfx!: Phaser.GameObjects.Graphics;
  private hudGaugeValues = { hp: 0, maxHp: 1, hunger: 0, fatigue: 0, action: 0 };
  private hudFrenzyCountdown!: Phaser.GameObjects.Text;
  private hudCharStats!: Phaser.GameObjects.Text;
  private hudInventoryText!: Phaser.GameObjects.Text;
  private hudPlayerCount!: Phaser.GameObjects.Text;
  private hudPoisonIcon!: Phaser.GameObjects.Text;
  private hudSitStatus!: Phaser.GameObjects.Text;
  private hudWeatherTooltip!: Phaser.GameObjects.Text;
  private hudHarvestBadge!: Phaser.GameObjects.Text;
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

    // 날씨 툴팁 (hudTimeText 호버 시 표시)
    this.hudWeatherTooltip = this.add.text(8, 52, '', {
      fontSize: '10px', color: '#aaddff', fontFamily: 'monospace',
      backgroundColor: '#000000bb', padding: { x: 5, y: 3 },
      wordWrap: { width: 220 },
    }).setDepth(101).setVisible(false);

    this.hudTimeText.setInteractive({ useHandCursor: false });
    this.hudTimeText.on('pointerover', () => { this.hudWeatherTooltip.setVisible(true); });
    this.hudTimeText.on('pointerout',  () => { this.hudWeatherTooltip.setVisible(false); });

    // ── 우상단: 스탯 바 ──────────────────────────────────────
    const BAR_W = 90, BAR_H = 7;
    const bx = W - 110, by0 = 12;

    // Graphics-based improved gauges
    this.hudGaugeGfx = this.add.graphics().setDepth(102).setScrollFactor(0);

    const makebar = (y: number, color: number, labelStr: string) => {
      const bg   = this.add.rectangle(bx, y, BAR_W, BAR_H, 0x222222, 0).setDepth(100).setOrigin(0, 0.5);
      const fill = this.add.rectangle(bx, y, BAR_W, BAR_H, color, 0).setDepth(101).setOrigin(0, 0.5);
      const lbl  = this.add.text(bx - 52, y - 4, labelStr, {
        fontSize: '9px', color: UI_COLORS.textSecondary, fontFamily: 'Courier New',
      }).setDepth(100);
      return { bg, fill, label: lbl };
    };

    this.hudStatBars = {
      hp:      makebar(by0,      UI_COLORS.gaugeHpHex,      'HP'),
      hunger:  makebar(by0 + 14, UI_COLORS.gaugeHungerHex,  'Hunger'),
      fatigue: makebar(by0 + 28, UI_COLORS.gaugeFatigueHex, 'Fatigue'),
      action:  makebar(by0 + 42, UI_COLORS.gaugeActionHex,  'Action'),
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

    // 수확 가능 작물 뱃지 (우상단 미니맵 근처)
    this.hudHarvestBadge = this.add.text(W - 8, 72, '', {
      fontSize: '10px', color: '#1a1008', fontFamily: 'monospace',
      backgroundColor: '#d4b030', padding: { x: 5, y: 2 },
    }).setDepth(100).setOrigin(1, 0).setVisible(false);

    // 앉기 상태 아이콘 (우하단)
    this.hudSitStatus = this.add.text(W - 8, H - 8, '🪑 휴식 중  피로 +0.2/분', {
      fontSize: '10px', color: '#aabbcc', fontFamily: 'monospace',
      backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setDepth(100).setOrigin(1, 1).setVisible(false);

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
      {
        getTorchRemaining: () => gs.lightSystem?.getTorchRemaining() ?? 0,
        onEquipTorch: () => {
          const result = gs.equipmentSystem.equipTorch(gs.inventory);
          if (result.ok) gs.lightSystem?.equipTorch();
        },
        onUnequipTorch: () => {
          gs.lightSystem?.unequipTorch();
          gs.equipmentSystem.unequipTorch(gs.inventory, true);
        },
      },
    );

    // Tutorial event callbacks
    this.inventoryUI.setOnOpen(() => gs.tutorialSystem?.onEvent('inventory_opened'));
    this.inventoryUI.setOnEat(() => gs.tutorialSystem?.onEvent('food_eaten'));
    // Eat visual feedback
    this.inventoryUI.setOnEatFeedback((hunger, hp, poisoned) => {
      const fullGs = this.scene.get('GameScene') as unknown as {
        player: { sprite: { x: number; y: number } };
        feedbackRenderer?: { playEatEffect: (x: number, y: number, h: number) => void; playHealEffect: (x: number, y: number, a: number) => void; playFoodPoisonEffect: (x: number, y: number) => void };
      };
      const px = fullGs.player?.sprite?.x ?? 0;
      const py = fullGs.player?.sprite?.y ?? 0;
      if (poisoned) {
        fullGs.feedbackRenderer?.playFoodPoisonEffect(px, py);
      } else {
        if (hunger > 0) fullGs.feedbackRenderer?.playEatEffect(px, py, hunger);
        if (hp > 0)     fullGs.feedbackRenderer?.playHealEffect(px, py, hp);
      }
    });
    // Tool/seed use callback → delegate to GameScene
    this.inventoryUI.setOnToolUse((itemId) => (gs as unknown as { handleToolUse: (id: string) => void }).handleToolUse?.(itemId));

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

    // 날씨 툴팁 업데이트
    const isIndoor = gs.playerIsIndoor ?? false;
    const tooltip = gs.weather.effectSystem.getTooltip(isIndoor);
    if (tooltip) {
      this.hudWeatherTooltip.setText(`${weatherIcon} ${gs.weather.getWeather()}\n${tooltip}`);
    } else {
      this.hudWeatherTooltip.setVisible(false);
    }

    // 허기 게이지 색상 (정상→배고픔→허기→굶주림)
    const hv = s.hunger;
    const hungerColor = hv > 40 ? UI_COLORS.gaugeHungerHex : hv > 20 ? 0xe0c020 : hv > 10 ? 0xe07010 : 0xe03030;
    // 굶주림 단계 깜빡임 — gaugeGfx로 처리하므로 fill visibility 활용 안함
    const hungerVisible = !(hv <= 10 && hv > 0 && Math.floor(this.time.now / 300) % 2 === 1);

    // 식중독 아이콘
    const isPoisoned = gs.hungerSystem?.isPoisoned() ?? false;
    this.hudPoisonIcon.setVisible(isPoisoned);

    // 행복 수치 게이지 색상 (정상→주의→경고→위험)
    const av = s.action;
    const actionColor = av > 40 ? UI_COLORS.gaugeActionHex : av > 20 ? 0xe0c020 : av > 10 ? 0xe06020 : 0xe03030;
    // 광란 시 action 깜빡임
    const actionVisible = !(s.isFrenzy && Math.floor(this.time.now / 300) % 2 === 1);

    // HP 게이지 색 (저체력 시 밝게)
    const hpRatio = s.hp / s.maxHp;
    const hpColor = hpRatio <= 0.2 ? UI_COLORS.gaugeHpHex : UI_COLORS.gaugeHpHex;

    // Graphics 기반 게이지 다시 그리기
    const W2 = this.scale.width;
    const bx2 = W2 - 110, by02 = 12;
    this.hudGaugeGfx.clear();
    // Panel background
    UIRenderer.drawPanel(this.hudGaugeGfx, bx2 - 58, by02 - 8, 162, 68);
    // Gauges
    UIRenderer.drawGauge(this.hudGaugeGfx, bx2, by02,      s.hp,     s.maxHp, hpColor,      BAR_W, 7);
    if (hungerVisible)
      UIRenderer.drawGauge(this.hudGaugeGfx, bx2, by02 + 14, s.hunger, 100,    hungerColor,  BAR_W, 7);
    UIRenderer.drawGauge(this.hudGaugeGfx, bx2, by02 + 28,  s.fatigue, 100,   UI_COLORS.gaugeFatigueHex, BAR_W, 7);
    if (actionVisible)
      UIRenderer.drawGauge(this.hudGaugeGfx, bx2, by02 + 42, s.action,  100,   actionColor,  BAR_W, 7);

    // 광란 진입/종료 알림
    if (s.isFrenzy && !this.prevFrenzy) {
      this.showFrenzyEntryEffect();
      gs.soundSystem?.play('frenzy_start');
    } else if (!s.isFrenzy && this.prevFrenzy) {
      this.showNoticeText('광란 상태가 해제되었습니다', '#aaffaa');
      gs.soundSystem?.play('frenzy_end');
    }
    this.prevFrenzy = s.isFrenzy;

    // 광란 카운트다운
    if (s.isFrenzy) {
      const sec = Math.ceil(s.frenzyTimer / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      this.hudFrenzyCountdown.setText(`⚡ 광란  [${mm}:${ss}]`).setVisible(true);
    } else {
      this.hudFrenzyCountdown.setVisible(false);
    }

    const debuff = gs.hungerSystem?.getMaxHpDebuff() ?? 0;
    const baseMaxHp = gs.charStats.maxHp;
    const hpLabel = debuff > 0
      ? `HP ${Math.ceil(s.hp)}/${s.maxHp} (↓${debuff})`
      : `HP ${Math.ceil(s.hp)}/${s.maxHp}`;
    this.hudStatBars.hp.label.setText(hpLabel).setColor(hpRatio <= 0.2 ? UI_COLORS.textDanger : UI_COLORS.textSecondary);
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

    // 야간 오버레이 (LightSystem이 GameScene에서 처리하므로 비활성화)
    this.nightOverlay.setAlpha(0);

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

    // 앉기 상태 아이콘
    this.hudSitStatus.setVisible(gs.sitSystem?.isSitting() ?? false);

    // 수확 가능 작물 뱃지
    const harvestCount = gs.farmingSystem?.getHarvestableCount() ?? 0;
    if (harvestCount > 0) {
      this.hudHarvestBadge.setText(`🌾 ${harvestCount}`).setVisible(true);
    } else {
      this.hudHarvestBadge.setVisible(false);
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
