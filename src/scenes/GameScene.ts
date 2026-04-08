import Phaser from 'phaser';
import { MapGenerator, TileType, TILE_SIZE } from '../world/MapGenerator';
import { Player } from '../entities/Player';
import { CharacterStats } from '../entities/CharacterStats';
import { SurvivalStats } from '../systems/SurvivalStats';
import { GameTime } from '../systems/GameTime';
import { MultiplayerSync, RemotePlayer } from '../systems/MultiplayerSync';
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
  private multiplayer!: MultiplayerSync;

  private preloadedMaps = new Map<string, ReturnType<MapGenerator['generateMap']>>();
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

  // 요리 진행 상태
  private cookingRecipe: Recipe | null = null;
  private cookingTimer: Phaser.Time.TimerEvent | null = null;
  private cookingKitchenPos: { wx: number; wy: number } | null = null;
  private cookingStartTime = 0;
  private cookingDuration = 0;

  // Shelf storage
  private shelfStorages = new Map<string, ShelfStorage>();
  private shelfUI!: ShelfUI;

  // 건설 자동이동
  private buildAutoMoveTarget: { worldX: number; worldY: number } | null = null;
  private pendingBuild: { defName: string; material: StructMaterial; tileX: number; tileY: number } | null = null;

  // Click-to-move target
  private moveTarget: { worldX: number; worldY: number } | null = null;
  private moveTargetCommand: Command | null = null;

  // Tree regeneration
  private clearedTrees: { tx: number; ty: number }[] = [];
  private treeRegenTimer = 0;
  private readonly TREE_REGEN_CHECK_MS = 3 * 60 * 1000; // Check every 3 game hours (180 real sec)
  private readonly TREE_REGEN_RATE = 0.3; // Probability to regrow one tree per check

  // Individual tree sprites for depth sorting
  private treeSprites = new Map<string, Phaser.GameObjects.Image>();

  // Other players
  private otherPlayerSprites = new Map<string, Phaser.GameObjects.Sprite>();

  constructor() { super({ key: 'GameScene' }); }

  init(data: { seed: string }) { this.seed = data.seed; }

  create() {
    registerTextures(this);

    const playerId = getOrCreatePlayerId();
    this.charStats = new CharacterStats(this.seed, playerId);
    this.survival = new SurvivalStats(this.charStats);
    this.gameTime = new GameTime();
    this.weather = new WeatherSystem(this, this.gameTime, this.seed);

    this.mapGenerator = new MapGenerator(this.seed);
    const firstMap = this.mapGenerator.generateMap(0, 0);
    this.currentTiles = firstMap.tiles;
    this.preloadedMaps.set('0,0', firstMap);
    this.loadMap(0, 0);

    const start = this.findStartTile(this.currentTiles);
    this.player = new Player(this, start.x, start.y, this.charStats);
    this.player.setTiles(this.currentTiles);
    this.player.sprite.setDepth(this.player.sprite.y);

    this.cameras.main.startFollow(this.player.sprite, true);
    this.cameras.main.setZoom(2);

    this.multiplayer = new MultiplayerSync(this.seed, playerId);
    this.multiplayer.onPlayersUpdate((players) => this.updateOtherPlayers(players));

    this.inventory = new Inventory();
    this.animalMgr = new AnimalManager();
    this.buildSystem = new BuildSystem();
    this.buildSystem.init(this);
    this.effects = new EffectSystem(this);
    this.invasion = new InvasionSystem(this, this.gameTime, this.seed, playerId);
    this.commandQueue = new CommandQueue();

    // 건설 완료 시 큐 진행
    this.buildSystem.setBuildCompleteCallback(() => {
      this.commandQueue.completeCommand();
      this.processNextQueueCommand();
    });
    this.commandQueueUI = new CommandQueueUI(this.commandQueue);
    this.shelfUI = new ShelfUI();

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

    // Spawn animals on current map
    this.animalMgr.spawnForMap(this.seed, 0, 0, this.currentTiles, this, new Set());

    // Combat system — must come after player, charStats, survival, inventory, animalMgr
    const playerRng2 = new SeededRandom(`${this.seed}_combat_${playerId}`);
    this.combat = new CombatSystem(
      this, this.player, this.charStats, this.survival, this.inventory, this.animalMgr, playerRng2,
    );
    this.combat.setEffectSystem(this.effects);

    // 전투 종료 시 큐 진행
    this.combat.setCombatEndCallback(() => {
      this.commandQueue.completeCommand();
      this.processNextQueueCommand();
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
    });

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const wx = ptr.worldX;
      const wy = ptr.worldY;
      const isShiftHeld = (ptr.event as MouseEvent)?.shiftKey ?? false;

      if (ptr.rightButtonDown()) {
        this.buildSystem.exitBuildMode();
        this.closeBuildPanel();
        this.combat.unlock();
        // 완공 구조물 또는 중단된 건축 위 우클릭 → 컨텍스트 팝업
        const rtx = Math.floor(wx / TILE_SIZE);
        const rty = Math.floor(wy / TILE_SIZE);
        const rStruct = this.buildSystem.getAt(rtx, rty);
        const rPartial = this.buildSystem.getPartialAt(rtx, rty);
        if (rStruct || rPartial) {
          const sx = (ptr.event as MouseEvent).clientX ?? ptr.x;
          const sy = (ptr.event as MouseEvent).clientY ?? ptr.y;
          this.showBuildContextMenu(sx, sy, rtx, rty, !!rPartial);
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

    // Zoom wheel
    this.input.on('wheel', (_: unknown, __: unknown, ___: unknown, deltaY: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.5, 4));
    });

    // Direction keys: clear queue on keyboard movement
    this.input.keyboard!.on('keydown-UP', () => this.commandQueue.clearAll());
    this.input.keyboard!.on('keydown-DOWN', () => this.commandQueue.clearAll());
    this.input.keyboard!.on('keydown-LEFT', () => this.commandQueue.clearAll());
    this.input.keyboard!.on('keydown-RIGHT', () => this.commandQueue.clearAll());

    // B key: toggle build panel
    this.input.keyboard!.on('keydown-B', () => this.toggleBuildPanel());

    // V key: toggle inventory (handled by UIScene keyboard listener)

    // ESC: exit build mode, cancel interaction, close panels, unlock target, clear queue
    this.input.keyboard!.on('keydown-ESC', () => {
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
    });

    // Launch UI scene (zoom-independent HUD)
    this.scene.launch('UIScene');

    this.preloadAdjacentMaps();
  }

  update(time: number, delta: number) {
    this.gameTime.update(delta);
    this.survival.update(delta);
    this.weather.update(delta);
    this.invasion.update(delta);
    this.shelfUI.updatePlayerPosition(this.player.sprite.x, this.player.sprite.y);
    this.buildSystem.update(delta, this.survival, this.player.sprite.x, this.player.sprite.y);

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

    // Frenzy damages structures once per second
    if (this.survival.isFrenzy) {
      this.frenzyDamageTimer -= delta;
      if (this.frenzyDamageTimer <= 0) {
        this.frenzyDamageTimer = 1000;
        this.buildSystem.damageFrenzy();
      }
    } else {
      this.frenzyDamageTimer = 0;
    }

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
            this.openWorkbenchPanel();
          } else if (defName === '__open_kitchen__') {
            const kX = tileX * TILE_SIZE + TILE_SIZE / 2;
            const kY = tileY * TILE_SIZE + TILE_SIZE / 2;
            this.openKitchenPanel(kX, kY);
          } else {
            this.buildSystem.startBuild(defName, material, tileX, tileY, this.charStats, this.inventory);
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
      || this.buildAutoMoveTarget !== null;

    this.player.update(delta, suppressKeys);
    this.interaction.update(delta);

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
    });

    // ── 나무 재생 ──────────────────────────────────────────
    this.treeRegenTimer += delta;
    if (this.treeRegenTimer >= this.TREE_REGEN_CHECK_MS && this.clearedTrees.length > 0) {
      this.treeRegenTimer = 0;
      // Try to regenerate one tree
      const rng = new SeededRandom(`${this.seed}_regen_${this.gameTime.day}`);
      if (rng.next() < this.TREE_REGEN_RATE) {
        const idx = Math.floor(rng.next() * this.clearedTrees.length);
        const { tx, ty } = this.clearedTrees[idx];
        this.restoreTree(tx, ty);
        this.clearedTrees.splice(idx, 1);
      }
    }

    // Sleep text: world-space, follows player
    if (this.survival.isForcedSleep) {
      this.sleepText.setVisible(true)
        .setPosition(this.player.sprite.x - 12, this.player.sprite.y - 30);
    } else {
      this.sleepText.setVisible(false);
    }

    this.checkMapTransition();
    this.multiplayer.sync(
      time,
      this.player.sprite.x, this.player.sprite.y,
      this.mapX, this.mapY,
      this.player.dir,
      this.survival.hp,
    );
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
            this.buildSystem.startBuild(defName, material, tx, ty, this.charStats, this.inventory);
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
    this.scene.stop('UIScene');
    this.multiplayer.destroy();
    this.interaction?.destroy();
    this.animalMgr?.destroyAll();
    this.closeBuildPanel();
    this.closeWorkbenchPanel();
    this.closeKitchenPanel();
    this.combat?.destroy();
    this.commandQueueUI?.destroy();
  }

  // ── Map ──────────────────────────────────────────────────

  private loadMap(mx: number, my: number) {
    const key = `${mx},${my}`;
    const mapData = this.preloadedMaps.get(key) ?? this.mapGenerator.generateMap(mx, my);
    this.preloadedMaps.delete(key);
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
    this.otherPlayerSprites.forEach(s => s.destroy());
    this.otherPlayerSprites.clear();

    this.interaction?.setTiles(this.currentTiles);
    this.animalMgr?.spawnForMap(this.seed, mx, my, this.currentTiles, this, new Set());
    this.buildSystem?.clearAll();
  }

  private restoreTree(tx: number, ty: number): void {
    this.currentTiles[ty][tx] = TileType.Tree;
    this.tileRT.draw('tile_dirt', tx * TILE_SIZE, ty * TILE_SIZE);
    this.addTreeSprite(tx, ty);
  }

  /** 벌목/채굴 완료 후 타일 한 칸을 Dirt로 교체하고 RT 갱신 */
  private clearTile(tx: number, ty: number): void {
    const originalType = this.currentTiles[ty][tx];
    this.currentTiles[ty][tx] = TileType.Dirt;

    // Track cleared trees for regeneration
    if (originalType === TileType.Tree) {
      this.clearedTrees.push({ tx, ty });
      // Remove tree sprite
      const key = `${tx},${ty}`;
      this.treeSprites.get(key)?.destroy();
      this.treeSprites.delete(key);
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

  private checkMapTransition() {
    const { x: px, y: py } = this.player.sprite;
    const mw = MAP_W * TILE_SIZE, mh = MAP_H * TILE_SIZE;

    let nmx = this.mapX, nmy = this.mapY, npx = px, npy = py;

    if (px < 0)   { nmx--; npx = mw + px; }
    else if (px >= mw) { nmx++; npx = px - mw; }
    if (py < 0)   { nmy--; npy = mh + py; }
    else if (py >= mh) { nmy++; npy = py - mh; }

    if (nmx !== this.mapX || nmy !== this.mapY) {
      nmx = Phaser.Math.Clamp(nmx, 0, 9);
      nmy = Phaser.Math.Clamp(nmy, 0, 9);
      if (nmx !== this.mapX || nmy !== this.mapY) {
        this.mapX = nmx; this.mapY = nmy;
        this.player.sprite.setPosition(npx, npy);
        this.loadMap(this.mapX, this.mapY);
        this.preloadAdjacentMaps();
      }
    }
  }

  private preloadAdjacentMaps() {
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const mx = this.mapX + dx, my = this.mapY + dy;
      if (mx < 0 || mx > 9 || my < 0 || my > 9) continue;
      const key = `${mx},${my}`;
      if (!this.preloadedMaps.has(key)) {
        this.time.delayedCall(120, () => {
          if (!this.preloadedMaps.has(key))
            this.preloadedMaps.set(key, this.mapGenerator.generateMap(mx, my));
        });
      }
    }
  }

  // ── Multiplayer ──────────────────────────────────────────

  private updateOtherPlayers(players: RemotePlayer[]) {
    const seen = new Set<string>();
    for (const p of players) {
      if (p.mapX !== this.mapX || p.mapY !== this.mapY) continue;
      seen.add(p.id);
      let sprite = this.otherPlayerSprites.get(p.id);
      if (!sprite) {
        sprite = this.add.sprite(p.x, p.y, `char_${p.dir}`).setDepth(2).setAlpha(0.8);
        this.otherPlayerSprites.set(p.id, sprite);
      }
      sprite.setPosition(p.x, p.y);
      sprite.setTexture(`char_${p.dir}`);
    }
    // Remove stale sprites
    this.otherPlayerSprites.forEach((sprite, id) => {
      if (!seen.has(id)) { sprite.destroy(); this.otherPlayerSprites.delete(id); }
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

  private openWorkbenchPanel(): void {
    if (this.workbenchPanel) { this.closeWorkbenchPanel(); return; }

    const panel = document.createElement('div');
    panel.id = 'workbench-panel';
    panel.style.cssText = `
      position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
      width: 320px; background: rgba(10,15,25,0.93);
      border: 1px solid #664; border-radius: 6px; padding: 12px; z-index: 200;
      color: #eee; font: 12px monospace;
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-weight:bold;color:#e2b96f">🔨 작업대</span>
        <button id="wb-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div id="wb-tabs" style="display:flex;gap:4px;margin-bottom:8px;border-bottom:1px solid #334;padding-bottom:6px">
        <button class="wb-tab" data-tab="weapon" style="flex:1;padding:4px;background:#2a3a2a;color:#aaffaa;border:1px solid #446644;border-radius:3px;cursor:pointer;font:10px monospace">무기</button>
        <button class="wb-tab" data-tab="material" style="flex:1;padding:4px;background:#1a2030;color:#888;border:1px solid #334;border-radius:3px;cursor:pointer;font:10px monospace">재료</button>
        <button class="wb-tab" data-tab="tool" style="flex:1;padding:4px;background:#1a2030;color:#888;border:1px solid #334;border-radius:3px;cursor:pointer;font:10px monospace">도구</button>
      </div>
      <div id="wb-items" style="display:flex;flex-direction:column;gap:6px"></div>
      <div id="wb-status" style="font-size:10px;color:#88cc88;min-height:16px;margin-top:8px;text-align:center"></div>
    `;

    document.body.appendChild(panel);
    this.workbenchPanel = panel;

    panel.querySelector('#wb-close')!.addEventListener('click', () => this.closeWorkbenchPanel());

    // Tab click
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

    if (activeTab === 'weapon') {
      const craftableWeapons = WEAPONS.filter(w => w.recipe.length > 0);
      for (const weapon of craftableWeapons) {
        const canCraft = weapon.recipe.every(r => this.inventory.has(r.itemId, r.amount));
        const row = this.makeWorkbenchRow(
          weapon.name,
          weapon.recipe.map(r => `${r.itemId.replace('item_', '')}×${r.amount} (보유:${this.inventory.get(r.itemId)})`).join(', '),
          canCraft,
          () => {
            for (const r of weapon.recipe) this.inventory.remove(r.itemId, r.amount);
            const ms = this.charStats.buildTime(weapon.craftTimeSec);
            status.textContent = `제작 중… (${(ms / 1000).toFixed(1)}s)`;
            this.time.delayedCall(ms, () => {
              this.inventory.add(`item_${weapon.id}`, 1);
              this.survival.addAction(12);
              status.textContent = `${weapon.name} 제작 완료!`;
              this.refreshWorkbenchPanel(panel, activeTab);
            });
          },
        );
        container.appendChild(row);
      }
    } else {
      const recipes = CRAFTING_RECIPES.filter(r => r.category === activeTab);
      for (const recipe of recipes) {
        const canCraft = recipe.inputs.every(i => this.inventory.has(i.itemId, i.amount));
        const inputStr = recipe.inputs
          .map(i => `${i.itemId.replace('item_', '')}×${i.amount} (보유:${this.inventory.get(i.itemId)})`)
          .join(', ');
        const ms = this.charStats.craftTime * recipe.timeMultiplier;
        const row = this.makeWorkbenchRow(
          recipe.label,
          inputStr,
          canCraft,
          () => {
            for (const i of recipe.inputs) this.inventory.remove(i.itemId, i.amount);
            status.textContent = `제작 중… (${(ms / 1000).toFixed(1)}s)`;
            this.time.delayedCall(ms, () => {
              this.inventory.add(recipe.output.itemId, recipe.output.amount);
              this.survival.addAction(12);
              status.textContent = `${recipe.label} 제작 완료!`;
              this.refreshWorkbenchPanel(panel, activeTab);
            });
          },
        );
        container.appendChild(row);
      }
    }
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

  // ── isNearTable ──────────────────────────────────────────────────────────────

  isNearTable(): boolean {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    for (const struct of this.buildSystem.getAllStructures()) {
      if (struct.defName === 'table') {
        const wx = struct.tileX * TILE_SIZE + TILE_SIZE / 2;
        const wy = struct.tileY * TILE_SIZE + TILE_SIZE / 2;
        if (Math.hypot(px - wx, py - wy) <= 48) return true;
      }
    }
    return false;
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

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-weight:bold;color:#e2b96f">🍳 조리대</span>
        <button id="kitchen-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
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

    for (const recipe of COOKING_RECIPES) {
      const canCook = recipe.inputs.every(i => this.inventory.has(i.itemId, i.amount));
      const isCooking = this.cookingRecipe?.id === recipe.id;
      const holdCount = recipe.inputs.length > 0
        ? this.inventory.get(recipe.inputs[0].itemId)
        : 0;
      const timeSec = (this.charStats.cookTime * recipe.timeMultiplier / 1000).toFixed(1);

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
    this.cookingDuration = this.charStats.cookTime * recipe.timeMultiplier;
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
      this.survival.addAction(8);
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
}
