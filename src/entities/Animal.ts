import Phaser from 'phaser';
import { TileType, TILE_SIZE } from '../world/MapGenerator';
import { SeededRandom } from '../utils/seedRandom';

const ANIMAL_HITBOX = 8;  // 충돌 박스 반절 (픽셀)
const MAP_TILES = 100;

type AnimalState = 'IDLE' | 'WANDER' | 'FLEE' | 'AGGRESSIVE';
export type AnimalType = 'deer' | 'tiger';

export interface AnimalDrop {
  itemKey: string;
  minCount: number;
  maxCount: number;
  chance: number;
}

export interface AnimalConfig {
  type: AnimalType;
  maxHp: number;
  wanderSpeed: number;
  actionSpeed: number;
  attackDamage: number;
  attackCooldownMs: number;
  attackRangePx: number;
  homeRadiusTiles: number;
  giveUpTiles: number;
  drops: AnimalDrop[];
}

export const DEER_CONFIG: AnimalConfig = {
  type: 'deer', maxHp: 40,
  wanderSpeed: 60, actionSpeed: 140,
  attackDamage: 0, attackCooldownMs: 99999, attackRangePx: 0,
  homeRadiusTiles: 5, giveUpTiles: 999,
  drops: [
    { itemKey: 'item_raw_meat', minCount: 2, maxCount: 4, chance: 1.0 },
    { itemKey: 'item_hide',     minCount: 1, maxCount: 1, chance: 0.7 },
  ],
};

export const TIGER_CONFIG: AnimalConfig = {
  type: 'tiger', maxHp: 120,
  wanderSpeed: 70, actionSpeed: 150,
  attackDamage: 15, attackCooldownMs: 1500, attackRangePx: 1.5 * TILE_SIZE,
  homeRadiusTiles: 8, giveUpTiles: 15,
  drops: [
    { itemKey: 'item_raw_meat',    minCount: 3, maxCount: 5, chance: 1.0 },
    { itemKey: 'item_hide',        minCount: 2, maxCount: 2, chance: 1.0 },
    { itemKey: 'item_tiger_fang',  minCount: 1, maxCount: 1, chance: 0.4 },
  ],
};

export class Animal {
  sprite: Phaser.GameObjects.Sprite;
  readonly config: AnimalConfig;
  readonly id: string;
  hp: number;

  private state: AnimalState = 'IDLE';
  private homePoint: { x: number; y: number };
  private target: { x: number; y: number } | null = null;
  private stateTimer = 0;
  private attackTimer = 0;
  private animTimer = 0;
  private animFrame = 0;
  private hpBarTimer = 0;

  private hpBg: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;

  private readonly rng: SeededRandom;
  private tiles: TileType[][] | null = null;

  setTiles(tiles: TileType[][]): void { this.tiles = tiles; }

  constructor(scene: Phaser.Scene, x: number, y: number, config: AnimalConfig, id: string, rng: SeededRandom) {
    this.id = id;
    this.config = config;
    this.hp = config.maxHp;
    this.homePoint = { x, y };
    this.rng = rng;

    this.sprite = scene.add.sprite(x, y, `animal_${config.type}_idle`).setDepth(1);

    this.hpBg   = scene.add.rectangle(x, y - 22, 32, 4, 0x333333).setDepth(3).setVisible(false).setOrigin(0.5, 0.5);
    this.hpFill = scene.add.rectangle(x - 16, y - 22, 32, 4, 0x44ee44).setDepth(4).setVisible(false).setOrigin(0, 0.5);

    this.stateTimer = this.rng.float(2000, 5000);
  }

  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get isDead() { return this.hp <= 0; }

  onHit(attackerX: number, attackerY: number, damage: number): void {
    this.hp = Math.max(0, this.hp - damage);
    this.hpBarTimer = 3000;
    if (this.isDead) return;

    if (this.config.type === 'deer') {
      this.state = 'FLEE';
      const angle = Math.atan2(this.sprite.y - attackerY, this.sprite.x - attackerX);
      const dist = this.rng.float(8, 12) * TILE_SIZE;
      this.target = {
        x: this.sprite.x + Math.cos(angle) * dist,
        y: this.sprite.y + Math.sin(angle) * dist,
      };
    } else {
      this.state = 'AGGRESSIVE';
      this.target = { x: attackerX, y: attackerY };
    }
  }

  update(delta: number, playerX: number, playerY: number, onAttackPlayer: (dmg: number) => void): void {
    if (this.isDead) return;

    this.stateTimer  -= delta;
    this.attackTimer -= delta;
    this.animTimer   -= delta;
    this.hpBarTimer   = Math.max(0, this.hpBarTimer - delta);

    // HP bar
    const showHp = this.hpBarTimer > 0;
    this.hpBg.setVisible(showHp);
    this.hpFill.setVisible(showHp);
    if (showHp) {
      const ratio = this.hp / this.config.maxHp;
      this.hpBg.setPosition(this.sprite.x, this.sprite.y - 22);
      this.hpFill.setPosition(this.sprite.x - 16, this.sprite.y - 22);
      this.hpFill.setSize(32 * ratio, 4);
      this.hpFill.setFillStyle(ratio > 0.8 ? 0x44ee44 : ratio > 0.4 ? 0xeecc00 : 0xee4444);
    }

    switch (this.state) {
      case 'IDLE':       this.updateIdle(delta); break;
      case 'WANDER':     this.updateWander(delta); break;
      case 'FLEE':       this.updateFlee(delta); break;
      case 'AGGRESSIVE': this.updateAggressive(delta, playerX, playerY, onAttackPlayer); break;
    }

    // Walk animation (toggle every 250ms)
    if (this.animTimer <= 0) {
      this.animTimer = 250;
      this.animFrame = 1 - this.animFrame;
      const moving = this.state === 'WANDER' || this.state === 'FLEE' || this.state === 'AGGRESSIVE';
      const suffix = moving && this.animFrame === 1 ? 'walk' : 'idle';
      const isAttacking = this.state === 'AGGRESSIVE' && this.attackTimer > 0 && this.config.type === 'tiger';
      this.sprite.setTexture(`animal_${this.config.type}_${isAttacking ? 'attack' : suffix}`);
    }
  }

  private updateIdle(delta: number): void {
    void delta;
    if (this.stateTimer <= 0) {
      this.state = 'WANDER';
      const angle = this.rng.float(0, Math.PI * 2);
      const dist  = this.rng.float(1, this.config.homeRadiusTiles) * TILE_SIZE;
      this.target = {
        x: this.homePoint.x + Math.cos(angle) * dist,
        y: this.homePoint.y + Math.sin(angle) * dist,
      };
    }
  }

  private updateWander(delta: number): void {
    void delta;
    if (!this.target) { this.toIdle(); return; }
    if (this.moveToward(this.target.x, this.target.y, this.config.wanderSpeed, delta)) {
      this.toIdle();
    }
  }

  private updateFlee(delta: number): void {
    void delta;
    if (!this.target) { this.toIdleAtCurrent(); return; }
    if (this.moveToward(this.target.x, this.target.y, this.config.actionSpeed, delta)) {
      this.toIdleAtCurrent();
    }
  }

  private updateAggressive(delta: number, playerX: number, playerY: number, onAttack: (dmg: number) => void): void {
    void delta;
    this.target = { x: playerX, y: playerY };

    const homeDist = Math.hypot(playerX - this.homePoint.x, playerY - this.homePoint.y);
    if (homeDist > this.config.giveUpTiles * TILE_SIZE) {
      this.state = 'WANDER';
      this.target = null;
      return;
    }

    const dist = Math.hypot(playerX - this.sprite.x, playerY - this.sprite.y);
    if (dist <= this.config.attackRangePx) {
      if (this.attackTimer <= 0) {
        this.attackTimer = this.config.attackCooldownMs;
        onAttack(this.config.attackDamage);
      }
    } else {
      this.moveToward(playerX, playerY, this.config.actionSpeed, delta);
    }
  }

  private moveToward(tx: number, ty: number, speed: number, delta: number): boolean {
    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    // 물 위에 있으면 50% 속도
    const waterMult = this.getTileAt(this.sprite.x, this.sprite.y) === TileType.Water ? 0.5 : 1.0;
    const step = speed * waterMult * (delta / 1000);
    if (dist <= step) {
      this.sprite.setPosition(tx, ty);
      return true;
    }
    const nx = (dx / dist) * step;
    const ny = (dy / dist) * step;
    if (nx !== 0 && this.canMoveX(nx)) this.sprite.x += nx;
    if (ny !== 0 && this.canMoveY(ny)) this.sprite.y += ny;
    this.sprite.setFlipX(dx < 0);
    return false;
  }

  private canMoveX(dx: number): boolean {
    const ex = this.sprite.x + dx + (dx > 0 ? ANIMAL_HITBOX : -ANIMAL_HITBOX);
    const cy = this.sprite.y;
    return this.isTilePassable(ex, cy - ANIMAL_HITBOX + 1)
        && this.isTilePassable(ex, cy + ANIMAL_HITBOX - 1);
  }

  private canMoveY(dy: number): boolean {
    const ey = this.sprite.y + dy + (dy > 0 ? ANIMAL_HITBOX : -ANIMAL_HITBOX);
    const cx = this.sprite.x;
    return this.isTilePassable(cx - ANIMAL_HITBOX + 1, ey)
        && this.isTilePassable(cx + ANIMAL_HITBOX - 1, ey);
  }

  private isTilePassable(px: number, py: number): boolean {
    const tile = this.getTileAt(px, py);
    return tile === TileType.Dirt || tile === TileType.Water;
  }

  private getTileAt(px: number, py: number): TileType {
    if (!this.tiles) return TileType.Dirt;
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (tx < 0 || tx >= MAP_TILES || ty < 0 || ty >= MAP_TILES) return TileType.Dirt;
    return this.tiles[ty]?.[tx] ?? TileType.Dirt;
  }

  private toIdle(): void {
    this.state = 'IDLE';
    this.stateTimer = this.rng.float(2000, 5000);
    this.target = null;
  }

  private toIdleAtCurrent(): void {
    this.homePoint = { x: this.sprite.x, y: this.sprite.y };
    this.toIdle();
  }

  rollDrops(rng: SeededRandom): { itemKey: string; count: number }[] {
    return this.config.drops
      .filter(d => rng.next() < d.chance)
      .map(d => ({ itemKey: d.itemKey, count: rng.int(d.minCount, d.maxCount) }));
  }

  destroy(): void {
    this.sprite.destroy();
    this.hpBg.destroy();
    this.hpFill.destroy();
  }
}
