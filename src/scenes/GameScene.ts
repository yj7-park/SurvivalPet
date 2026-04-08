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
  private contextMenu: HTMLDivElement | null = null;

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
        this.toggleWorkbenchPanel();
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
    if (this.workbenchPanel) { this.closeWorkbenchPanel(); return; }
    this.openWorkbenchPanel();
  }

  private openWorkbenchPanel(): void {
    const panel = document.createElement('div');
    panel.id = 'workbench-panel';
    panel.style.cssText = `
      position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
      width: 300px; background: rgba(10,15,25,0.93);
      border: 1px solid #664; border-radius: 6px; padding: 12px; z-index: 200;
      color: #eee; font: 12px monospace;
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-weight:bold;color:#e2b96f">🔨 작업대</span>
        <button id="wb-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div id="wb-items" style="display:flex;flex-direction:column;gap:6px"></div>
      <div id="wb-status" style="font-size:10px;color:#88cc88;min-height:16px;margin-top:8px;text-align:center"></div>
    `;

    document.body.appendChild(panel);
    this.workbenchPanel = panel;

    panel.querySelector('#wb-close')!.addEventListener('click', () => this.closeWorkbenchPanel());
    this.refreshWorkbenchPanel(panel);
  }

  private refreshWorkbenchPanel(panel: HTMLDivElement): void {
    const container = panel.querySelector('#wb-items') as HTMLDivElement;
    const status    = panel.querySelector('#wb-status') as HTMLDivElement;
    container.innerHTML = '';

    const craftableWeapons = WEAPONS.filter(w => w.recipe.length > 0);

    for (const weapon of craftableWeapons) {
      const canCraft = weapon.recipe.every(r => this.inventory.has(r.itemId, r.amount));
      const row = document.createElement('div');
      row.style.cssText = `
        display:flex; align-items:center; justify-content:space-between;
        padding:6px 8px; background:${canCraft ? '#1a2a1a' : '#1a1a2a'};
        border:1px solid ${canCraft ? '#446644' : '#334'}; border-radius:4px;
      `;

      const recipeStr = weapon.recipe
        .map(r => `${r.itemId.replace('item_', '')}×${r.amount} (보유:${this.inventory.get(r.itemId)})`)
        .join(', ');

      row.innerHTML = `
        <div>
          <div style="color:${canCraft ? '#aaffaa' : '#888'};font-weight:bold">${weapon.name}</div>
          <div style="font-size:9px;color:#777;margin-top:2px">${recipeStr}</div>
        </div>
      `;

      const btn = document.createElement('button');
      btn.textContent = '제작';
      btn.style.cssText = `
        padding:4px 10px; background:${canCraft ? '#2a5a2a' : '#333'};
        color:${canCraft ? '#aaffaa' : '#666'}; border:1px solid ${canCraft ? '#446644' : '#444'};
        border-radius:3px; cursor:${canCraft ? 'pointer' : 'default'}; font:11px monospace;
      `;
      btn.disabled = !canCraft;

      if (canCraft) {
        btn.addEventListener('click', () => {
          // Deduct materials
          for (const r of weapon.recipe) {
            this.inventory.remove(r.itemId, r.amount);
          }
          const ms = this.charStats.buildTime(weapon.craftTimeSec);
          status.textContent = `제작 중… (${(ms / 1000).toFixed(1)}s)`;
          btn.disabled = true;
          this.time.delayedCall(ms, () => {
            this.inventory.add(`item_${weapon.id}`, 1);
            status.textContent = `${weapon.name} 제작 완료!`;
            this.refreshWorkbenchPanel(panel);
          });
        });
      }

      row.appendChild(btn);
      container.appendChild(row);
    }
  }

  private closeWorkbenchPanel(): void {
    this.workbenchPanel?.remove();
    this.workbenchPanel = null;
  }
}
