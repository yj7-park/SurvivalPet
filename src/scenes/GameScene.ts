import Phaser from 'phaser';
import { MapGenerator, TileType, TILE_SIZE } from '../world/MapGenerator';
import { Player } from '../entities/Player';
import { CharacterStats } from '../entities/CharacterStats';
import { SurvivalStats } from '../systems/SurvivalStats';
import { GameTime } from '../systems/GameTime';
import { MultiplayerSystem, RemotePlayerState } from '../systems/MultiplayerSystem';
import { PlayerListPanel } from '../ui/PlayerListPanel';
import { MapCache } from '../systems/MapCache';
import { MapTransitionSystem } from '../systems/MapTransitionSystem';
import { MiniMapPanel } from '../ui/MiniMapPanel';
import { registerTextures } from '../world/SpriteGenerator';
import { AnimalManager } from '../systems/AnimalManager';
import { InteractionSystem } from '../systems/InteractionSystem';
import { BuildSystem, BUILD_RANGE, STRUCTURE_DEFS, StructMaterial } from '../systems/BuildSystem';
import { Inventory } from '../systems/Inventory';
import { SeededRandom } from '../utils/seedRandom';
import { CombatSystem } from '../systems/CombatSystem';
import { InventoryUI } from '../systems/InventoryUI';
import { WEAPONS } from '../config/weapons';
import { CommandQueue, Command } from '../systems/CommandQueue';
import { CommandQueueUI } from '../systems/CommandQueueUI';
import { ShelfStorage } from '../systems/ShelfStorage';
import { ShelfUI } from '../systems/ShelfUI';
import { WeatherSystem } from '../systems/WeatherSystem';
import { EffectSystem } from '../systems/EffectSystem';
import { InvasionSystem } from '../systems/InvasionSystem';
import { COOKING_RECIPES, CRAFTING_RECIPES, Recipe } from '../config/recipes';
import { ProficiencySystem, ProficiencyType, PROF_NAMES } from '../systems/ProficiencySystem';
import { ResearchSystem, RESEARCH_DEFS } from '../systems/ResearchSystem';
import { EquipmentSystem } from '../systems/EquipmentSystem';
import { DropSystem } from '../systems/DropSystem';
import { SaveSystem, SaveData } from '../systems/SaveSystem';
import { PauseMenu } from '../ui/PauseMenu';
import { ActionSystem } from '../systems/ActionSystem';
import { DurabilitySystem } from '../systems/DurabilitySystem';
import { HoverTooltip } from '../ui/HoverTooltip';
import { SleepSystem } from '../systems/SleepSystem';
import { SleepOverlay } from '../ui/SleepOverlay';
import { HungerSystem } from '../systems/HungerSystem';
import { HPSystem } from '../systems/HPSystem';
import { DeathScreen } from '../ui/DeathScreen';
import { SoundSystem } from '../systems/SoundSystem';
import { SitSystem } from '../systems/SitSystem';
import { TutorialSystem } from '../systems/TutorialSystem';
import { CheatsheetPanel } from '../ui/CheatsheetPanel';
import { DoorSystem } from '../systems/DoorSystem';
import { RoofSystem } from '../systems/RoofSystem';
import { LightSystem } from '../systems/LightSystem';
import { ChatSystem } from '../systems/ChatSystem';
import { ChatLog } from '../ui/ChatLog';
import { ChatInput } from '../ui/ChatInput';
import { ChatBubbleManager } from '../ui/ChatBubble';

const MAP_W = 100;
const MAP_H = 100;
const TREE_OVERHANG = 16;

function getOrCreatePlayerId(): string {
  let id = localStorage.getItem('survival_player_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 11);
    localStorage.setItem('survival_player_id', id);
  }
  return id;
}

export class GameScene extends Phaser.Scene {
  // public: UIScene reads these directly
  seed!: string;
  mapX = 0;
  mapY = 0;
  charStats!: CharacterStats;
  survival!: SurvivalStats;
  gameTime!: GameTime;
  inventory!: Inventory;
  combat!: CombatSystem;
  weather!: WeatherSystem;

  private tileRT!: Phaser.GameObjects.RenderTexture;
  private mapGenerator!: MapGenerator;
  private player!: Player;
  multiplayerSys!: MultiplayerSystem;
  isMultiplayer = false;
  private playerListPanel!: PlayerListPanel;

  private mapCache = new MapCache();
  private mapTransition!: MapTransitionSystem;
  private miniMap!: MiniMapPanel;
  private visitedMaps = new Set<string>();
  private killedEnemiesAll = new Set<string>(); // all killed enemy IDs across maps
  private currentTiles: TileType[][] = [];

  // World-space only: follows player
  private sleepText!: Phaser.GameObjects.Text;

  // Systems
  private animalMgr!: AnimalManager;
  private interaction!: InteractionSystem;
  private buildSystem!: BuildSystem;
  private effects!: EffectSystem;
  private invasion!: InvasionSystem;
  private buildPanel: HTMLDivElement | null = null;
  private frenzyDamageTimer = 0;
  private commandQueue!: CommandQueue;
  private commandQueueUI!: CommandQueueUI;

  private workbenchPanel: HTMLDivElement | null = null;
  private kitchenPanel: HTMLDivElement | null = null;
  private contextMenu: HTMLDivElement | null = null;

  // 숙련도 & 연구
  proficiency!: ProficiencySystem;
  research!: ResearchSystem;
  equipmentSystem!: EquipmentSystem;
  private dropSystem!: DropSystem;
  private workbenchPos: { wx: number; wy: number } | null = null;

  // 요리 진행 상태
  private cookingRecipe: Recipe | null = null;
  private cookingTimer: Phaser.Time.TimerEvent | null = null;
  private cookingKitchenPos: { wx: number; wy: number } | null = null;
  private cookingStartTime = 0;
  private cookingDuration = 0;

  // Shelf storage
  private shelfStorages = new Map<string, ShelfStorage>();
  private shelfUI!: ShelfUI;

  // 저장/불러오기
  private saveSystem = new SaveSystem();
  private pauseMenu!: PauseMenu;
  private pendingSaveData: SaveData | null = null;
  private pendingCharStats?: { str: number; agi: number; con: number; int: number };
  private pendingAppearance = 0;
  private characterName = '생존자';
  private playtimeMs = 0;
  private autoSaveTimer = 0;
  private readonly AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000;
  private beforeUnloadHandler!: () => void;

  // 채굴된 암반 추적
  private clearedRocks: { tx: number; ty: number }[] = [];

  // 내구도 & 수리
  private durabilitySystem = new DurabilitySystem();
  private hoverTooltip!: HoverTooltip;
  private isRepairing = false;

  // 수면 시스템
  private sleepSystem = new SleepSystem();
  private sleepOverlay!: SleepOverlay;
  // 피로 경고 추적 (한 번만 표시)
  private fatigueWarnedAt40 = false;
  private fatigueWarnedAt20 = false;

  // 허기 시스템
  hungerSystem = new HungerSystem();
  // 허기 경고 추적 (한 번만 표시)
  private hungerWarnedAt40 = false;
  private hungerWarnedAt20 = false;
  private hungerWarnedAt10 = false;

  // HP 시스템 (자연 회복, 사망)
  private hpSystem = new HPSystem();
  private deathScreen!: DeathScreen;
  private isDead = false;
  // 게임 통계
  private enemiesKilled = 0;
  private buildingsBuilt = 0;

  // 사운드 시스템
  soundSystem = new SoundSystem();
  private bgmUpdateTimer = 0;
  private readonly BGM_UPDATE_INTERVAL = 30_000; // 30초마다 BGM 갱신

  // 튜토리얼 & 조작 가이드
  tutorialSystem = new TutorialSystem();
  private cheatsheetPanel = new CheatsheetPanel();

  // 행복 수치 & 광란
  private actionSystem = new ActionSystem();
  private frenzyAura!: Phaser.GameObjects.Arc;
  private frenzyRng!: SeededRandom;
  // 건설 자동이동
  private buildAutoMoveTarget: { worldX: number; worldY: number } | null = null;
  private pendingBuild: { defName: string; material: StructMaterial; tileX: number; tileY: number } | null = null;

  // Click-to-move target
  private moveTarget: { worldX: number; worldY: number } | null = null;
  private moveTargetCommand: Command | null = null;
  private pendingGroundPickup: string | null = null; // ground item id to pick up on arrival

  // Tree regeneration
  private clearedTrees: { tx: number; ty: number; regrowAt: number }[] = [];
  private readonly TREE_REGROW_MS = 10 * 60 * 1000; // 10 real minutes

  // 의자 앉기 시스템
  sitSystem = new SitSystem();
  // 식탁 보너스 아이콘 (world-space)
  private tableBonusText!: Phaser.GameObjects.Text;

  // 문 & 실내/실외 시스템
  private doorSystem = new DoorSystem();
  private roofSystem = new RoofSystem();
  private playerIsIndoor = false;
  private lastIndoorTileX = -1;
  private lastIndoorTileY = -1;
  private doorHintText!: Phaser.GameObjects.Text;

  // 조명 시스템
  lightSystem!: LightSystem;
  private torchWarnedOnce = false;

  // 채팅 시스템 (멀티플레이 전용)
  private chatSystem = new ChatSystem();
  private chatLog!: ChatLog;
  private chatInput!: ChatInput;
  private chatBubbles!: ChatBubbleManager;
  private prevFrenzyForChat = false;

  // Individual tree sprites for depth sorting
  private treeSprites = new Map<string, Phaser.GameObjects.Image>();

  // Other players
  private remotePlayerDisplays = new Map<string, {
    sprite: Phaser.GameObjects.Sprite;
    nameLabel: Phaser.GameObjects.Text;
    statusLabel: Phaser.GameObjects.Text;
  }>();

  constructor() { super({ key: 'GameScene' }); }

  init(data: {
    seed: string;
    saveData?: SaveData;
    characterName?: string;
    appearance?: number;
    characterStats?: { str: number; agi: number; con: number; int: number };
    saveSlot?: number;
    isMultiplayer?: boolean;
  }) {
    this.seed = data.seed;
    this.pendingSaveData = data.saveData ?? null;
    if (data.saveData) {
      this.mapX = data.saveData.character.mapX;
      this.mapY = data.saveData.character.mapY;
      this.playtimeMs = data.saveData.playtime;
      this.pendingCharStats = data.saveData.character.stats;
      this.pendingAppearance = data.saveData.character.appearance ?? 0;
      this.characterName = data.saveData.character.name ?? '생존자';
    } else {
      this.mapX = 0;
      this.mapY = 0;
      this.playtimeMs = 0;
      this.pendingCharStats = data.characterStats;
      this.pendingAppearance = data.appearance ?? 0;
      this.characterName = data.characterName ?? '생존자';
    }
    if (data.saveSlot !== undefined) {
      this.saveSystem.setLastUsedSlot(data.saveSlot);
    }
    this.isMultiplayer = data.isMultiplayer ?? false;
    this.autoSaveTimer = 0;
    this.clearedTrees = [];
    this.clearedRocks = [];
  }

  create() {
    registerTextures(this);

    const playerId = getOrCreatePlayerId();
    this.charStats = new CharacterStats(this.seed, playerId, this.pendingCharStats);
    this.survival = new SurvivalStats(this.charStats);
    this.gameTime = new GameTime();
    this.weather = new WeatherSystem(this, this.gameTime, this.seed);

    this.mapGenerator = new MapGenerator(this.seed);
    const startMx = this.mapX, startMy = this.mapY;
    const firstMap = this.mapGenerator.generateMap(startMx, startMy);
    this.currentTiles = firstMap.tiles;
    this.mapCache.set(startMx, startMy, firstMap);
    this.visitedMaps.add(`${startMx},${startMy}`);
    this.loadMap(startMx, startMy);

    const start = this.findStartTile(this.currentTiles);
    this.player = new Player(this, start.x, start.y, this.charStats, this.pendingAppearance);
    this.player.setTiles(this.currentTiles);
    this.player.sprite.setDepth(this.player.sprite.y);

    this.cameras.main.startFollow(this.player.sprite, true);
    this.cameras.main.setZoom(2);

    // 조명 시스템 초기화
    this.lightSystem = new LightSystem(this);
    this.lightSystem.initPlayerBody(this.player.sprite.x, this.player.sprite.y);
    this.lightSystem.setOnTorchExpired(() => {
      this.equipmentSystem?.unequipTorch(this.inventory, false);
      this.showNotificationPopup('횃불이 꺼졌습니다', '#ffaa44');
      this.torchWarnedOnce = false;
    });
    this.lightSystem.setOnTorchWarning(() => {
      this.showNotificationPopup('횃불이 곧 꺼집니다!', '#ffaa44');
      this.torchWarnedOnce = true;
    });

    // 맵 전환 시스템
    this.mapTransition = new MapTransitionSystem(
      this,
      (nmx, nmy, npx, npy) => this.executeMapTransition(nmx, nmy, npx, npy),
      (msg) => this.showNotificationPopup(msg, '#ffaa44'),
    );

    // 미니맵 패널
    this.miniMap = new MiniMapPanel(
      () => ({ mapX: this.mapX, mapY: this.mapY }),
      () => this.visitedMaps,
    );

    // 수면 오버레이
    this.sleepOverlay = new SleepOverlay();

    // 사망 화면
    this.deathScreen = new DeathScreen();

    // 첫 사용자 인터랙션에 AudioContext 초기화 (볼륨 설정 복원 포함)
    const initSound = () => {
      const savedSettings = this.saveSystem.loadSettings();
      void this.soundSystem.init().then(() => {
        this.soundSystem.setMasterVolume(savedSettings.masterVolume ?? 0.7);
        this.soundSystem.setSFXVolume(savedSettings.sfxVolume ?? 0.8);
        this.soundSystem.setBGMVolume(savedSettings.bgmVolume ?? 0.4);
        this.soundSystem.updateBGMByGameTime(this.gameTime, 'normal');
      });
      document.removeEventListener('pointerdown', initSound);
    };
    document.addEventListener('pointerdown', initSound, { once: true });

    // 내구도 호버 툴팁 & 수리
    this.hoverTooltip = new HoverTooltip(
      () => this.inventory,
      () => this.charStats,
    );
    this.hoverTooltip.setRepairCallbacks(
      () => { this.isRepairing = true; },
      (struct, full) => {
        const result = this.durabilitySystem.repair(struct, full, this.inventory, this.charStats);
        this.isRepairing = false;
        if (result.ok) {
          this.showNotificationPopup(`수리 완료 (+${result.recovered})`, '#aaffaa');
          this.proficiency.addXP('building', 8);
        } else if (result.reason === 'insufficient_materials') {
          this.showNotificationPopup('재료가 부족합니다', '#ff8844');
        }
      },
    );

    // 광란 오라 (플레이어 주변 빨간 원)
    this.frenzyAura = this.add.arc(0, 0, 16, 0, 360, false, 0xff2222, 0.5)
      .setDepth(5).setVisible(false);
    this.frenzyRng = new SeededRandom(`${this.seed}_frenzy`);

    this.multiplayerSys = new MultiplayerSystem(this.seed, playerId);
    this.multiplayerSys.setLocalInfo(this.characterName, this.pendingAppearance);

    this.inventory = new Inventory();
    this.animalMgr = new AnimalManager();
    this.buildSystem = new BuildSystem();
    this.buildSystem.init(this);
    this.effects = new EffectSystem(this);
    this.invasion = new InvasionSystem(this, this.gameTime, this.seed, playerId);
    this.commandQueue = new CommandQueue();

    // 건설 완료 시 큐 진행 + XP + 행복
    this.buildSystem.setBuildCompleteCallback((struct) => {
      // 문 & 지붕 시스템 등록
      if (struct.defName === 'door') {
        this.doorSystem.registerDoor(struct.id, struct.tileX, struct.tileY);
      }
      if (struct.defName === 'roof') {
        this.roofSystem.addRoof(struct.tileX, struct.tileY);
      }
      this.proficiency.addXP('building', 15);
      this.actionSystem.onActionDone('build', this.survival);
      this.survival.addFatigue(5); // 건설 피로
      this.survival.hunger = Math.max(0, this.survival.hunger - 3); // 건설 허기
      this.buildingsBuilt++;
      this.tutorialSystem.onEvent('building_built');
      this.soundSystem.play('build_done');
      this.commandQueue.completeCommand();
      this.processNextQueueCommand();
      if (this.isMultiplayer && struct) {
        const fbId = this.multiplayerSys.uploadBuildingAdded({
          type: struct.defName, mapX: this.mapX, mapY: this.mapY,
          tileX: struct.tileX, tileY: struct.tileY,
          durability: struct.durability, material: struct.material, builtBy: playerId,
        });
        if (fbId) this.buildSystem.setFirebaseId(struct.tileX, struct.tileY, fbId);
      }
    });
    this.buildSystem.setDemolishCompleteCallback((info) => {
      // 문 & 지붕 시스템 해제
      const demolishId = this.buildSystem.tileKey(info.tileX, info.tileY);
      if (info.defName === 'door') this.doorSystem.unregisterDoor(demolishId);
      if (info.defName === 'roof') this.roofSystem.removeRoof(info.tileX, info.tileY);
      this.proficiency.addXP('building', 8);
      this.actionSystem.onActionDone('demolish', this.survival);
      if (this.isMultiplayer && info.firebaseId) {
        this.multiplayerSys.uploadBuildingRemoved(info.firebaseId);
      }
    });
    this.commandQueueUI = new CommandQueueUI(this.commandQueue);
    this.shelfUI = new ShelfUI();
    this.proficiency = new ProficiencySystem();
    this.research = new ResearchSystem();

    // 레벨업 팝업
    this.proficiency.setOnLevelUp((type, lvl) => {
      this.showLevelUpPopup(type, lvl);
      this.soundSystem.play('levelup');
    });

    const playerRng = new SeededRandom(`${this.seed}_drops_${playerId}`);
    this.interaction = new InteractionSystem(
      this, this.player, this.charStats, this.survival,
      this.inventory, this.animalMgr, playerRng,
      (tx, ty) => this.clearTile(tx, ty),
    );
    this.interaction.setTiles(this.currentTiles);
    this.interaction.setOnInteractionComplete(() => {
      this.commandQueue.completeCommand();
      this.processNextQueueCommand();
    });
    this.interaction.setOnResourceGathered((type) => {
      const xpMap: Record<string, number> = { woodcutting: 8, mining: 8, fishing: 10 };
      this.proficiency.addXP(type as ProficiencyType, xpMap[type] ?? 8);
      const actionMap: Record<string, import('../systems/ActionSystem').ActionType> = {
        woodcutting: 'woodcut', mining: 'mine', fishing: 'fish',
      };
      if (actionMap[type]) this.actionSystem.onActionDone(actionMap[type], this.survival);
      // 활동별 피로 소모
      const fatigueMap: Record<string, number> = { woodcutting: 3, mining: 4, fishing: 1 };
      if (fatigueMap[type]) this.survival.addFatigue(fatigueMap[type]);
      // 활동별 허기 소모
      const hungerMap: Record<string, number> = { woodcutting: 3, mining: 4 };
      if (hungerMap[type]) this.survival.hunger = Math.max(0, this.survival.hunger - hungerMap[type]);
      // SFX
      const sfxMap: Record<string, import('../systems/SoundSystem').SoundId> = {
        woodcutting: 'woodcut_done', mining: 'mine_done', fishing: 'fish_success',
      };
      if (sfxMap[type]) this.soundSystem.play(sfxMap[type]);
      if (type === 'fishing') this.tutorialSystem.onEvent('fish_completed');
    });

    // Spawn animals on current map
    this.animalMgr.spawnForMap(this.seed, 0, 0, this.currentTiles, this, new Set());

    // Combat system — must come after player, charStats, survival, inventory, animalMgr
    const playerRng2 = new SeededRandom(`${this.seed}_combat_${playerId}`);
    this.combat = new CombatSystem(
      this, this.player, this.charStats, this.survival, this.inventory, this.animalMgr, playerRng2,
    );
    this.combat.setEffectSystem(this.effects);

    this.equipmentSystem = new EquipmentSystem();
    this.combat.setEquipmentSystem(this.equipmentSystem, this.proficiency);

    this.dropSystem = new DropSystem(this);
    this.combat.setOnAnimalKillCallback((x, y, animalType) => {
      const seed = `${this.seed}_drop_${x}_${y}_${Date.now()}`;
      this.dropSystem.spawnDrops(animalType, x, y, seed);
    });

    // 전투 종료 시 큐 진행
    this.combat.setCombatEndCallback(() => {
      this.commandQueue.completeCommand();
      this.processNextQueueCommand();
    });
    this.combat.setOnKillCallback(() => {
      this.proficiency.addXP('combat', 20);
      this.actionSystem.onActionDone('kill_enemy', this.survival);
      this.survival.addFatigue(2); // 전투 피로
      this.survival.hunger = Math.max(0, this.survival.hunger - 1); // 전투 허기
      this.enemiesKilled++;
      this.soundSystem.play('enemy_die');
    });

    // 피격 시 HPSystem 타이머 리셋, 앉기 중단
    this.combat.setOnPlayerHitCallback((dmg) => {
      this.hpSystem.onHit();
      this.soundSystem.play('player_hit', { pitch: 0.9 + Math.random() * 0.2 });
      if (this.sitSystem.isSitting()) this.sitSystem.stopSitting();
      void dmg;
    });

    // Pointer events — use ptr.worldX/worldY (Phaser applies camera matrix correctly)
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      const wx = ptr.worldX;
      const wy = ptr.worldY;
      // For fixed-position HTML tooltip, use clientX/Y (CSS pixels, not canvas pixels)
      const sx = (ptr.event as MouseEvent).clientX ?? ptr.x;
      const sy = (ptr.event as MouseEvent).clientY ?? ptr.y;
      this.interaction.onPointerMove(wx, wy, sx, sy);

      if (this.buildSystem.activeDef) {
        const tx = Math.floor(wx / TILE_SIZE);
        const ty = Math.floor(wy / TILE_SIZE);
        const canPlace = this.buildSystem.canPlace(this.buildSystem.activeDef.name, tx, ty, this.currentTiles);
        this.buildSystem.updatePreview(tx, ty, canPlace);
      }

      // 구조물 호버 시 내구도 툴팁
      if (!this.buildSystem.activeDef && !this.hoverTooltip.isRepairing()) {
        const tx = Math.floor(wx / TILE_SIZE);
        const ty = Math.floor(wy / TILE_SIZE);
        const hStruct = this.buildSystem.getAt(tx, ty);
        if (hStruct) {
          this.hoverTooltip.showStructTooltip(hStruct, sx, sy);
        } else {
          this.hoverTooltip.hideTooltip();
        }
      }
    });

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const wx = ptr.worldX;
      const wy = ptr.worldY;
      const isShiftHeld = (ptr.event as MouseEvent)?.shiftKey ?? false;

      if (ptr.rightButtonDown()) {
        this.buildSystem.exitBuildMode();
        this.closeBuildPanel();
        this.combat.unlock();
        // 완공 구조물 또는 중단된 건축 위 우클릭 → 수리 패널 or 컨텍스트 팝업
        const rtx = Math.floor(wx / TILE_SIZE);
        const rty = Math.floor(wy / TILE_SIZE);
        const rStruct = this.buildSystem.getAt(rtx, rty);
        const rPartial = this.buildSystem.getPartialAt(rtx, rty);
        if (rStruct && !rPartial) {
          const dist = Math.hypot(
            this.player.sprite.x - (rtx * TILE_SIZE + TILE_SIZE / 2),
            this.player.sprite.y - (rty * TILE_SIZE + TILE_SIZE / 2),
          );
          if (dist <= BUILD_RANGE * 2) {
            this.hoverTooltip.hideTooltip();
            this.hoverTooltip.openRepairPanel(rStruct);
          } else {
            const sx = (ptr.event as MouseEvent).clientX ?? ptr.x;
            const sy = (ptr.event as MouseEvent).clientY ?? ptr.y;
            this.showBuildContextMenu(sx, sy, rtx, rty, false);
          }
        } else if (rPartial) {
          const sx = (ptr.event as MouseEvent).clientX ?? ptr.x;
          const sy = (ptr.event as MouseEvent).clientY ?? ptr.y;
          this.showBuildContextMenu(sx, sy, rtx, rty, true);
        }
        return;
      }

      if (this.buildSystem.activeDef) {
        const tx = Math.floor(wx / TILE_SIZE);
        const ty = Math.floor(wy / TILE_SIZE);
        if (this.buildSystem.canPlace(this.buildSystem.activeDef.name, tx, ty, this.currentTiles)) {
          const twx = tx * TILE_SIZE + TILE_SIZE / 2;
          const twy = ty * TILE_SIZE + TILE_SIZE / 2;
          const dist = Math.hypot(this.player.sprite.x - twx, this.player.sprite.y - twy);

          if (isShiftHeld) {
            // 큐에 건설 명령 추가
            const buildCmd: Command = {
              id: '',
              type: 'build',
              targetX: tx,
              targetY: ty,
              data: {
                defName: this.buildSystem.activeDef.name,
                material: this.buildSystem.activeMaterial,
              },
            };
            if (!this.commandQueue.add(buildCmd)) {
              console.warn('큐가 가득 찼습니다');
            }
          } else if (dist <= BUILD_RANGE) {
            this.buildSystem.startBuild(
              this.buildSystem.activeDef.name,
              this.buildSystem.activeMaterial,
              tx, ty, this.charStats, this.inventory,
              this.proficiency.getSpeedMultiplier('building'),
            );
          } else {
            // 자동이동 후 건설
            this.buildAutoMoveTarget = { worldX: twx, worldY: twy };
            this.pendingBuild = {
              defName: this.buildSystem.activeDef.name,
              material: this.buildSystem.activeMaterial,
              tileX: tx, tileY: ty,
            };
          }
        }
        return;
      }

      // If Shift not held, clear queue and unlock
      if (!isShiftHeld) {
        this.commandQueue.clearAll();
        this.combat.unlock();
      }

      // Check for ground item click — pick up or walk to
      const groundItem = this.dropSystem.getItemAtClick(wx, wy);
      if (groundItem) {
        const dist = Math.hypot(this.player.sprite.x - groundItem.x, this.player.sprite.y - groundItem.y);
        if (dist <= 48) {
          const result = this.dropSystem.pickup(groundItem.id, this.inventory, this.player.sprite.x, this.player.sprite.y);
          if (result.ok) {
            this.showNotificationPopup(`+${result.item.amount} ${result.item.itemId.replace('item_', '')}`, '#aaffaa');
            this.soundSystem.play('item_pickup', { pitch: 0.9 + Math.random() * 0.2 });
          } else if (result.reason === 'inventory_full') {
            this.showNotificationPopup('인벤토리가 가득 찼습니다', '#ff8888');
          }
        } else {
          // Walk toward item and pick up on arrival
          this.moveTarget = { worldX: groundItem.x, worldY: groundItem.y };
          this.pendingGroundPickup = groundItem.id;
        }
        return;
      }

      // Check for animal click — lock on via CombatSystem
      const animal = this.animalMgr.getHovered(wx, wy);
      if (animal) {
        this.spawnClickFeedback(animal.x, animal.y, '#ff4444');

        if (isShiftHeld) {
          // Add attack command to queue
          const cmd: Command = { id: '', type: 'attack', targetId: animal.id };
          if (!this.commandQueue.add(cmd)) {
            console.warn('큐가 가득 찼습니다');
          }
        } else {
          this.combat.lockOn(animal);
        }
        return;
      }

      // Check for structure interaction (workbench, shelf, etc)
      const clickedStructure = this.buildSystem.getAt(
        Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE),
      );
      if (clickedStructure?.defName === 'workbench') {
        const wbX = clickedStructure.tileX * TILE_SIZE + TILE_SIZE / 2;
        const wbY = clickedStructure.tileY * TILE_SIZE + TILE_SIZE / 2;
        const wbDist = Math.hypot(this.player.sprite.x - wbX, this.player.sprite.y - wbY);
        if (wbDist <= BUILD_RANGE) {
          this.workbenchPos = { wx: wbX, wy: wbY };
          this.toggleWorkbenchPanel();
        } else {
          this.buildAutoMoveTarget = { worldX: wbX, worldY: wbY };
          this.pendingBuild = { defName: '__open_workbench__', material: 'wood', tileX: clickedStructure.tileX, tileY: clickedStructure.tileY };
        }
        return;
      }
      if (clickedStructure?.defName === 'kitchen') {
        const kX = clickedStructure.tileX * TILE_SIZE + TILE_SIZE / 2;
        const kY = clickedStructure.tileY * TILE_SIZE + TILE_SIZE / 2;
        const kDist = Math.hypot(this.player.sprite.x - kX, this.player.sprite.y - kY);
        if (kDist <= BUILD_RANGE) {
          this.toggleKitchenPanel(kX, kY);
        } else {
          this.buildAutoMoveTarget = { worldX: kX, worldY: kY };
          this.pendingBuild = { defName: '__open_kitchen__', material: 'wood', tileX: clickedStructure.tileX, tileY: clickedStructure.tileY };
        }
        return;
      }
      if (clickedStructure?.defName === 'door') {
        const doorX = clickedStructure.tileX * TILE_SIZE + TILE_SIZE / 2;
        const doorY = clickedStructure.tileY * TILE_SIZE + TILE_SIZE / 2;
        const doorDist = Math.hypot(this.player.sprite.x - doorX, this.player.sprite.y - doorY);
        if (doorDist <= BUILD_RANGE * 1.5) {
          this.toggleDoor(clickedStructure.id, clickedStructure.material);
        } else {
          this.moveTarget = { worldX: doorX, worldY: doorY };
        }
        return;
      }
      if (clickedStructure?.defName === 'bed') {
        const bedX = clickedStructure.tileX * TILE_SIZE + TILE_SIZE / 2;
        const bedY = clickedStructure.tileY * TILE_SIZE + TILE_SIZE / 2;
        const bedDist = Math.hypot(this.player.sprite.x - bedX, this.player.sprite.y - bedY);
        if (bedDist <= BUILD_RANGE) {
          this.tryStartSleep(clickedStructure.material, clickedStructure.tileX, clickedStructure.tileY);
        } else {
          this.moveTarget = { worldX: bedX, worldY: bedY };
        }
        return;
      }
      if (clickedStructure?.defName === 'chair') {
        const chairWx = clickedStructure.tileX * TILE_SIZE + TILE_SIZE / 2;
        const chairWy = clickedStructure.tileY * TILE_SIZE + TILE_SIZE / 2;
        const chairDist = Math.hypot(this.player.sprite.x - chairWx, this.player.sprite.y - chairWy);
        if (chairDist <= BUILD_RANGE) {
          if (this.survival.isFrenzy) {
            this.showNotificationPopup('광란 상태에서는 앉을 수 없습니다', '#ff8888');
          } else if (this.survival.fatigue >= 95) {
            this.showNotificationPopup('이미 충분히 쉬었습니다', '#aabbcc');
          } else {
            const chairType = `chair_${clickedStructure.material}`;
            this.sitSystem.startSitting(chairType);
            this.showNotificationPopup('🪑 휴식 중...', '#aabbcc');
          }
        } else {
          this.moveTarget = { worldX: chairWx, worldY: chairWy };
        }
        return;
      }
      if (clickedStructure?.defName === 'shelf') {
        const shelfId = clickedStructure.id;
        let shelfStorage = this.shelfStorages.get(shelfId);
        if (!shelfStorage) {
          shelfStorage = new ShelfStorage();
          this.shelfStorages.set(shelfId, shelfStorage);
        }

        const shelfWx = clickedStructure.tileX * TILE_SIZE + TILE_SIZE / 2;
        const shelfWy = clickedStructure.tileY * TILE_SIZE + TILE_SIZE / 2;

        this.shelfUI.open(
          this,
          shelfId,
          shelfStorage,
          this.inventory,
          this.player.sprite.x,
          this.player.sprite.y,
          shelfWx,
          shelfWy,
        );
        return;
      }

      // Check for Dirt tile click — move to position
      const tx = Math.floor(wx / TILE_SIZE);
      const ty = Math.floor(wy / TILE_SIZE);
      if (tx >= 0 && tx < 100 && ty >= 0 && ty < 100) {
        const tileType = this.currentTiles[ty]?.[tx];
        if (tileType === TileType.Dirt) {
          const targetWx = tx * TILE_SIZE + TILE_SIZE / 2;
          const targetWy = ty * TILE_SIZE + TILE_SIZE / 2;
          this.spawnClickFeedback(targetWx, targetWy, '#ffffff');

          if (isShiftHeld) {
            // Add move command to queue
            const moveCmd: Command = { id: '', type: 'move', targetX: tx, targetY: ty };
            if (!this.commandQueue.add(moveCmd)) {
              console.warn('큐가 가득 찼습니다');
            }
          } else {
            // Direct move to position
            const moveCmd: Command = { id: '', type: 'move', targetX: tx, targetY: ty };
            this.executeImmediateMove(moveCmd);
          }
          return;
        }
      }

      // Tile interaction - pass shift flag to interaction system
      const tx2 = Math.floor(wx / TILE_SIZE);
      const ty2 = Math.floor(wy / TILE_SIZE);
      if (tx2 >= 0 && tx2 < 100 && ty2 >= 0 && ty2 < 100) {
        const tileType2 = this.currentTiles[ty2]?.[tx2];
        if (tileType2 === TileType.Tree || tileType2 === TileType.Rock || tileType2 === TileType.Water) {
          const feedbackWx = tx2 * TILE_SIZE + TILE_SIZE / 2;
          const feedbackWy = ty2 * TILE_SIZE + TILE_SIZE / 2;
          this.spawnClickFeedback(feedbackWx, feedbackWy, '#ffdd00');
        }
      }
      this.interaction.onPointerDown(wx, wy, isShiftHeld, this.commandQueue);
    });

    // Sleep text — world-space, follows player
    this.sleepText = this.add.text(0, -28, 'Z Z Z', {
      fontSize: '10px', color: '#aaddff', fontFamily: 'monospace',
      backgroundColor: '#00000066', padding: { x: 3, y: 1 },
    }).setDepth(10).setVisible(false);

    // Table bonus text — world-space, shown above nearest table when player is near
    this.tableBonusText = this.add.text(0, 0, '🍽 +30% 식사 효율', {
      fontSize: '10px', color: '#ffe080', fontFamily: 'monospace',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setDepth(200).setVisible(false).setOrigin(0.5, 1);

    // Door hint — fixed screen-space hint (bottom center)
    this.doorHintText = this.add.text(this.scale.width / 2, this.scale.height - 32, '[E] 문 열기/닫기', {
      fontSize: '12px', color: '#ffe8a0', fontFamily: 'monospace',
      backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(500).setOrigin(0.5).setVisible(false);

    // Player building collision
    this.player.setBuildingPassCallback((tx, ty) => this.buildSystem.isPassable(tx, ty));
    // Door system callback for BuildSystem
    this.buildSystem.setDoorOpenCallback((id) => this.doorSystem.isOpen(id));

    // Zoom wheel
    this.input.on('wheel', (_: unknown, __: unknown, ___: unknown, deltaY: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.5, 4));
    });

    // Direction keys: clear queue on keyboard movement
    this.input.keyboard!.on('keydown-UP', () => { if (this.chatSystem.isInputActive()) return; this.commandQueue.clearAll(); });
    this.input.keyboard!.on('keydown-DOWN', () => { if (this.chatSystem.isInputActive()) return; this.commandQueue.clearAll(); });
    this.input.keyboard!.on('keydown-LEFT', () => { if (this.chatSystem.isInputActive()) return; this.commandQueue.clearAll(); });
    this.input.keyboard!.on('keydown-RIGHT', () => { if (this.chatSystem.isInputActive()) return; this.commandQueue.clearAll(); });

    // E key: interact with nearest door
    this.input.keyboard!.on('keydown-E', () => {
      if (this.chatSystem.isInputActive()) return;
      const nearest = this.doorSystem.getNearestInRange(this.player.sprite.x, this.player.sprite.y);
      if (nearest) {
        const struct = this.buildSystem.getAt(
          Math.floor((nearest.door.buildingId.split(',')[0] as unknown as number)),
          Math.floor((nearest.door.buildingId.split(',')[1] as unknown as number)),
        );
        if (struct) this.toggleDoor(struct.id, struct.material);
      }
    });

    // B key: toggle build panel
    this.input.keyboard!.on('keydown-B', () => { if (this.chatSystem.isInputActive()) return; this.toggleBuildPanel(); });

    // M key: toggle minimap
    this.input.keyboard!.on('keydown-M', () => { if (this.chatSystem.isInputActive()) return; this.miniMap.toggle(); });

    // H key: toggle cheatsheet
    this.input.keyboard!.on('keydown-H', () => { if (this.chatSystem.isInputActive()) return; this.cheatsheetPanel.toggle(); });

    // V key: toggle inventory (handled by UIScene keyboard listener)

    // ESC: exit build mode, cancel interaction, close panels, unlock target, clear queue
    this.input.keyboard!.on('keydown-ESC', () => {
      // 채팅 입력 중이면 입력창만 닫고 ESC 메뉴 열지 않음
      if (this.chatSystem.isInputActive()) {
        this.chatInput.close();
        return;
      }
      this.buildSystem.exitBuildMode();
      this.buildSystem.cancelBuild();
      this.buildAutoMoveTarget = null;
      this.pendingBuild = null;
      this.closeBuildPanel();
      this.closeWorkbenchPanel();
      this.closeKitchenPanel();
      this.closeContextMenu();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.scene.get('UIScene') as any)?.inventoryUI?.close();
      this.interaction.cancelOnMove();
      this.combat.unlock();
      this.commandQueue.clearAll();
      // 아무것도 열려있지 않으면 일시정지 메뉴 토글
      this.pauseMenu?.toggle();
    });

    // 채팅 UI 초기화 (멀티플레이 전용: 싱글플레이에서는 disable)
    this.chatLog = new ChatLog(this);
    this.chatInput = new ChatInput();
    this.chatBubbles = new ChatBubbleManager(this);
    if (!this.isMultiplayer) {
      this.chatSystem.disable();
    }
    this.chatInput.onSend((text) => {
      const ok = this.chatSystem.send(text, getOrCreatePlayerId(), this.characterName);
      if (!ok && this.chatSystem.isDisabled() === false) {
        this.showNotificationPopup('메시지를 너무 빠르게 보내고 있습니다', '#ffaa44');
      }
    });
    this.chatInput.onClose(() => this.chatSystem.closeInput());
    this.chatSystem.onInputActiveChanged((active) => {
      if (active) this.chatLog.showFull();
    });

    // Enter key: open chat input (multiplayer only)
    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.chatSystem.isDisabled()) return;
      if (this.chatSystem.isInputActive()) return;
      this.chatSystem.openInput();
      this.chatInput.open();
    });

    // Launch UI scene (zoom-independent HUD)
    this.scene.launch('UIScene');

    // PauseMenu
    this.pauseMenu = new PauseMenu(
      this.saveSystem,
      () => this.collectSaveData(),
      (saveData) => {
        this.scene.stop('UIScene');
        this.scene.restart({ seed: saveData.seed, saveData });
      },
      () => {
        void this.multiplayerSys.leaveRoom();
        this.scene.stop('UIScene');
        this.scene.start('TitleScene');
      },
      this.isMultiplayer,
    );

    // beforeunload 자동 저장
    this.beforeUnloadHandler = () => {
      if (!this.isMultiplayer) this.saveSystem.saveAuto(this.collectSaveData());
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    this.preloadAdjacentMaps();

    // 불러오기 복원
    if (this.pendingSaveData) {
      this.restoreFromSaveData(this.pendingSaveData);
      this.pendingSaveData = null;
    }

    // 멀티플레이어 초기화
    if (this.isMultiplayer) {
      void this.initMultiplayer(playerId);
    }
  }

  private async initMultiplayer(playerId: string): Promise<void> {
    this.multiplayerSys.onPlayersChanged((players) => this.updateOtherPlayers(players));
    this.multiplayerSys.onBuildingAdded((entry) => {
      if (entry.mapX !== this.mapX || entry.mapY !== this.mapY) return;
      if (!this.buildSystem.getAt(entry.tileX, entry.tileY)) {
        this.buildSystem.addRemote(entry);
      } else {
        this.buildSystem.setFirebaseId(entry.tileX, entry.tileY, entry.id);
      }
    });
    this.multiplayerSys.onBuildingRemoved((_id, mapX, mapY, tileX, tileY) => {
      if (mapX !== this.mapX || mapY !== this.mapY) return;
      this.buildSystem.removeStructureAt(tileX, tileY);
    });
    this.multiplayerSys.onTreeCut((mapX, mapY, tileX, tileY) => {
      if (mapX !== this.mapX || mapY !== this.mapY) return;
      if (this.currentTiles[tileY]?.[tileX] !== undefined) {
        this.clearTile(tileX, tileY);
      }
    });
    this.multiplayerSys.onRockMined((mapX, mapY, tileX, tileY) => {
      if (mapX !== this.mapX || mapY !== this.mapY) return;
      if (this.currentTiles[tileY]?.[tileX] !== undefined) {
        this.clearTile(tileX, tileY);
      }
    });

    await this.multiplayerSys.joinRoom({
      name: this.characterName, skin: this.pendingAppearance,
      x: this.player.sprite.x, y: this.player.sprite.y,
      mapX: this.mapX, mapY: this.mapY,
      hp: this.survival.hp, hunger: this.survival.hunger, fatigue: this.survival.fatigue,
      facing: this.player.dir, weapon: null,
    });

    // 채팅 시스템 초기화
    const { initFirebase } = await import('../config/firebase');
    const db = initFirebase();
    this.chatSystem.init(this.seed, db);
    this.chatSystem.onMessageReceived((msg) => {
      // 로컬 플레이어 외 플레이어 말풍선
      if (msg.type === 'user' && msg.playerId !== getOrCreatePlayerId()) {
        const disp = this.remotePlayerDisplays.get(msg.playerId);
        if (disp) {
          this.chatBubbles.showBubble(msg.playerId, msg.text, disp.sprite.x, disp.sprite.y, disp.sprite.depth);
        }
      }
      // 로컬 플레이어 말풍선
      if (msg.type === 'user' && msg.playerId === getOrCreatePlayerId()) {
        this.chatBubbles.showBubble(msg.playerId, msg.text, this.player.sprite.x, this.player.sprite.y, 2);
      }
    });

    this.playerListPanel = new PlayerListPanel(
      this.multiplayerSys,
      this.characterName,
      () => this.survival.hp,
      () => this.survival.hunger,
    );
    this.input.keyboard!.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.playerListPanel.toggle();
    });
    this.input.keyboard!.on('keyup-TAB', () => {
      // Keep open until toggle
    });

    // 신규 플레이어 튜토리얼
    if (!TutorialSystem.isDone()) {
      this.tutorialSystem.start(this.makeTutorialState());
    }

    // 개발 모드 FPS/메모리 모니터
    if (import.meta.env.DEV) {
      const fpsText = this.add.text(8, 8, '', {
        fontSize: '11px', color: '#00ff00', fontFamily: 'monospace',
        backgroundColor: '#00000088', padding: { x: 4, y: 2 },
      }).setScrollFactor(0).setDepth(9999);
      this.events.on('postupdate', () => {
        const fps = Math.round(this.game.loop.actualFps);
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        const memMb = mem ? Math.round(mem.usedJSHeapSize / 1024 / 1024) : -1;
        const objs = this.children.length;
        fpsText.setText(`FPS:${fps}  MEM:${memMb >= 0 ? memMb + 'MB' : '–'}  OBJ:${objs}`);
        if (memMb >= 300) {
          console.warn(`[Performance] Memory usage high: ${memMb}MB`);
        }
      });
    }
  }

  update(time: number, delta: number) {
    this.playtimeMs += delta;

    // 자동 저장 (5분마다)
    this.autoSaveTimer += delta;
    if (this.autoSaveTimer >= this.AUTO_SAVE_INTERVAL_MS) {
      this.autoSaveTimer = 0;
      const result = this.saveSystem.saveAuto(this.collectSaveData());
      this.showNotificationPopup(result.ok ? '💾 자동 저장됨' : '⚠ 자동 저장 실패', result.ok ? '#ffffff' : '#ffaa44');
    }

    // 수면 시스템: 시간 가속 및 피로 회복
    const effectiveDelta = this.sleepSystem.update(delta, this.survival, this.gameTime);
    this.gameTime.update(effectiveDelta);
    this.survival.update(effectiveDelta);
    this.hungerSystem.update(effectiveDelta, this.survival, this.charStats);
    this.hpSystem.update(effectiveDelta, this.survival, this.charStats, this.hungerSystem);

    // BGM 갱신 (30초마다)
    this.bgmUpdateTimer += delta;
    if (this.bgmUpdateTimer >= this.BGM_UPDATE_INTERVAL) {
      this.bgmUpdateTimer = 0;
      const situation = this.survival.isFrenzy ? 'frenzy' : 'normal';
      this.soundSystem.updateBGMByGameTime(this.gameTime, situation);
    }

    // 수면 중 BGM 무음
    if (this.sleepSystem.isSleeping()) {
      this.soundSystem.silenceBGM();
    }

    // 사망 감지
    if (!this.isDead && this.survival.hp <= 0) {
      this.isDead = true;
      this.triggerDeath();
    }

    if (this.sleepOverlay.isVisible()) {
      this.sleepOverlay.update(this.survival, this.gameTime);
    }

    // 강제 수면 감지 (피로 0 → 강제 수면)
    if (this.survival.fatigue === 0 && !this.sleepSystem.isSleeping()) {
      this.showNotificationPopup('극도로 피곤합니다... 쓰러집니다', '#ffaa44');
      this.time.delayedCall(1000, () => {
        if (!this.sleepSystem.isSleeping()) {
          this.sleepSystem.startForcedSleep((reason) => this.onWake(reason));
          this.sleepOverlay.show(this.survival, this.gameTime, () => this.sleepSystem.wakeUp('user'));
        }
      });
    }

    // 피로 경고 단계
    if (this.survival.fatigue <= 40 && this.survival.fatigue > 20 && !this.fatigueWarnedAt40) {
      this.fatigueWarnedAt40 = true;
      this.showNotificationPopup('😪 피곤합니다. 수면이 필요합니다', '#ffee44');
    } else if (this.survival.fatigue > 40) {
      this.fatigueWarnedAt40 = false;
    }
    if (this.survival.fatigue <= 20 && this.survival.fatigue > 0 && !this.fatigueWarnedAt20) {
      this.fatigueWarnedAt20 = true;
      this.showNotificationPopup('😵 극도로 피곤합니다!', '#ff8844');
    } else if (this.survival.fatigue > 20) {
      this.fatigueWarnedAt20 = false;
    }

    // 허기 경고 단계
    if (this.survival.hunger <= 40 && this.survival.hunger > 20 && !this.hungerWarnedAt40) {
      this.hungerWarnedAt40 = true;
      this.showNotificationPopup('🍖 배가 고픕니다', '#ffee44');
    } else if (this.survival.hunger > 40) {
      this.hungerWarnedAt40 = false;
    }
    if (this.survival.hunger <= 20 && this.survival.hunger > 10 && !this.hungerWarnedAt20) {
      this.hungerWarnedAt20 = true;
      this.showNotificationPopup('🍖 매우 배가 고픕니다!', '#ff8844');
    } else if (this.survival.hunger > 20) {
      this.hungerWarnedAt20 = false;
    }
    if (this.survival.hunger <= 10 && this.survival.hunger > 0 && !this.hungerWarnedAt10) {
      this.hungerWarnedAt10 = true;
      this.showNotificationPopup('🍖 굶주리고 있습니다!', '#ff4444');
    } else if (this.survival.hunger > 10) {
      this.hungerWarnedAt10 = false;
    }
    if (this.survival.hunger === 0 && this.hungerSystem.getMaxHpDebuff() > 0
      && Math.floor(this.gameTime.getElapsed() / 75000) !== Math.floor((this.gameTime.getElapsed() - effectiveDelta) / 75000)) {
      this.showNotificationPopup('💀 굶주림으로 최대 체력이 줄어들고 있습니다', '#cc2222');
    }

    // 수면 중 허기 0 → 강제 기상
    if (this.sleepSystem.isSleeping() && this.survival.hunger === 0) {
      this.sleepSystem.interruptByStarving();
    }
    this.weather.update(delta);
    this.invasion.update(delta);
    this.dropSystem.update(delta, this.player.sprite.x, this.player.sprite.y, this.inventory);
    this.shelfUI.updatePlayerPosition(this.player.sprite.x, this.player.sprite.y);
    this.buildSystem.update(delta, this.survival, this.player.sprite.x, this.player.sprite.y);

    // 내구도 자연 노후화 + 수리 진행
    const decayDestroyed = this.durabilitySystem.update(delta, this.buildSystem.getAllStructures(), this.getRoofedTiles());
    for (const tileKey of decayDestroyed) {
      const [dtx, dty] = tileKey.split(',').map(Number);
      this.destroyStructure(dtx, dty, '노후화로 구조물이 무너졌습니다');
    }
    if (this.hoverTooltip.updateRepair(delta)) {
      // repair completed — already handled via callback
    }
    // 수리 중 이동하면 취소
    if (this.player.isMovingByKeyboard() && this.isRepairing) {
      this.hoverTooltip.cancelRepairOnMove();
      this.isRepairing = false;
    }

    // 연구 업데이트 및 작업대 이탈 감지
    const completedResearch = this.research.update(delta);
    if (completedResearch) {
      this.proficiency.unlockByResearch(completedResearch.id);
      this.actionSystem.onActionDone('research', this.survival);
      this.showNotificationPopup(`✅ ${completedResearch.label.replace('🔬 ', '')} 연구 완료!`, '#88ffaa');
      if (this.workbenchPanel) this.refreshWorkbenchPanel(this.workbenchPanel, 'research');
    }
    if (this.research.isInProgress()) {
      const wpos = this.research.getWorkbenchPos();
      if (wpos) {
        const wDist = Math.hypot(this.player.sprite.x - wpos.x, this.player.sprite.y - wpos.y);
        if (wDist > BUILD_RANGE) {
          this.research.cancelResearch();
          this.showNotificationPopup('연구가 중단되었습니다', '#ff8888');
          if (this.workbenchPanel) this.refreshWorkbenchPanel(this.workbenchPanel, 'research');
        } else if (this.workbenchPanel) {
          this.updateResearchProgressBar(this.workbenchPanel);
        }
      }
    }

    // 요리 중 거리 이탈 감지
    if (this.cookingRecipe && this.cookingKitchenPos) {
      const kDist = Math.hypot(
        this.player.sprite.x - this.cookingKitchenPos.wx,
        this.player.sprite.y - this.cookingKitchenPos.wy,
      );
      if (kDist > BUILD_RANGE) {
        this.cancelCooking();
      } else {
        this.updateKitchenProgressBar();
      }
    }

    // 광란 자동 공격 (1.5초 간격)
    if (this.survival.isFrenzy) {
      this.frenzyDamageTimer -= delta;
      if (this.frenzyDamageTimer <= 0) {
        this.frenzyDamageTimer = 1500;
        this.doFrenzyAttack();
      }
      // 광란 오라 펄스
      if (this.frenzyAura) {
        const pulse = 0.3 + Math.abs(Math.sin(this.time.now * 0.008)) * 0.3;
        this.frenzyAura
          .setVisible(true)
          .setAlpha(pulse)
          .setPosition(this.player.sprite.x, this.player.sprite.y);
      }
    } else {
      this.frenzyDamageTimer = 0;
      this.frenzyAura?.setVisible(false);
    }

    // 행복 수치 경고
    this.actionSystem.checkWarnings(this.survival.action, (msg, color) => {
      this.showNotificationPopup(msg, color);
    });

    // Combat update (lock-on, projectiles, damage floats)
    this.combat.update(delta);

    // ── 이동키 입력 처리 ─────────────────────────────────────
    // 락온 중 이동키 → 추적 해제(락온 유지), 채굴/건설 취소
    const lockTarget = this.combat.getLockedTarget();
    if (!this.survival.isIncapacitated && this.player.isMovingByKeyboard()) {
      if (lockTarget && this.combat.tracking) this.combat.stopTracking();
      this.interaction.cancelOnMove();
      this.buildAutoMoveTarget = null;
      this.pendingBuild = null;
      this.buildSystem.pauseBuild(); // 진행 상태 저장 (취소 X)
      this.moveTarget = null;
      this.moveTargetCommand = null;
      if (this.sitSystem.isSitting()) this.sitSystem.stopSitting();
      this.pendingGroundPickup = null;
    }

    // ── 자동이동: 클릭 이동 ──────────────────────────────────
    if (this.moveTarget && !this.survival.isIncapacitated) {
      const dx = this.moveTarget.worldX - this.player.sprite.x;
      const dy = this.moveTarget.worldY - this.player.sprite.y;
      const dist = Math.hypot(dx, dy);
      const MOVE_TOLERANCE = 4; // pixels

      if (dist <= MOVE_TOLERANCE) {
        // Reached destination
        if (this.moveTargetCommand) {
          this.commandQueue.completeCommand();
          this.processNextQueueCommand();
        }
        if (this.pendingGroundPickup) {
          const result = this.dropSystem.pickup(this.pendingGroundPickup, this.inventory, this.player.sprite.x, this.player.sprite.y);
          if (result.ok) {
            this.showNotificationPopup(`+${result.item.amount} ${result.item.itemId.replace('item_', '')}`, '#aaffaa');
          } else if (result.reason === 'inventory_full') {
            this.showNotificationPopup('인벤토리가 가득 찼습니다', '#ff8888');
          }
          this.pendingGroundPickup = null;
        }
        this.moveTarget = null;
        this.moveTargetCommand = null;
      } else {
        const step = this.charStats.moveSpeed * (delta / 1000);
        this.player.moveWithCollision((dx / dist) * step, (dy / dist) * step);
      }
    }

    // ── 자동이동: 추적 모드 (타일 충돌 적용) ────────────────
    if (lockTarget && this.combat.tracking && !this.survival.isIncapacitated) {
      const weapon = this.combat.equippedWeapon;
      const rangePx = (weapon?.rangeTiles ?? 1) * TILE_SIZE;
      const ldx = lockTarget.x - this.player.sprite.x;
      const ldy = lockTarget.y - this.player.sprite.y;
      const ldist = Math.hypot(ldx, ldy);
      if (ldist > rangePx) {
        const step = this.charStats.moveSpeed * (delta / 1000);
        this.player.moveWithCollision((ldx / ldist) * step, (ldy / ldist) * step);
      }
    }

    // ── 자동이동: 건설 ───────────────────────────────────────
    if (this.buildAutoMoveTarget && !this.survival.isIncapacitated) {
      const dx = this.buildAutoMoveTarget.worldX - this.player.sprite.x;
      const dy = this.buildAutoMoveTarget.worldY - this.player.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= BUILD_RANGE) {
        if (this.pendingBuild) {
          const { defName, material, tileX, tileY } = this.pendingBuild;
          if (defName === '__demolish__') {
            this.buildSystem.startDemolish(tileX, tileY, this.charStats, this.inventory);
          } else if (defName === '__open_workbench__') {
            const owX = tileX * TILE_SIZE + TILE_SIZE / 2;
            const owY = tileY * TILE_SIZE + TILE_SIZE / 2;
            this.openWorkbenchPanel(owX, owY);
          } else if (defName === '__open_kitchen__') {
            const kX = tileX * TILE_SIZE + TILE_SIZE / 2;
            const kY = tileY * TILE_SIZE + TILE_SIZE / 2;
            this.openKitchenPanel(kX, kY);
          } else {
            this.buildSystem.startBuild(defName, material, tileX, tileY, this.charStats, this.inventory,
              this.proficiency.getSpeedMultiplier('building'));
          }
        }
        this.buildAutoMoveTarget = null;
        this.pendingBuild = null;
      } else {
        const step = this.charStats.moveSpeed * (delta / 1000);
        this.player.moveWithCollision((dx / dist) * step, (dy / dist) * step);
      }
    }

    // ── 자동이동: 상호작용 (타일 충돌 적용) ─────────────────
    const autoTarget = this.interaction.getAutoMoveTarget();
    if (autoTarget && !this.survival.isIncapacitated) {
      const dx = autoTarget.worldX - this.player.sprite.x;
      const dy = autoTarget.worldY - this.player.sprite.y;
      const dist = Math.hypot(dx, dy);
      const step = this.charStats.moveSpeed * (delta / 1000);
      if (dist > step) {
        this.player.moveWithCollision((dx / dist) * step, (dy / dist) * step);
      } else {
        this.player.sprite.setPosition(autoTarget.worldX, autoTarget.worldY);
      }
    }

    // 추적 모드 중에는 키보드 억제, 수동 사냥 모드에서는 자유 이동
    const suppressKeys = this.survival.isIncapacitated
      || autoTarget !== null
      || (lockTarget !== null && this.combat.tracking)
      || this.buildAutoMoveTarget !== null
      || this.mapTransition?.isTransitioning
      || this.isRepairing
      || this.sleepSystem.isSleeping()
      || this.chatSystem.isInputActive();

    this.player.update(delta, suppressKeys, this.survival.fatigueSpeedMult * this.survival.hungerSpeedMult);
    this.interaction.update(delta);

    // ── 실내/실외 상태 갱신 (타일 변화 시에만) ───────────────
    {
      const ptx = Math.floor(this.player.sprite.x / TILE_SIZE);
      const pty = Math.floor(this.player.sprite.y / TILE_SIZE);
      if (ptx !== this.lastIndoorTileX || pty !== this.lastIndoorTileY) {
        this.lastIndoorTileX = ptx;
        this.lastIndoorTileY = pty;
        this.playerIsIndoor = this.roofSystem.isCovered(ptx, pty);
      }
    }

    // ── 문 근처 힌트 표시 ─────────────────────────────────────
    this.doorHintText.setVisible(
      this.doorSystem.hasDoorNearby(this.player.sprite.x, this.player.sprite.y),
    );

    // ── 깊이 정렬: Y 좌표 기반으로 캐릭터가 나무 뒤/앞에 표시되도록 ───
    // 나무 depth = (tileY+1)*TILE_SIZE, 플레이어 depth = sprite.y (같은 좌표계)
    this.player.sprite.setDepth(this.player.sprite.y);

    // ── 동물 AI 업데이트 + 피격 처리 ────────────────────────
    this.animalMgr.update(delta, this.player.sprite.x, this.player.sprite.y, (dmg) => {
      this.combat.onPlayerHit(dmg);
      // 공격받으면 채굴/벌목 즉시 취소
      this.interaction.cancelOnMove();
      this.buildAutoMoveTarget = null;
      this.pendingBuild = null;
      this.buildSystem.cancelBuild();
      // 수면 중 피격 → 강제 기상
      this.sleepSystem.interruptByHit();
    });

    // ── 나무 재생 ──────────────────────────────────────────
    if (this.clearedTrees.length > 0) {
      const now = Date.now();
      this.clearedTrees = this.clearedTrees.filter(entry => {
        if (now >= entry.regrowAt) {
          this.restoreTreeWithAnimation(entry.tx, entry.ty);
          return false;
        }
        return true;
      });
    }

    // ── SitSystem 업데이트 ────────────────────────────────
    this.sitSystem.update(delta, this.survival, this.playerIsIndoor);

    // Sleep text: world-space, follows player
    if (this.survival.isForcedSleep) {
      this.sleepText.setVisible(true)
        .setPosition(this.player.sprite.x - 12, this.player.sprite.y - 30);
    } else {
      this.sleepText.setVisible(false);
    }

    // ── 식탁 보너스 아이콘 ────────────────────────────────────
    const nearTable = this.findNearbyTable();
    if (nearTable) {
      const tx = nearTable.tileX * TILE_SIZE + TILE_SIZE / 2;
      const ty = nearTable.tileY * TILE_SIZE;
      this.tableBonusText.setVisible(true).setPosition(tx, ty);
    } else {
      this.tableBonusText.setVisible(false);
    }

    // ── 튜토리얼 업데이트 ─────────────────────────────────
    if (this.tutorialSystem.isActive()) {
      this.tutorialSystem.update(this.makeTutorialState());
    }

    this.mapTransition.check(this.player.sprite.x, this.player.sprite.y, this.mapX, this.mapY);
    this.miniMap.update(delta);

    // 조명 시스템 업데이트
    const gameHour = this.gameTime.hour + this.gameTime.minute / 60;
    this.lightSystem?.update(
      delta, gameHour,
      this.player.sprite.x, this.player.sprite.y,
      this.cameras.main, time,
      this.playerIsIndoor,
    );
    if (this.isMultiplayer) {
      const isMoving = this.player.isMovingByKeyboard() || this.combat.tracking;
      this.multiplayerSys.uploadState(
        time,
        this.player.sprite.x, this.player.sprite.y,
        this.mapX, this.mapY,
        this.player.dir, isMoving,
        this.survival.hp, this.survival.hunger, this.survival.fatigue,
        this.survival.isFrenzy, null,
      );
      this.multiplayerSys.update(delta);

      // 광란 진입 시스템 메시지
      if (this.survival.isFrenzy && !this.prevFrenzyForChat) {
        this.multiplayerSys.sendSystemMessage(`⚡ ${this.characterName}님이 광란 상태에 돌입했습니다!`);
      }
      this.prevFrenzyForChat = this.survival.isFrenzy;
    }

    // 채팅 업데이트
    this.chatSystem.update(delta);
    this.chatBubbles.update(delta);

    // 말풍선 위치 갱신 (로컬 플레이어)
    this.chatBubbles.updateBubblePosition(getOrCreatePlayerId(), this.player.sprite.x, this.player.sprite.y);

    // 채팅 로그 렌더링
    if (!this.chatSystem.isDisabled()) {
      if (this.chatLog.isHovered()) this.chatSystem.pauseFade();
      this.chatLog.render(this.chatSystem.getMessages());
    }
  }

  spawnClickFeedback(wx: number, wy: number, color: string): void {
    const ring = this.add.circle(wx, wy, 4, undefined);
    const colorNum = parseInt(color.slice(1), 16);
    ring.setStrokeStyle(2, colorNum).setFillStyle(undefined, 0);
    ring.setDepth(2);

    this.tweens.add({
      targets: ring,
      scaleX: 1.0,
      scaleY: 1.0,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private executeImmediateMove(cmd: Command): void {
    if (cmd.targetX !== undefined && cmd.targetY !== undefined) {
      const wx = cmd.targetX * TILE_SIZE + TILE_SIZE / 2;
      const wy = cmd.targetY * TILE_SIZE + TILE_SIZE / 2;
      this.moveTarget = { worldX: wx, worldY: wy };
      this.moveTargetCommand = null;
      this.spawnClickFeedback(wx, wy, '#ffffff');
    }
  }

  private processNextQueueCommand(): void {
    if (!this.commandQueue.hasCommands()) return;
    const nextCmd = this.commandQueue.getNextCommand();
    if (!nextCmd) return;

    switch (nextCmd.type) {
      case 'move': {
        if (nextCmd.targetX !== undefined && nextCmd.targetY !== undefined) {
          const wx = nextCmd.targetX * TILE_SIZE + TILE_SIZE / 2;
          const wy = nextCmd.targetY * TILE_SIZE + TILE_SIZE / 2;
          this.moveTarget = { worldX: wx, worldY: wy };
          this.moveTargetCommand = nextCmd;
        }
        break;
      }
      case 'chop':
      case 'mine':
      case 'fish': {
        if (nextCmd.targetX !== undefined && nextCmd.targetY !== undefined) {
          const wx = nextCmd.targetX * TILE_SIZE + TILE_SIZE / 2;
          const wy = nextCmd.targetY * TILE_SIZE + TILE_SIZE / 2;
          this.interaction.onPointerDown(wx, wy, false);
        }
        break;
      }
      case 'attack': {
        if (nextCmd.targetId) {
          const animal = this.animalMgr.getById(nextCmd.targetId);
          if (animal && !animal.isDead) {
            this.combat.lockOn(animal);
          } else {
            this.commandQueue.failCommand('target_died');
            this.processNextQueueCommand();
          }
        }
        break;
      }
      case 'build': {
        if (nextCmd.targetX !== undefined && nextCmd.targetY !== undefined && nextCmd.data) {
          const defName = nextCmd.data.defName as string;
          const material = nextCmd.data.material as 'wood' | 'stone';
          const tx = nextCmd.targetX;
          const ty = nextCmd.targetY;
          const twx = tx * TILE_SIZE + TILE_SIZE / 2;
          const twy = ty * TILE_SIZE + TILE_SIZE / 2;
          const dist = Math.hypot(this.player.sprite.x - twx, this.player.sprite.y - twy);

          if (dist <= BUILD_RANGE) {
            // 충분히 가깝다면 즉시 건설 시작
            this.buildSystem.startBuild(defName, material, tx, ty, this.charStats, this.inventory,
              this.proficiency.getSpeedMultiplier('building'));
          } else {
            // 자동이동 후 건설
            this.buildAutoMoveTarget = { worldX: twx, worldY: twy };
            this.pendingBuild = { defName, material, tileX: tx, tileY: ty };
          }
        }
        break;
      }
      // TODO: add other command types (craft, cook, sleep)
    }
  }

  shutdown() {
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    this.pauseMenu?.close();
    this.scene.stop('UIScene');
    this.playerListPanel?.destroy();
    this.miniMap?.destroy();
    this.hoverTooltip?.destroy();
    this.sleepOverlay?.destroy();
    this.deathScreen?.destroy();
    void this.multiplayerSys?.leaveRoom();
    this.interaction?.destroy();
    this.animalMgr?.destroyAll();
    this.closeBuildPanel();
    this.closeWorkbenchPanel();
    this.closeKitchenPanel();
    this.combat?.destroy();
    this.commandQueueUI?.destroy();
    this.chatInput?.destroy();
    this.chatBubbles?.destroy();
    this.chatLog?.destroy();
  }

  // ── Map ──────────────────────────────────────────────────

  private loadMap(mx: number, my: number) {
    const mapData = this.mapCache.getOrGenerate(mx, my, this.mapGenerator);
    this.mapCache.delete(mx, my);
    this.currentTiles = mapData.tiles;

    if (this.tileRT) this.tileRT.destroy();
    this.treeSprites.forEach(s => s.destroy());
    this.treeSprites.clear();
    this.tileRT = this.add.renderTexture(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE).setDepth(0).setOrigin(0, 0);
    this.renderTiles(this.currentTiles);

    this.cameras.main.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);

    if (this.player) {
      this.player.setTiles(this.currentTiles);
      this.player.sprite.setDepth(this.player.sprite.y);
    }

    // clear other player sprites on map change
    this.remotePlayerDisplays.forEach(d => { d.sprite.destroy(); d.nameLabel.destroy(); d.statusLabel.destroy(); });
    this.remotePlayerDisplays.clear();
    this.clearedTrees = [];
    this.clearedRocks = [];

    this.interaction?.setTiles(this.currentTiles);
    // Filter killed enemies relevant to this map
    const mapDeadIds = new Set<string>(
      [...this.killedEnemiesAll].filter(id => id.startsWith(`${mx}_${my}_`)),
    );
    this.animalMgr?.spawnForMap(this.seed, mx, my, this.currentTiles, this, mapDeadIds);
    this.buildSystem?.clearAll();
    this.doorSystem?.clear();
    this.roofSystem?.clear();
    this.lastIndoorTileX = -1;
    this.lastIndoorTileY = -1;
    this.playerIsIndoor = false;
  }

  private restoreTree(tx: number, ty: number): void {
    this.currentTiles[ty][tx] = TileType.Tree;
    this.tileRT.draw('tile_dirt', tx * TILE_SIZE, ty * TILE_SIZE);
    this.addTreeSprite(tx, ty);
  }

  private restoreTreeWithAnimation(tx: number, ty: number): void {
    const wx = tx * TILE_SIZE;
    const wy = ty * TILE_SIZE;
    // Show seedling sprite, scale up, then replace with full tree
    const seedling = this.add.image(wx, wy, 'seedling').setOrigin(0, 0).setDepth((ty + 1) * TILE_SIZE).setScale(0);
    this.tweens.add({
      targets: seedling,
      scaleX: 1, scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        seedling.destroy();
        this.restoreTree(tx, ty);
      },
    });
  }

  /** 벌목/채굴 완료 후 타일 한 칸을 Dirt로 교체하고 RT 갱신 */
  private clearTile(tx: number, ty: number): void {
    const originalType = this.currentTiles[ty][tx];
    this.currentTiles[ty][tx] = TileType.Dirt;

    // Track cleared trees for regeneration
    if (originalType === TileType.Tree) {
      this.clearedTrees.push({ tx, ty, regrowAt: Date.now() + this.TREE_REGROW_MS });
      const key = `${tx},${ty}`;
      this.treeSprites.get(key)?.destroy();
      this.treeSprites.delete(key);
      if (this.isMultiplayer) this.multiplayerSys.uploadTreeCut(this.mapX, this.mapY, tx, ty);
    } else if (originalType === TileType.Rock) {
      this.clearedRocks.push({ tx, ty });
      if (this.isMultiplayer) this.multiplayerSys.uploadRockMined(this.mapX, this.mapY, tx, ty);
    }

    // 해당 타일 지면을 dirt로 다시 그림
    this.tileRT.draw('tile_dirt', tx * TILE_SIZE, ty * TILE_SIZE);
  }

  private renderTiles(tiles: TileType[][]) {
    const groundKey: Record<TileType, string> = {
      [TileType.Dirt]:  'tile_dirt',
      [TileType.Water]: 'tile_water',
      [TileType.Rock]:  'tile_rock',
      [TileType.Tree]:  'tile_dirt',
    };

    // Draw ground tiles into RenderTexture (depth 0)
    for (let ty = 0; ty < MAP_H; ty++)
      for (let tx = 0; tx < MAP_W; tx++)
        this.tileRT.draw(groundKey[tiles[ty][tx]], tx * TILE_SIZE, ty * TILE_SIZE);

    // Draw tree canopies as individual sprites for Y-based depth sorting
    for (let ty = 0; ty < MAP_H; ty++)
      for (let tx = 0; tx < MAP_W; tx++)
        if (tiles[ty][tx] === TileType.Tree)
          this.addTreeSprite(tx, ty);
  }

  private addTreeSprite(tx: number, ty: number): void {
    const key = `${tx},${ty}`;
    const img = this.add.image(tx * TILE_SIZE, ty * TILE_SIZE - TREE_OVERHANG, 'obj_tree')
      .setOrigin(0, 0)
      // depth = bottom of tile = (ty+1)*TILE_SIZE so player at same row renders behind it
      .setDepth((ty + 1) * TILE_SIZE);
    this.treeSprites.set(key, img);
  }

  private findStartTile(tiles: TileType[][]): { x: number; y: number } {
    const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2);
    for (let r = 0; r < 30; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = cx + dx, ty = cy + dy;
          if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H && tiles[ty][tx] === TileType.Dirt)
            return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
        }
      }
    }
    return { x: cx * TILE_SIZE + TILE_SIZE / 2, y: cy * TILE_SIZE + TILE_SIZE / 2 };
  }

  /** 지붕 아래 타일 Set 반환 (RoofSystem 위임) */
  private getRoofedTiles(): Set<string> {
    return this.roofSystem.getCoveredSet();
  }

  private executeMapTransition(nmx: number, nmy: number, npx: number, npy: number): void {
    // Save dead enemies for current map before leaving
    for (const id of this.animalMgr.getDeadIds()) {
      this.killedEnemiesAll.add(id);
    }

    this.mapX = nmx;
    this.mapY = nmy;
    this.visitedMaps.add(`${nmx},${nmy}`);
    this.player.sprite.setPosition(npx, npy);
    this.loadMap(nmx, nmy);
    this.preloadAdjacentMaps();

    // Force Firebase position update on map change
    if (this.isMultiplayer) {
      this.multiplayerSys.forceUploadPosition(npx, npy, nmx, nmy, this.player.dir);
    }

    // Auto-save on map transition
    if (!this.isMultiplayer) {
      this.saveSystem.saveAuto(this.collectSaveData());
    }
  }

  private preloadAdjacentMaps() {
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const mx = this.mapX + dx, my = this.mapY + dy;
      this.mapCache.requestGenerate(mx, my, this.mapGenerator, this);
    }
    this.mapCache.evict(this.mapX, this.mapY);
  }

  // ── Multiplayer ──────────────────────────────────────────

  private updateOtherPlayers(players: RemotePlayerState[]) {
    const seen = new Set<string>();
    for (const p of players) {
      if (p.mapX !== this.mapX || p.mapY !== this.mapY) continue;
      seen.add(p.id);
      let display = this.remotePlayerDisplays.get(p.id);
      if (!display) {
        const sprite = this.add.sprite(p.renderX, p.renderY, `char_${p.skin}_${p.facing}`)
          .setDepth(2).setAlpha(0.85);
        const nameLabel = this.add.text(p.renderX, p.renderY - 20, p.name, {
          fontSize: '9px', color: '#fff', fontFamily: 'monospace',
          stroke: '#000', strokeThickness: 2,
        }).setDepth(3).setOrigin(0.5);
        const statusLabel = this.add.text(p.renderX, p.renderY - 12, '', {
          fontSize: '8px', color: '#aaa', fontFamily: 'monospace',
        }).setDepth(3).setOrigin(0.5);
        display = { sprite, nameLabel, statusLabel };
        this.remotePlayerDisplays.set(p.id, display);
      }
      display.sprite.setPosition(p.renderX, p.renderY).setTexture(`char_${p.skin}_${p.facing}`);
      display.nameLabel.setPosition(p.renderX, p.renderY - 20).setText(p.name)
        .setColor(p.frenzy ? '#ff6666' : '#fff');
      display.statusLabel.setPosition(p.renderX, p.renderY - 12)
        .setText(`❤${Math.ceil(p.hp)} 🍖${Math.ceil(p.hunger)}${p.frenzy ? ' ⚡' : ''}`);
      this.chatBubbles?.updateBubblePosition(p.id, p.renderX, p.renderY);
    }
    this.remotePlayerDisplays.forEach((disp, id) => {
      if (!seen.has(id)) {
        disp.sprite.destroy(); disp.nameLabel.destroy(); disp.statusLabel.destroy();
        this.remotePlayerDisplays.delete(id);
      }
    });
  }

  // ── Build Panel ───────────────────────────────────────────

  private toggleBuildPanel(): void {
    if (this.buildPanel) { this.closeBuildPanel(); return; }
    this.openBuildPanel();
  }

  private openBuildPanel(): void {
    const panel = document.createElement('div');
    panel.id = 'build-panel';
    panel.style.cssText = `
      position: fixed; bottom: 60px; right: 10px; width: 240px;
      background: rgba(15,20,30,0.92); border: 1px solid #446;
      border-radius: 6px; padding: 10px; z-index: 200; color: #eee;
      font: 12px monospace;
    `;

    panel.innerHTML = `<div style="font-weight:bold;margin-bottom:8px;color:#e2b96f">🔨 건설</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button id="bp-wood" style="flex:1;padding:4px;background:#a0622a;color:#fff;border:none;border-radius:3px;cursor:pointer">목재</button>
        <button id="bp-stone" style="flex:1;padding:4px;background:#606060;color:#fff;border:none;border-radius:3px;cursor:pointer">석재</button>
      </div>
      <div id="bp-items" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:8px"></div>
      <div id="bp-info" style="font-size:10px;color:#aaa;min-height:30px"></div>`;

    document.body.appendChild(panel);
    this.buildPanel = panel;
    this.refreshBuildPanelItems(panel);

    panel.querySelector('#bp-wood')!.addEventListener('click', () => {
      this.buildSystem.activeMaterial = 'wood';
      this.refreshBuildPanelItems(panel);
    });
    panel.querySelector('#bp-stone')!.addEventListener('click', () => {
      this.buildSystem.activeMaterial = 'stone';
      this.refreshBuildPanelItems(panel);
    });
  }

  private refreshBuildPanelItems(panel: HTMLDivElement): void {
    const container = panel.querySelector('#bp-items') as HTMLDivElement;
    const info = panel.querySelector('#bp-info') as HTMLDivElement;
    const mat = this.buildSystem.activeMaterial as StructMaterial;
    container.innerHTML = '';

    for (const def of Object.values(STRUCTURE_DEFS)) {
      const cost = mat === 'wood' ? def.woodCost : def.stoneCost;
      const canAfford = Object.entries(cost).every(([k, v]) => this.inventory.has(k, v));
      const btn = document.createElement('button');
      btn.textContent = def.label;
      btn.style.cssText = `
        padding:6px 2px; background:${canAfford ? '#2a4a2a' : '#333'};
        color:${canAfford ? '#aaffaa' : '#888'}; border:1px solid #446;
        border-radius:3px; cursor:pointer; font:11px monospace;
      `;
      const timeSec = (this.charStats.buildTime(def.baseTimeSec) * (mat === 'stone' ? 2 : 1) / 1000).toFixed(1);
      btn.title = `소요: ${timeSec}s`;
      btn.addEventListener('mouseenter', () => {
        const costStr = Object.entries(cost).map(([k, v]) => `${k.replace('item_', '')}×${v}`).join(', ');
        info.textContent = `${def.label} — ${costStr} | 소요: ${timeSec}s`;
      });
      btn.addEventListener('mouseleave', () => { info.textContent = ''; });
      btn.addEventListener('click', () => {
        this.buildSystem.activeDef = def;
        const costStr = Object.entries(cost).map(([k, v]) => `${k.replace('item_', '')}×${v} (보유:${this.inventory.get(k)})`).join(', ');
        info.textContent = `${def.label} — ${costStr} | 소요: ${timeSec}s`;
      });
      container.appendChild(btn);
    }
  }

  private closeBuildPanel(): void {
    this.buildPanel?.remove();
    this.buildPanel = null;
    this.buildSystem?.exitBuildMode();
  }

  private showBuildContextMenu(screenX: number, screenY: number, tileX: number, tileY: number, isPartial: boolean): void {
    this.closeContextMenu();

    const menu = document.createElement('div');
    menu.style.cssText = `
      position: fixed; left: ${screenX}px; top: ${screenY}px;
      background: rgba(10,15,25,0.96); border: 1px solid #446;
      border-radius: 4px; padding: 4px 0; z-index: 300;
      font: 12px monospace; color: #eee; min-width: 120px;
    `;

    const makeItem = (icon: string, label: string, onClick: () => void) => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:6px 12px;cursor:pointer;';
      item.textContent = `${icon} ${label}`;
      item.addEventListener('mouseenter', () => { item.style.background = '#1a2a3a'; });
      item.addEventListener('mouseleave', () => { item.style.background = ''; });
      item.addEventListener('click', () => { onClick(); this.closeContextMenu(); });
      menu.appendChild(item);
    };

    if (isPartial) {
      makeItem('🔨', '재개', () => {
        const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
        const wy = tileY * TILE_SIZE + TILE_SIZE / 2;
        const dist = Math.hypot(this.player.sprite.x - wx, this.player.sprite.y - wy);
        if (dist <= BUILD_RANGE) {
          this.buildSystem.startBuild(
            this.buildSystem.getPartialAt(tileX, tileY)!.defName,
            this.buildSystem.getPartialAt(tileX, tileY)!.material,
            tileX, tileY, this.charStats, this.inventory,
            this.proficiency.getSpeedMultiplier('building'),
          );
        } else {
          const partial = this.buildSystem.getPartialAt(tileX, tileY)!;
          this.buildAutoMoveTarget = { worldX: wx, worldY: wy };
          this.pendingBuild = { defName: partial.defName, material: partial.material, tileX, tileY };
        }
      });
    } else {
      makeItem('💥', '철거', () => {
        const wx = tileX * TILE_SIZE + TILE_SIZE / 2;
        const wy = tileY * TILE_SIZE + TILE_SIZE / 2;
        const dist = Math.hypot(this.player.sprite.x - wx, this.player.sprite.y - wy);
        if (dist <= BUILD_RANGE) {
          this.buildSystem.startDemolish(tileX, tileY, this.charStats, this.inventory);
        } else {
          this.buildAutoMoveTarget = { worldX: wx, worldY: wy };
          this.pendingBuild = { defName: '__demolish__', material: 'wood', tileX, tileY };
        }
      });
    }

    makeItem('❌', '취소', () => {});

    document.body.appendChild(menu);
    this.contextMenu = menu;

    // 다른 곳 클릭 시 닫기
    const closeOnClickOutside = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        this.closeContextMenu();
        document.removeEventListener('mousedown', closeOnClickOutside);
      }
    };
    document.addEventListener('mousedown', closeOnClickOutside);
  }

  private closeContextMenu(): void {
    this.contextMenu?.remove();
    this.contextMenu = null;
  }

  // ── Workbench Panel ───────────────────────────────────────────────────────────

  private toggleWorkbenchPanel(): void {
    this.openWorkbenchPanel(); // openWorkbenchPanel handles toggle logic
  }

  private openWorkbenchPanel(wx?: number, wy?: number): void {
    if (this.workbenchPanel) { this.closeWorkbenchPanel(); return; }
    if (wx !== undefined && wy !== undefined) {
      this.workbenchPos = { wx, wy };
    }

    const panel = document.createElement('div');
    panel.id = 'workbench-panel';
    panel.style.cssText = `
      position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
      width: 340px; background: rgba(10,15,25,0.93);
      border: 1px solid #664; border-radius: 6px; padding: 12px; z-index: 200;
      color: #eee; font: 12px monospace;
    `;

    const craftLvl = this.proficiency.getLevel('crafting');
    const craftXP = this.proficiency.getXP('crafting');
    const craftNext = this.proficiency.getXPToNextLevel('crafting');
    const craftBarPct = craftNext > 0 ? Math.round((craftXP / craftNext) * 100) : 100;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:bold;color:#e2b96f">🔨 작업대</span>
        <button id="wb-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div style="margin-bottom:8px;font-size:10px;color:#aaa">
        제작 숙련도: Lv.${craftLvl}
        <span style="display:inline-block;width:80px;height:7px;background:#1a2030;border-radius:3px;vertical-align:middle;margin:0 4px;overflow:hidden">
          <span style="display:block;width:${craftBarPct}%;height:100%;background:#44aaff;border-radius:3px"></span>
        </span>
        ${craftNext > 0 ? `${craftXP}/${craftNext}` : 'MAX'}
      </div>
      <div id="wb-tabs" style="display:flex;gap:4px;margin-bottom:8px;border-bottom:1px solid #334;padding-bottom:6px">
        <button class="wb-tab" data-tab="weapon" style="flex:1;padding:4px;background:#2a3a2a;color:#aaffaa;border:1px solid #446644;border-radius:3px;cursor:pointer;font:10px monospace">무기</button>
        <button class="wb-tab" data-tab="material" style="flex:1;padding:4px;background:#1a2030;color:#888;border:1px solid #334;border-radius:3px;cursor:pointer;font:10px monospace">재료</button>
        <button class="wb-tab" data-tab="tool" style="flex:1;padding:4px;background:#1a2030;color:#888;border:1px solid #334;border-radius:3px;cursor:pointer;font:10px monospace">도구</button>
        <button class="wb-tab" data-tab="armor" style="flex:1;padding:4px;background:#1a2030;color:#888;border:1px solid #334;border-radius:3px;cursor:pointer;font:10px monospace">방어구</button>
        <button class="wb-tab" data-tab="research" style="flex:1;padding:4px;background:#1a2030;color:#888;border:1px solid #334;border-radius:3px;cursor:pointer;font:10px monospace">연구</button>
      </div>
      <div id="wb-items" style="display:flex;flex-direction:column;gap:6px"></div>
      <div id="wb-research-progress" style="display:none;margin-top:8px">
        <div id="wb-res-bar-bg" style="width:100%;height:8px;background:#1a2030;border-radius:4px;overflow:hidden">
          <div id="wb-res-bar-fill" style="width:0%;height:100%;background:#44aaff;transition:width 0.1s linear;border-radius:4px"></div>
        </div>
        <div id="wb-res-bar-label" style="font-size:10px;color:#aaa;text-align:center;margin-top:3px"></div>
      </div>
      <div id="wb-status" style="font-size:10px;color:#88cc88;min-height:16px;margin-top:6px;text-align:center"></div>
    `;

    document.body.appendChild(panel);
    this.workbenchPanel = panel;

    panel.querySelector('#wb-close')!.addEventListener('click', () => this.closeWorkbenchPanel());

    let activeTab = 'weapon';
    panel.querySelectorAll('.wb-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = (btn as HTMLElement).dataset.tab ?? 'weapon';
        panel.querySelectorAll('.wb-tab').forEach(b => {
          const el = b as HTMLButtonElement;
          const isActive = el.dataset.tab === activeTab;
          el.style.background = isActive ? '#2a3a2a' : '#1a2030';
          el.style.color = isActive ? '#aaffaa' : '#888';
          el.style.borderColor = isActive ? '#446644' : '#334';
        });
        this.refreshWorkbenchPanel(panel, activeTab);
      });
    });

    this.refreshWorkbenchPanel(panel, activeTab);
  }

  private refreshWorkbenchPanel(panel: HTMLDivElement, activeTab = 'weapon'): void {
    const container = panel.querySelector('#wb-items') as HTMLDivElement;
    const status    = panel.querySelector('#wb-status') as HTMLDivElement;
    container.innerHTML = '';

    const craftLvl = this.proficiency.getLevel('crafting');
    const profMult = this.proficiency.getSpeedMultiplier('crafting');

    if (activeTab === 'weapon') {
      const craftableWeapons = WEAPONS.filter(w => w.recipe.length > 0);
      for (const weapon of craftableWeapons) {
        const unlocked = craftLvl >= weapon.requiredCraftLevel;
        if (!unlocked) {
          container.appendChild(this.makeLockedRow(weapon.name, `제작 숙련도 Lv.${weapon.requiredCraftLevel} 필요`));
          continue;
        }
        const canCraft = weapon.recipe.every(r => this.inventory.has(r.itemId, r.amount));
        const ms = this.charStats.buildTime(weapon.craftTimeSec) * profMult;
        const row = this.makeWorkbenchRow(
          weapon.name,
          weapon.recipe.map(r => `${r.itemId.replace('item_', '')}×${r.amount}(보유:${this.inventory.get(r.itemId)})`).join(', '),
          canCraft,
          () => {
            for (const r of weapon.recipe) this.inventory.remove(r.itemId, r.amount);
            status.textContent = `제작 중… (${(ms / 1000).toFixed(1)}s)`;
            this.time.delayedCall(ms, () => {
              this.inventory.add(`item_${weapon.id}`, 1);
              this.actionSystem.onActionDone('craft', this.survival);
              this.proficiency.addXP('crafting', 15);
              this.tutorialSystem.onEvent('item_crafted');
              status.textContent = `${weapon.name} 제작 완료!`;
              this.refreshWorkbenchPanel(panel, activeTab);
            });
          },
        );
        container.appendChild(row);
      }
    } else if (activeTab === 'research') {
      this.renderResearchTab(container, status);
    } else {
      const recipes = CRAFTING_RECIPES.filter(r => r.category === activeTab);
      for (const recipe of recipes) {
        const unlocked = craftLvl >= recipe.unlock.proficiencyLevel;
        if (!unlocked) {
          container.appendChild(this.makeLockedRow(recipe.label, `제작 숙련도 Lv.${recipe.unlock.proficiencyLevel} 필요`));
          continue;
        }
        if (recipe.unlock.researchId && !this.proficiency.isUnlockedByResearch(recipe.unlock.researchId)) {
          container.appendChild(this.makeLockedRow(recipe.label, '도면 아이템으로 해금 필요'));
          continue;
        }
        const canCraft = recipe.inputs.every(i => this.inventory.has(i.itemId, i.amount));
        const ms = this.charStats.craftTime * recipe.timeMultiplier * profMult;
        const row = this.makeWorkbenchRow(
          recipe.label,
          recipe.inputs.map(i => `${i.itemId.replace('item_', '')}×${i.amount}(보유:${this.inventory.get(i.itemId)})`).join(', '),
          canCraft,
          () => {
            for (const i of recipe.inputs) this.inventory.remove(i.itemId, i.amount);
            status.textContent = `제작 중… (${(ms / 1000).toFixed(1)}s)`;
            this.time.delayedCall(ms, () => {
              this.inventory.add(recipe.output.itemId, recipe.output.amount);
              this.actionSystem.onActionDone('craft', this.survival);
              this.proficiency.addXP('crafting', 15);
              this.tutorialSystem.onEvent('item_crafted');
              status.textContent = `${recipe.label} 완료!`;
              this.refreshWorkbenchPanel(panel, activeTab);
            });
          },
        );
        container.appendChild(row);
      }
    }
  }

  private renderResearchTab(container: HTMLDivElement, status: HTMLDivElement): void {
    const buildLvl = this.proficiency.getLevel('building');
    const craftLvl = this.proficiency.getLevel('crafting');

    for (const def of RESEARCH_DEFS) {
      const done = this.research.isCompleted(def.id);
      const inProg = this.research.isInProgress() && this.research.getCurrentDef()?.id === def.id;

      let locked = false;
      let lockMsg = '';
      if (def.requiredProficiency) {
        const have = def.requiredProficiency.type === 'building' ? buildLvl : craftLvl;
        if (have < def.requiredProficiency.level) {
          locked = true;
          lockMsg = `${PROF_NAMES[def.requiredProficiency.type]} 숙련도 Lv.${def.requiredProficiency.level} 필요 (현재 Lv.${have})`;
        }
      }

      if (locked) {
        container.appendChild(this.makeLockedRow(def.label, lockMsg));
        continue;
      }

      const canStart = !done && !this.research.isInProgress()
        && def.inputs.every(i => this.inventory.has(i.itemId, i.amount));
      const inputStr = def.inputs.map(i => `${i.itemId.replace('item_', '')}×${i.amount}(보유:${this.inventory.get(i.itemId)})`).join(', ');

      const row = document.createElement('div');
      row.style.cssText = `
        display:flex;align-items:center;justify-content:space-between;
        padding:6px 8px;background:${done ? '#1a2a1a' : canStart ? '#1a1a2a' : '#111'};
        border:1px solid ${done ? '#446644' : '#334'};border-radius:4px;
      `;
      row.innerHTML = `
        <div>
          <div style="color:${done ? '#88ff88' : '#ccc'};font-weight:bold">${def.label}</div>
          <div style="font-size:9px;color:#777;margin-top:2px">${inputStr} / ${(def.timeMs / 1000).toFixed(0)}s</div>
        </div>
      `;

      const btn = document.createElement('button');
      if (done) {
        btn.textContent = '✅ 완료';
        btn.disabled = true;
        btn.style.cssText = `padding:4px 8px;background:#2a4a2a;color:#88ff88;border:1px solid #446644;border-radius:3px;font:10px monospace;cursor:default;`;
      } else if (inProg) {
        btn.textContent = '연구 중';
        btn.disabled = true;
        btn.style.cssText = `padding:4px 8px;background:#555;color:#888;border:1px solid #444;border-radius:3px;font:10px monospace;cursor:default;`;
      } else {
        btn.textContent = canStart ? '연구' : '---';
        btn.disabled = !canStart;
        btn.style.cssText = `padding:4px 8px;background:${canStart ? '#2a2a5a' : '#333'};color:${canStart ? '#aaaaff' : '#666'};border:1px solid ${canStart ? '#44446a' : '#444'};border-radius:3px;font:10px monospace;cursor:${canStart ? 'pointer' : 'default'};`;
        if (canStart) {
          btn.addEventListener('click', () => {
            const pos = this.workbenchPos ?? { wx: this.player.sprite.x, wy: this.player.sprite.y };
            this.research.startResearch(def, this.inventory, pos.wx, pos.wy);
            status.textContent = '연구 시작!';
            if (this.workbenchPanel) this.refreshWorkbenchPanel(this.workbenchPanel, 'research');
          });
        }
      }

      row.appendChild(btn);
      container.appendChild(row);
    }
  }

  private updateResearchProgressBar(panel: HTMLDivElement): void {
    const progressDiv = panel.querySelector('#wb-research-progress') as HTMLDivElement;
    const fill = panel.querySelector('#wb-res-bar-fill') as HTMLDivElement;
    const label = panel.querySelector('#wb-res-bar-label') as HTMLDivElement;
    if (!progressDiv || !this.research.isInProgress()) {
      progressDiv?.style && (progressDiv.style.display = 'none');
      return;
    }
    progressDiv.style.display = 'block';
    const elapsed = this.research.getElapsed();
    const total = this.research.getCurrentDuration();
    const pct = Math.min(100, (elapsed / total) * 100);
    const remaining = Math.max(0, (total - elapsed) / 1000).toFixed(1);
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `연구 중… ${remaining}s`;
  }

  private makeLockedRow(name: string, reason: string): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display:flex;align-items:center;justify-content:space-between;
      padding:6px 8px;background:#111;border:1px solid #222;border-radius:4px;opacity:0.6;
    `;
    row.innerHTML = `
      <div>
        <div style="color:#666">🔒 ${name}</div>
        <div style="font-size:9px;color:#555;margin-top:2px">${reason}</div>
      </div>
    `;
    return row;
  }

  private makeWorkbenchRow(
    name: string,
    recipeStr: string,
    canCraft: boolean,
    onCraft: () => void,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display:flex;align-items:center;justify-content:space-between;
      padding:6px 8px;background:${canCraft ? '#1a2a1a' : '#1a1a2a'};
      border:1px solid ${canCraft ? '#446644' : '#334'};border-radius:4px;
    `;
    row.innerHTML = `
      <div>
        <div style="color:${canCraft ? '#aaffaa' : '#888'};font-weight:bold">${name}</div>
        <div style="font-size:9px;color:#777;margin-top:2px">${recipeStr}</div>
      </div>
    `;
    const btn = document.createElement('button');
    btn.textContent = '제작';
    btn.disabled = !canCraft;
    btn.style.cssText = `
      padding:4px 10px;background:${canCraft ? '#2a5a2a' : '#333'};
      color:${canCraft ? '#aaffaa' : '#666'};border:1px solid ${canCraft ? '#446644' : '#444'};
      border-radius:3px;cursor:${canCraft ? 'pointer' : 'default'};font:11px monospace;
    `;
    if (canCraft) {
      btn.addEventListener('click', () => {
        btn.disabled = true;
        onCraft();
      });
    }
    row.appendChild(btn);
    return row;
  }

  private closeWorkbenchPanel(): void {
    this.workbenchPanel?.remove();
    this.workbenchPanel = null;
  }

  // ── 레벨업 / 알림 팝업 ──────────────────────────────────────────────────────

  private showLevelUpPopup(type: ProficiencyType, level: number): void {
    const name = PROF_NAMES[type];
    this.showNotificationPopup(`⬆ ${name} 숙련도 Lv.${level}!`, '#ffd700', true);
  }

  showNotificationPopup(message: string, color = '#ffd700', large = false): void {
    const existing = document.getElementById('notif-popup-' + message.slice(0, 10));
    existing?.remove();

    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed; top: 40%; left: 50%; transform: translateX(-50%);
      color: ${color}; font: ${large ? 'bold 14px' : '12px'} monospace; text-align: center;
      background: rgba(0,0,0,0.7); padding: 6px 14px; border-radius: 4px;
      z-index: 600; pointer-events: none; opacity: 1; transition: opacity 1.5s ease;
      white-space: nowrap;
    `;
    popup.textContent = message;
    document.body.appendChild(popup);

    setTimeout(() => {
      popup.style.opacity = '0';
      setTimeout(() => popup.remove(), 1500);
    }, 200);
  }

  // ── 광란 자동 공격 ───────────────────────────────────────────────────────────

  private doFrenzyAttack(): void {
    const px = this.player.sprite.x, py = this.player.sprite.y;
    const FRENZY_RANGE = 128;
    const FRENZY_DMG = 15;

    // 1순위: 범위 내 살아있는 동물
    const animals = this.animalMgr.getAnimals().filter(a => !a.isDead &&
      Math.hypot(a.x - px, a.y - py) <= FRENZY_RANGE,
    );

    if (animals.length > 0) {
      animals.sort((a, b) => Math.hypot(a.x-px,a.y-py) - Math.hypot(b.x-px,b.y-py));
      const target = animals[0];
      const drops = this.animalMgr.attackAnimal(target, FRENZY_DMG, px, py, this.frenzyRng);
      drops.forEach(d => this.inventory.add(d.itemKey, d.count));
      this.effects.spawnFloatText(target.x, target.y - 20, `-${FRENZY_DMG}`, '#ff4444');
      if (target.isDead) {
        this.actionSystem.onActionDone('kill_enemy', this.survival);
        this.proficiency.addXP('combat', 10);
      }
      return;
    }

    // 2순위: 범위 내 가장 가까운 건설물
    let closestStruct = null;
    let closestDist = Infinity;
    for (const s of this.buildSystem.getAllStructures()) {
      const sx = s.tileX * TILE_SIZE + TILE_SIZE / 2;
      const sy = s.tileY * TILE_SIZE + TILE_SIZE / 2;
      const d = Math.hypot(sx - px, sy - py);
      if (d < closestDist && d <= FRENZY_RANGE) {
        closestDist = d;
        closestStruct = s;
      }
    }
    if (closestStruct) {
      const dmgResult = this.durabilitySystem.applyDamage(closestStruct, 15);
      this.effects.spawnFloatText(
        closestStruct.tileX * TILE_SIZE + TILE_SIZE / 2,
        closestStruct.tileY * TILE_SIZE - 4,
        '-15', '#ff8844',
      );
      if (!dmgResult.alive) {
        this.destroyStructure(closestStruct.tileX, closestStruct.tileY, '광란에 의해 파괴되었습니다');
      }
    }
  }

  private tryStartSleep(material: 'wood' | 'stone', tileX: number, tileY: number): void {
    if (this.survival.isFrenzy) {
      this.showNotificationPopup('광란 상태에서는 잘 수 없습니다', '#ff8844');
      return;
    }
    if (this.combat.getLockedTarget()) {
      this.showNotificationPopup('전투 중에는 잘 수 없습니다', '#ff8844');
      return;
    }
    if (this.survival.fatigue >= 70) {
      this.showNotificationPopup('충분히 쉬었습니다', '#aaffaa');
      return;
    }
    if (this.survival.hunger === 0) {
      this.showNotificationPopup('배가 너무 고파 잠들 수 없습니다', '#ffaa44');
      return;
    }

    const bedType = material === 'wood'
      ? ('bed_wood' as const)
      : ('bed_stone' as const);
    const isIndoor = this.roofSystem.isCovered(tileX, tileY);

    const ok = this.sleepSystem.startSleep(bedType, isIndoor, (reason) => this.onWake(reason));
    if (ok) {
      this.soundSystem.play('sleep_start');
      // 누운 자세 (90도 회전)
      this.player.sprite.setAngle(90);
      this.sleepOverlay.show(this.survival, this.gameTime, () => {
        this.sleepSystem.wakeUp('user');
      });
    }
  }

  private toggleDoor(buildingId: string, material: 'wood' | 'stone'): void {
    const playerId = localStorage.getItem('survival_player_id') ?? 'local';
    const ok = this.doorSystem.interact(buildingId, playerId);
    if (!ok) {
      this.showNotificationPopup('잠긴 문입니다', '#ff8844');
      return;
    }
    const isOpen = this.doorSystem.isOpen(buildingId);
    this.updateDoorSprite(buildingId, material, isOpen);
    this.soundSystem.play(isOpen ? 'door_open' : 'door_close');
  }

  private updateDoorSprite(buildingId: string, material: 'wood' | 'stone', open: boolean): void {
    const struct = this.buildSystem.getAt(
      parseInt(buildingId.split(',')[0]),
      parseInt(buildingId.split(',')[1]),
    );
    if (struct) {
      const texKey = open ? `struct_door_${material}_open` : `struct_door_${material}`;
      struct.sprite.setTexture(texKey);
    }
  }

  private onWake(reason: import('../systems/SleepSystem').WakeReason): void {
    this.sleepOverlay.hide();
    // Restore isForcedSleep to false
    this.survival.isForcedSleep = false;
    // Restore player sprite from sleeping rotation
    this.player.sprite.setAngle(0);
    // 수면으로 식중독 해제
    this.hungerSystem.clearPoisonOnWake();
    // 기상 시 HP 회복 (CON×3)
    this.hpSystem.onWakeUp(this.charStats, this.survival);
    this.soundSystem.play('wake_up');
    this.tutorialSystem.onEvent('sleep_completed');

    const msgs: Record<string, [string, string]> = {
      recovered: ['☀ 기상!', '#ffee44'],
      morning:   ['☀ 아침이 되었습니다', '#ffee44'],
      attacked:  ['공격을 받아 잠에서 깼습니다!', '#ff6644'],
      starving:  ['배고파서 잠에서 깼습니다!', '#ffaa44'],
      user:      ['기상했습니다', '#aaffaa'],
    };
    const [msg, color] = msgs[reason] ?? ['기상', '#aaaaaa'];
    this.showNotificationPopup(msg, color);

    if (reason === 'recovered' || reason === 'morning') {
      this.actionSystem.onActionDone('sleep', this.survival);
      if (!this.isMultiplayer) this.saveSystem.saveAuto(this.collectSaveData());
    }
  }

  /** 내구도 0으로 구조물 파괴 — 재료 50% 회수 후 제거 */
  private destroyStructure(tileX: number, tileY: number, reason = '구조물이 무너졌습니다'): void {
    const struct = this.buildSystem.getAt(tileX, tileY);
    if (!struct) return;
    const def = STRUCTURE_DEFS[struct.defName];
    const cost = struct.material === 'wood' ? def.woodCost : def.stoneCost;
    // 재료 50% 회수
    for (const [itemKey, count] of Object.entries(cost)) {
      this.inventory.add(itemKey, Math.floor(count * 0.5));
    }
    // 파괴 연출: 빨간 틴트 → 흔들림
    struct.sprite.setTint(0xff3322);
    this.tweens.add({
      targets: struct.sprite,
      x: struct.sprite.x + 2, y: struct.sprite.y + 1,
      duration: 50, yoyo: true, repeat: 2,
      onComplete: () => this.buildSystem.removeStructureAt(tileX, tileY),
    });
    this.showNotificationPopup(reason, '#ff8844');
  }

  // ── 저장 / 불러오기 ──────────────────────────────────────────────────────────

  collectSaveData(): SaveData {
    const slots = this.equipmentSystem.getSlots();
    return {
      version: 1,
      savedAt: Date.now(),
      playtime: this.playtimeMs,
      seed: this.seed,
      character: {
        name: this.characterName,
        appearance: this.pendingAppearance,
        mapX: this.mapX,
        mapY: this.mapY,
        x: this.player.sprite.x,
        y: this.player.sprite.y,
        stats: {
          str: this.charStats.str,
          agi: this.charStats.agi,
          con: this.charStats.con,
          int: this.charStats.int,
        },
        hp: this.survival.hp,
        hunger: this.survival.hunger,
        fatigue: this.survival.fatigue,
        action: this.survival.action,
        maxHpDebuff: this.hungerSystem.getMaxHpDebuff(),
        poisoning: this.hungerSystem.serialize().poisoning,
        inventory: { slots: this.inventory.getSaveData() },
        equipment: {
          weapon: null, armor: slots.armor, shield: slots.shield,
          torch: slots.torch ?? null,
          torchRemainingMs: this.lightSystem?.getTorchRemaining() ?? 0,
        },
        proficiency: this.proficiency.serialize(),
        unlockedResearch: [
          ...this.research.getCompletedIds(),
          ...this.proficiency.getUnlockedByResearch(),
        ].filter((v, i, a) => a.indexOf(v) === i),
        knownRecipes: [],
      },
      world: {
        buildings: this.buildSystem.getAllStructures().map(s => ({
          type: s.defName,
          tileX: s.tileX,
          tileY: s.tileY,
          durability: s.durability,
          material: s.material,
          ...(s.defName === 'door' ? { doorOpen: this.doorSystem.isOpen(s.id) } : {}),
        })),
        clearedTrees: [...this.clearedTrees].map(({ tx, ty, regrowAt }) => ({ tileX: tx, tileY: ty, regrowAt })),
        clearedRocks: [...this.clearedRocks].map(({ tx, ty }) => ({ tileX: tx, tileY: ty })),
        visitedMaps: [...this.visitedMaps].map(k => k.split(',').map(Number) as [number, number]),
        killedEnemies: [
          ...this.killedEnemiesAll,
          ...this.animalMgr.getDeadIds(),
        ].filter((v, i, a) => a.indexOf(v) === i),
        gameTime: {
          day: this.gameTime.day,
          timeOfDay: this.gameTime.totalGameSeconds % 86400,
          realElapsedMs: this.gameTime.getElapsed(),
        },
      },
      settings: this.saveSystem.loadSettings(),
    };
  }

  private restoreFromSaveData(saveData: SaveData): void {
    const ch = saveData.character;

    // 위치 복원
    this.player.sprite.setPosition(ch.x, ch.y);

    // 생존 수치 복원
    this.survival.hp = ch.hp;
    this.survival.hunger = ch.hunger;
    this.survival.fatigue = ch.fatigue;
    this.survival.action = ch.action;

    // 허기 시스템 복원
    this.hungerSystem.deserialize({
      maxHpDebuff: ch.maxHpDebuff ?? 0,
      poisoning: ch.poisoning ?? { active: false, timeLeft: 0 },
    });

    // 인벤토리 복원
    this.inventory.restore(ch.inventory.slots);

    // 장비 복원 (인벤토리 조작 없이 직접 슬롯 설정)
    this.equipmentSystem.restoreSlots({
      armor: ch.equipment.armor,
      shield: ch.equipment.shield,
      torch: ch.equipment.torch ?? null,
    });
    if (ch.equipment.torch && (ch.equipment.torchRemainingMs ?? 0) > 0) {
      this.lightSystem?.equipTorch();
      this.lightSystem?.setTorchRemaining(ch.equipment.torchRemainingMs!);
    }

    // 숙련도 복원
    this.proficiency.restoreFrom(ch.proficiency);
    this.proficiency.restoreUnlockedByResearch(ch.unlockedResearch);

    // 연구 완료 목록 복원
    this.research.restoreCompleted(ch.unlockedResearch);

    // 게임 시간 복원
    this.gameTime.setElapsed(saveData.world.gameTime.realElapsedMs);

    // 방문 맵 & 처치 적 복원
    if (saveData.world.visitedMaps) {
      for (const [mx, my] of saveData.world.visitedMaps) {
        this.visitedMaps.add(`${mx},${my}`);
      }
    }
    if (saveData.world.killedEnemies) {
      for (const id of saveData.world.killedEnemies) {
        this.killedEnemiesAll.add(id);
      }
    }

    // 채굴된 암반 복원
    for (const r of saveData.world.clearedRocks) {
      if (this.currentTiles[r.tileY]?.[r.tileX] !== TileType.Dirt) {
        this.clearTile(r.tileX, r.tileY);
      }
    }

    // 벌목된 나무 복원 (regrowAt 경과 시 즉시 재생, 아직이면 cleared 상태 유지)
    const now = Date.now();
    for (const t of saveData.world.clearedTrees) {
      const regrowAt = t.regrowAt ?? (now + this.TREE_REGROW_MS);
      if (now >= regrowAt) {
        // regrowAt passed while offline — tree has regrown
        continue; // tile stays as Tree (already initialized from mapData)
      }
      if (this.currentTiles[t.tileY]?.[t.tileX] !== TileType.Dirt) {
        this.currentTiles[t.tileY][t.tileX] = TileType.Dirt;
        this.tileRT.draw('tile_dirt', t.tileX * TILE_SIZE, t.tileY * TILE_SIZE);
        const key = `${t.tileX},${t.tileY}`;
        this.treeSprites.get(key)?.destroy();
        this.treeSprites.delete(key);
        this.clearedTrees.push({ tx: t.tileX, ty: t.tileY, regrowAt });
      }
    }

    // 건설물 복원
    for (const b of saveData.world.buildings) {
      this.buildSystem.forceRestoreStructure(b.type, b.material, b.tileX, b.tileY, b.durability);
      const bId = this.buildSystem.tileKey(b.tileX, b.tileY);
      if (b.type === 'door') {
        this.doorSystem.registerDoor(bId, b.tileX, b.tileY, b.doorOpen ?? false);
        if (b.doorOpen) this.updateDoorSprite(bId, b.material as 'wood' | 'stone', true);
      }
      if (b.type === 'roof') {
        this.roofSystem.addRoof(b.tileX, b.tileY);
      }
    }
  }

  // ── Death ─────────────────────────────────────────────────────────────────────

  private triggerDeath(): void {
    // 캐릭터 회색 틴트 → 사망 연출
    this.player.sprite.setTint(0x888888);
    this.soundSystem.play('player_die');
    this.soundSystem.silenceBGM();

    // 인벤토리 전부 지면에 드랍
    for (const { key, count } of this.inventory.getAll()) {
      this.dropSystem.spawnItem(key, this.player.sprite.x, this.player.sprite.y, count);
    }
    this.inventory.clear();

    // 저장 슬롯 삭제
    if (!this.isMultiplayer) {
      this.saveSystem.deleteSave(this.saveSystem.getLastUsedSlot());
    }

    // 멀티플레이 퇴장 (사망 시스템 메시지 → leaveRoom 전에 전송)
    if (this.isMultiplayer) {
      this.multiplayerSys.sendSystemMessage(`💀 ${this.characterName}님이 사망했습니다`);
      void this.multiplayerSys.leaveRoom();
    }

    // 0.5초 후 사망 화면 표시
    this.time.delayedCall(500, () => {
      this.cameras.main.fadeOut(1000, 0, 0, 0, (_cam: unknown, progress: number) => {
        if (progress === 1) {
          this.deathScreen.show({
            playtimeMs: this.playtimeMs,
            enemiesKilled: this.enemiesKilled,
            buildingsBuilt: this.buildingsBuilt,
            onReturnToTitle: () => {
              this.deathScreen.destroy();
              this.scene.stop('UIScene');
              this.scene.start('TitleScene');
            },
          });
        }
      });
    });
  }

  // ── isNearTable ──────────────────────────────────────────────────────────────

  isNearTable(): boolean {
    return this.findNearbyTable() !== null;
  }

  private findNearbyTable(): import('../systems/BuildSystem').PlacedStructure | null {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    for (const struct of this.buildSystem.getAllStructures()) {
      if (struct.defName === 'table') {
        const wx = struct.tileX * TILE_SIZE + TILE_SIZE / 2;
        const wy = struct.tileY * TILE_SIZE + TILE_SIZE / 2;
        if (Math.hypot(px - wx, py - wy) <= 48) return struct;
      }
    }
    return null;
  }

  // ── Kitchen Panel ─────────────────────────────────────────────────────────────

  private toggleKitchenPanel(kitchenWx: number, kitchenWy: number): void {
    if (this.kitchenPanel) { this.closeKitchenPanel(); return; }
    this.openKitchenPanel(kitchenWx, kitchenWy);
  }

  private openKitchenPanel(kitchenWx: number, kitchenWy: number): void {
    this.closeKitchenPanel();
    this.cookingKitchenPos = { wx: kitchenWx, wy: kitchenWy };

    const panel = document.createElement('div');
    panel.id = 'kitchen-panel';
    panel.style.cssText = `
      position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
      width: 320px; background: rgba(10,15,25,0.93);
      border: 1px solid #664; border-radius: 6px; padding: 12px; z-index: 200;
      color: #eee; font: 12px monospace;
    `;

    const cookLvl = this.proficiency.getLevel('cooking');
    const cookXP = this.proficiency.getXP('cooking');
    const cookNext = this.proficiency.getXPToNextLevel('cooking');
    const cookBarPct = cookNext > 0 ? Math.round((cookXP / cookNext) * 100) : 100;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:bold;color:#e2b96f">🍳 조리대</span>
        <button id="kitchen-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div style="margin-bottom:8px;font-size:10px;color:#aaa">
        요리 숙련도: Lv.${cookLvl}
        <span style="display:inline-block;width:80px;height:7px;background:#1a2030;border-radius:3px;vertical-align:middle;margin:0 4px;overflow:hidden">
          <span style="display:block;width:${cookBarPct}%;height:100%;background:#e2a040;border-radius:3px"></span>
        </span>
        ${cookNext > 0 ? `${cookXP}/${cookNext}` : 'MAX'}
      </div>
      <div id="kitchen-recipes" style="display:flex;flex-direction:column;gap:6px"></div>
      <div id="kitchen-progress" style="margin-top:10px;display:none">
        <div id="kitchen-bar-bg" style="width:100%;height:10px;background:#1a2030;border-radius:4px;overflow:hidden">
          <div id="kitchen-bar-fill" style="width:0%;height:100%;background:#e2a040;transition:width 0.1s linear;border-radius:4px"></div>
        </div>
        <div id="kitchen-bar-label" style="font-size:10px;color:#aaa;text-align:center;margin-top:4px"></div>
      </div>
      <div id="kitchen-status" style="font-size:10px;color:#88cc88;min-height:16px;margin-top:6px;text-align:center"></div>
    `;

    document.body.appendChild(panel);
    this.kitchenPanel = panel;

    panel.querySelector('#kitchen-close')!.addEventListener('click', () => this.closeKitchenPanel());
    this.refreshKitchenPanel(panel);
  }

  private refreshKitchenPanel(panel: HTMLDivElement): void {
    const container = panel.querySelector('#kitchen-recipes') as HTMLDivElement;
    const status = panel.querySelector('#kitchen-status') as HTMLDivElement;
    container.innerHTML = '';

    const cookLvl2 = this.proficiency.getLevel('cooking');
    const cookProfMult = this.proficiency.getSpeedMultiplier('cooking');

    for (const recipe of COOKING_RECIPES) {
      // 숙련도 잠금 체크
      if (cookLvl2 < recipe.unlock.proficiencyLevel) {
        container.appendChild(this.makeLockedRow(recipe.label, `요리 숙련도 Lv.${recipe.unlock.proficiencyLevel} 필요`));
        continue;
      }
      // 레시피 아이템 해금 체크 (researchId가 있으면 반드시 해금되어야 함)
      if (recipe.unlock.researchId && !this.proficiency.isUnlockedByResearch(recipe.unlock.researchId)) {
        container.appendChild(this.makeLockedRow(recipe.label, '레시피 아이템으로 해금 필요'));
        continue;
      }
      const canCook = recipe.inputs.every(i => this.inventory.has(i.itemId, i.amount));
      const isCooking = this.cookingRecipe?.id === recipe.id;
      const holdCount = recipe.inputs.length > 0
        ? this.inventory.get(recipe.inputs[0].itemId)
        : 0;
      const timeSec = (this.charStats.cookTime * recipe.timeMultiplier * cookProfMult / 1000).toFixed(1);

      const row = document.createElement('div');
      row.style.cssText = `
        display:flex;align-items:center;justify-content:space-between;
        padding:6px 8px;background:${canCook ? '#1a2a1a' : '#1a1a2a'};
        border:1px solid ${canCook ? '#446644' : '#334'};border-radius:4px;
      `;

      const inputDesc = recipe.inputs.map(i => {
        const name = i.itemId.replace('item_', '');
        return `${name}×${i.amount}`;
      }).join(', ');

      row.innerHTML = `
        <div>
          <div style="color:${canCook ? '#aaffaa' : '#888'};font-weight:bold">${recipe.label}</div>
          <div style="font-size:9px;color:#777;margin-top:2px">${inputDesc} / 보유: ${holdCount}개 → ${timeSec}s</div>
        </div>
      `;

      const btn = document.createElement('button');
      if (isCooking) {
        btn.textContent = '요리 중';
        btn.disabled = true;
        btn.style.cssText = `padding:4px 8px;background:#555;color:#888;border:1px solid #444;border-radius:3px;font:11px monospace;cursor:default;`;
      } else {
        btn.textContent = canCook ? '요리' : '---';
        btn.disabled = !canCook;
        btn.style.cssText = `
          padding:4px 8px;background:${canCook ? '#2a5a2a' : '#333'};
          color:${canCook ? '#aaffaa' : '#666'};border:1px solid ${canCook ? '#446644' : '#444'};
          border-radius:3px;cursor:${canCook ? 'pointer' : 'default'};font:11px monospace;
        `;
        if (canCook) {
          btn.addEventListener('click', () => this.startCooking(recipe, panel));
        }
      }

      row.appendChild(btn);
      container.appendChild(row);
    }

    // 진행바 표시 여부
    const progressDiv = panel.querySelector('#kitchen-progress') as HTMLDivElement;
    if (this.cookingRecipe) {
      progressDiv.style.display = 'block';
    } else {
      progressDiv.style.display = 'none';
      status.textContent = '';
    }
  }

  private startCooking(recipe: Recipe, panel: HTMLDivElement): void {
    if (this.cookingRecipe) return; // 이미 요리 중

    // 재료 차감
    for (const input of recipe.inputs) {
      this.inventory.remove(input.itemId, input.amount);
    }

    this.cookingRecipe = recipe;
    const cookPM = this.proficiency.getSpeedMultiplier('cooking');
    this.cookingDuration = this.charStats.cookTime * recipe.timeMultiplier * cookPM;
    this.cookingStartTime = this.time.now;

    const status = panel.querySelector('#kitchen-status') as HTMLDivElement;
    const progressDiv = panel.querySelector('#kitchen-progress') as HTMLDivElement;
    progressDiv.style.display = 'block';
    this.refreshKitchenPanel(panel);

    this.cookingTimer = this.time.delayedCall(this.cookingDuration, () => {
      this.completeCooking(status);
    });

    status.textContent = '요리 시작!';
  }

  private completeCooking(statusEl?: HTMLDivElement | null): void {
    const recipe = this.cookingRecipe;
    if (!recipe) return;

    this.cookingRecipe = null;
    this.cookingTimer = null;

    const canAdd = this.inventory.canAdd(recipe.output.itemId);
    if (canAdd) {
      this.inventory.add(recipe.output.itemId, recipe.output.amount);
      this.actionSystem.onActionDone('cook', this.survival);
      const xp = recipe.output.amount >= 2 ? 20 : 12;
      this.proficiency.addXP('cooking', xp);
      if (statusEl) statusEl.textContent = `${recipe.label} 완료!`;
    } else {
      if (statusEl) statusEl.textContent = '⚠ 인벤토리 가득 참 — 결과물 소멸';
    }

    if (this.kitchenPanel) this.refreshKitchenPanel(this.kitchenPanel);
  }

  private cancelCooking(): void {
    if (!this.cookingRecipe) return;
    this.cookingTimer?.remove();
    this.cookingTimer = null;
    this.cookingRecipe = null;
    this.cookingKitchenPos = null;

    // 중단 메시지
    const existing = document.getElementById('cooking-cancel-popup');
    existing?.remove();
    const popup = document.createElement('div');
    popup.id = 'cooking-cancel-popup';
    popup.style.cssText = `
      position: fixed; bottom: 120px; left: 50%; transform: translateX(-50%);
      color: #ff8888; font: 12px monospace; text-align: center;
      background: rgba(0,0,0,0.7); padding: 4px 10px; border-radius: 4px;
      z-index: 500; pointer-events: none; opacity: 1; transition: opacity 1.5s ease;
    `;
    popup.textContent = '요리가 중단되었습니다';
    document.body.appendChild(popup);
    setTimeout(() => { popup.style.opacity = '0'; setTimeout(() => popup.remove(), 1500); }, 100);

    if (this.kitchenPanel) this.refreshKitchenPanel(this.kitchenPanel);
  }

  private updateKitchenProgressBar(): void {
    if (!this.kitchenPanel || !this.cookingRecipe) return;
    const elapsed = this.time.now - this.cookingStartTime;
    const pct = Math.min(100, (elapsed / this.cookingDuration) * 100);
    const remaining = Math.max(0, (this.cookingDuration - elapsed) / 1000).toFixed(1);

    const fill = this.kitchenPanel.querySelector('#kitchen-bar-fill') as HTMLDivElement;
    const label = this.kitchenPanel.querySelector('#kitchen-bar-label') as HTMLDivElement;
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `요리 중… ${remaining}s`;
  }

  private closeKitchenPanel(): void {
    this.kitchenPanel?.remove();
    this.kitchenPanel = null;
    // 요리가 진행 중이면 계속 진행 (패널 닫기 = 취소 아님)
    // cookingRecipe/timer는 유지됨
  }

  private findNearestTile(type: TileType): { wx: number; wy: number } | null {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    let best: { wx: number; wy: number } | null = null;
    let bestDist = Infinity;
    const tiles = this.currentTiles;
    for (let ty = 0; ty < tiles.length; ty++) {
      for (let tx = 0; tx < tiles[ty].length; tx++) {
        if (tiles[ty][tx] === type) {
          const wx = tx * TILE_SIZE + TILE_SIZE / 2;
          const wy = ty * TILE_SIZE + TILE_SIZE / 2;
          const d = Math.hypot(px - wx, py - wy);
          if (d < bestDist) { bestDist = d; best = { wx, wy }; }
        }
      }
    }
    return best;
  }

  // ── Tutorial State ────────────────────────────────────────────────────────────

  private makeTutorialState(): import('../systems/TutorialSystem').TutorialGameState {
    const cam = this.cameras.main;
    return {
      playerX: this.player.sprite.x,
      playerY: this.player.sprite.y,
      woodCount: this.inventory.get('item_wood'),
      stoneCount: this.inventory.get('item_stone'),
      buildingCount: this.buildingsBuilt,
      worldToScreen: (wx, wy) => {
        const sx = (wx - cam.worldView.x) * cam.zoom;
        const sy = (wy - cam.worldView.y) * cam.zoom;
        return { x: sx, y: sy };
      },
      nearestTree: () => this.findNearestTile(TileType.Tree),
      nearestRock: () => this.findNearestTile(TileType.Rock),
      nearestWater: () => this.findNearestTile(TileType.Water),
    };
  }
}
