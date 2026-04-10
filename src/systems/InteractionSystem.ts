import Phaser from 'phaser';
import { TileType, TILE_SIZE } from '../world/MapGenerator';
import { Player } from '../entities/Player';
import { CharacterStats } from '../entities/CharacterStats';
import { Inventory } from './Inventory';
import { AnimalManager } from './AnimalManager';
import { Animal } from '../entities/Animal';
import { SeededRandom } from '../utils/seedRandom';
import { SurvivalStats } from './SurvivalStats';
import { CommandQueue, Command } from './CommandQueue';

const INTERACT_RANGE = 1.5 * TILE_SIZE; // 48px — 가까이 붙어서 작업

type InteractionTarget =
  | { kind: 'tile'; tileX: number; tileY: number; tileType: TileType; worldX: number; worldY: number }
  | { kind: 'animal'; animal: Animal };

export class InteractionSystem {
  private tiles: TileType[][] = [];
  private tooltipDiv: HTMLDivElement;
  private progressBg!: Phaser.GameObjects.Rectangle;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressLabel!: Phaser.GameObjects.Text;

  private activeTarget: InteractionTarget | null = null;
  private progressMs = 0;
  private totalMs = 0;

  private attackCooldown = 0;

  // auto-move toward target
  private autoMove: { worldX: number; worldY: number } | null = null;
  private pendingInteraction: (() => void) | null = null;

  // callbacks
  private onInteractionComplete: (() => void) | null = null;
  private onResourceGathered: ((type: 'woodcutting' | 'mining' | 'fishing') => void) | null = null;
  private onMiningTick: ((ratio: number, tx: number, ty: number) => void) | null = null;

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
    private stats: CharacterStats,
    private survival: SurvivalStats,
    private inventory: Inventory,
    private animalMgr: AnimalManager,
    private rng: SeededRandom,
    private onTileCleared?: (tileX: number, tileY: number) => void,
  ) {
    this.tooltipDiv = document.createElement('div');
    this.tooltipDiv.style.cssText = `
      position: fixed; display: none; pointer-events: none; z-index: 200;
      background: rgba(0,0,0,0.75); color: #eee; font: 11px monospace;
      padding: 4px 8px; border-radius: 3px; border: 1px solid #666;
    `;
    document.body.appendChild(this.tooltipDiv);

    this.progressBg   = scene.add.rectangle(0, 0, 32, 5, 0x333333).setDepth(2000).setVisible(false).setOrigin(0.5);
    this.progressFill = scene.add.rectangle(0, 0, 32, 5, 0x44aaff).setDepth(2001).setVisible(false).setOrigin(0.5);
    this.progressLabel = scene.add.text(0, 0, '', {
      fontSize: '9px', color: '#ffffff', fontFamily: 'monospace',
    }).setDepth(2002).setVisible(false).setOrigin(0.5);
  }

  setTiles(tiles: TileType[][]): void { this.tiles = tiles; }
  hasActiveInteraction(): boolean { return this.activeTarget !== null; }
  getActiveGatherType(): 'woodcut' | 'mine' | 'fish' | null {
    if (!this.activeTarget || this.activeTarget.kind !== 'tile') return null;
    const t = this.activeTarget.tileType;
    if (t === TileType.Tree)  return 'woodcut';
    if (t === TileType.Rock)  return 'mine';
    if (t === TileType.Water) return 'fish';
    return null;
  }
  setOnInteractionComplete(cb: (() => void) | null): void { this.onInteractionComplete = cb; }
  setOnResourceGathered(cb: (type: 'woodcutting' | 'mining' | 'fishing') => void): void { this.onResourceGathered = cb; }
  setOnMiningTick(cb: ((ratio: number, tx: number, ty: number) => void) | null): void { this.onMiningTick = cb; }

  /** Called from GameScene.update() on Phaser pointer-move event */
  onPointerMove(worldX: number, worldY: number, screenX: number, screenY: number): void {
    const label = this.getHoverLabel(worldX, worldY);
    if (label) {
      this.tooltipDiv.style.display = 'block';
      this.tooltipDiv.style.left = `${screenX + 14}px`;
      this.tooltipDiv.style.top  = `${screenY - 10}px`;
      this.tooltipDiv.textContent = label;
    } else {
      this.tooltipDiv.style.display = 'none';
    }
  }

  /** Called on left click */
  onPointerDown(worldX: number, worldY: number, isShiftHeld: boolean = false, commandQueue?: CommandQueue): void {
    if (this.survival.isIncapacitated) return;

    // Check animal first
    const animal = this.animalMgr.getHovered(worldX, worldY);
    if (animal) {
      if (isShiftHeld && commandQueue) {
        // Add attack command to queue
        const cmd: Command = { id: '', type: 'attack', targetId: animal.id };
        if (!commandQueue.add(cmd)) {
          console.warn('큐가 가득 찼습니다');
        }
      } else {
        this.startOrQueueInteraction({ kind: 'animal', animal }, worldX, worldY);
      }
      return;
    }

    // Check tile
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    if (tx < 0 || tx >= 100 || ty < 0 || ty >= 100) return;
    const tileType = this.tiles[ty]?.[tx];
    if (!tileType || tileType === TileType.Dirt) return;

    if (isShiftHeld && commandQueue) {
      // Add tile interaction command to queue
      const cmd: Command = {
        id: '',
        type: tileType === TileType.Tree ? 'chop' : tileType === TileType.Rock ? 'mine' : 'fish',
        targetX: tx,
        targetY: ty,
      };
      if (!commandQueue.add(cmd)) {
        console.warn('큐가 가득 찼습니다');
      }
    } else {
      this.startOrQueueInteraction(
        { kind: 'tile', tileX: tx, tileY: ty, tileType, worldX: tx * TILE_SIZE + TILE_SIZE / 2, worldY: ty * TILE_SIZE + TILE_SIZE / 2 },
        tx * TILE_SIZE + TILE_SIZE / 2,
        ty * TILE_SIZE + TILE_SIZE / 2,
      );
    }
  }

  private startOrQueueInteraction(target: InteractionTarget, targetWorldX: number, targetWorldY: number): void {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const dist = Math.hypot(px - targetWorldX, py - targetWorldY);

    if (dist <= INTERACT_RANGE) {
      this.beginInteraction(target);
    } else {
      // Auto-move toward target
      this.autoMove = { worldX: targetWorldX, worldY: targetWorldY };
      this.pendingInteraction = () => this.beginInteraction(target);
      this.cancelProgress();
    }
  }

  private beginInteraction(target: InteractionTarget): void {
    this.autoMove = null;
    this.pendingInteraction = null;

    if (target.kind === 'animal') {
      // immediate attack (if cooldown done)
      if (this.attackCooldown <= 0) {
        const drops = this.animalMgr.attackAnimal(
          target.animal,
          this.stats.attackDamage,
          this.player.sprite.x,
          this.player.sprite.y,
          this.rng,
        );
        drops.forEach(d => { this.inventory.add(d.itemKey, d.count); });
        this.attackCooldown = this.stats.attackCooldown;
        // action recovery handled by kill callback in CombatSystem/GameScene
      }
      return;
    }

    // tile interaction
    const { tileType } = target;
    let durationMs = 0;
    if (tileType === TileType.Tree)  durationMs = this.stats.logTimeMs;
    if (tileType === TileType.Rock)  durationMs = this.stats.mineTimeMs;
    if (tileType === TileType.Water) durationMs = this.stats.fishTimeMs;
    if (durationMs <= 0) return;

    this.activeTarget = target;
    this.progressMs = 0;
    this.totalMs = durationMs;

    const wx = (target as { worldX: number }).worldX;
    const wy = (target as { worldY: number }).worldY;
    this.progressBg.setPosition(wx, wy - TILE_SIZE).setVisible(true);
    this.progressFill.setPosition(wx, wy - TILE_SIZE).setVisible(true);
    this.progressLabel.setPosition(wx, wy - TILE_SIZE - 10).setVisible(true);
  }

  update(delta: number): boolean {
    // returns true if player is auto-moving this frame
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    // Auto-move toward pending target
    if (this.autoMove) {
      const dx = this.autoMove.worldX - this.player.sprite.x;
      const dy = this.autoMove.worldY - this.player.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= INTERACT_RANGE) {
        this.pendingInteraction?.();
        this.autoMove = null;
        this.pendingInteraction = null;
      }
      // (actual movement handled by returning true — GameScene moves player toward autoMove)
      return true;
    }

    if (!this.activeTarget) return false;

    // Cancel if player moved away
    const target = this.activeTarget;
    const twx = target.kind === 'tile' ? target.worldX : target.animal.x;
    const twy = target.kind === 'tile' ? target.worldY : target.animal.y;
    const dist = Math.hypot(this.player.sprite.x - twx, this.player.sprite.y - twy);
    if (dist > INTERACT_RANGE + 4) {
      this.cancelProgress();
      return false;
    }

    this.progressMs += delta;
    const ratio = Math.min(1, this.progressMs / this.totalMs);
    const remaining = Math.ceil((this.totalMs - this.progressMs) / 1000);

    // Notify mining tick for crack visuals
    if (this.onMiningTick && target.kind === 'tile' && target.tileType === TileType.Rock) {
      this.onMiningTick(ratio, target.tileX, target.tileY);
    }

    this.progressFill.setSize(32 * ratio, 5);
    this.progressLabel.setText(`${remaining}s`);
    this.progressBg.setPosition(twx, twy - TILE_SIZE);
    this.progressFill.setPosition(twx, twy - TILE_SIZE);
    this.progressLabel.setPosition(twx, twy - TILE_SIZE - 10);

    if (ratio >= 1) {
      this.completeInteraction();
    }

    return false;
  }

  getAutoMoveTarget(): { worldX: number; worldY: number } | null {
    return this.autoMove;
  }

  cancelOnMove(): void {
    if (this.autoMove) {
      this.autoMove = null;
      this.pendingInteraction = null;
    }
    if (this.activeTarget) {
      this.cancelProgress();
    }
  }

  private completeInteraction(): void {
    if (!this.activeTarget || this.activeTarget.kind === 'animal') return;
    const { tileType, tileX, tileY } = this.activeTarget;

    if (tileType === TileType.Tree) {
      this.inventory.add('item_wood', 20);
      this.onTileCleared?.(tileX, tileY);
      this.onResourceGathered?.('woodcutting');
    } else if (tileType === TileType.Rock) {
      this.inventory.add('item_stone', 10);
      this.onTileCleared?.(tileX, tileY);
      this.onResourceGathered?.('mining');
    } else if (tileType === TileType.Water) {
      const success = this.rng.next() < this.stats.fishRate;
      if (success) this.inventory.add('item_fish', 1);
      // 낚시는 성공·실패 무관 action 회복 → onResourceGathered 항상 호출
      this.onResourceGathered?.('fishing');
    }

    this.cancelProgress();
    this.onInteractionComplete?.();
  }

  private cancelProgress(): void {
    this.activeTarget = null;
    this.progressMs = 0;
    this.totalMs = 0;
    this.progressBg.setVisible(false);
    this.progressFill.setVisible(false);
    this.progressLabel.setVisible(false);
    this.onMiningTick?.(-1, 0, 0); // signal to hide cracks (ratio -1)
  }

  private getHoverLabel(worldX: number, worldY: number): string | null {
    // Animal
    const animal = this.animalMgr.getHovered(worldX, worldY);
    if (animal) {
      const inRange = Math.hypot(this.player.sprite.x - animal.x, this.player.sprite.y - animal.y) <= INTERACT_RANGE;
      const cd = this.attackCooldown > 0 ? ` (${(this.attackCooldown / 1000).toFixed(1)}s)` : '';
      return `⚔ ${animal.config.type === 'deer' ? '사슴' : '호랑이'} 공격하기${inRange ? cd : ' (이동 후)'}`;
    }

    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    if (tx < 0 || tx >= 100 || ty < 0 || ty >= 100) return null;
    const tile = this.tiles[ty]?.[tx];

    const twx = tx * TILE_SIZE + TILE_SIZE / 2;
    const twy = ty * TILE_SIZE + TILE_SIZE / 2;
    const inRange = Math.hypot(this.player.sprite.x - twx, this.player.sprite.y - twy) <= INTERACT_RANGE;
    const suffix = inRange ? '' : ' (이동 후)';

    if (tile === TileType.Tree)  return `🪓 벌목하기${suffix}`;
    if (tile === TileType.Rock)  return `⛏ 채굴하기${suffix}`;
    if (tile === TileType.Water) return `🎣 낚시하기${suffix}`;
    return null;
  }

  destroy(): void {
    this.tooltipDiv.remove();
    this.progressBg.destroy();
    this.progressFill.destroy();
    this.progressLabel.destroy();
  }
}
