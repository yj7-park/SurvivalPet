import Phaser from 'phaser';
import { TileType, TILE_SIZE } from '../world/MapGenerator';
import { SeededRandom } from '../utils/seedRandom';

const ENEMY_HITBOX = 8;
const MAP_TILES = 100;

type EnemyState = 'AGGRESSIVE' | 'WANDER';

export interface EnemyConfig {
  str: number;
  agi: number;
  con: number;
  int: number;
  weapon: 'fists' | 'sword_wood' | 'sword_stone' | 'bow';
  items: Array<{ itemId: string; count: number }>;
}

export class Enemy {
  sprite: Phaser.GameObjects.Sprite;
  readonly config: EnemyConfig;
  readonly id: string;
  hp: number;
  maxHp: number;

  private state: EnemyState = 'AGGRESSIVE';
  private target: { x: number; y: number } | null = null;
  private stateTimer = 0;
  private attackTimer = 0;
  private hpBarTimer = 0;
  private hpBg: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;

  private readonly rng: SeededRandom;
  private tiles: TileType[][] | null = null;

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  get isDead(): boolean { return this.hp <= 0; }

  setTiles(tiles: TileType[][]): void {
    this.tiles = tiles;
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: EnemyConfig,
    id: string,
    rng: SeededRandom,
  ) {
    this.id = id;
    this.config = config;

    // 스탯 계산
    this.maxHp = 80 + config.con * 8;
    this.hp = this.maxHp;

    this.rng = rng;

    // 스프라이트
    this.sprite = scene.add.sprite(x, y, 'enemy_raider', 0).setDepth(4);
    if (scene.anims.exists('raider_idle')) {
      this.sprite.play('raider_idle');
    }

    // HP 바
    const w = 32;
    const h = 5;
    this.hpBg = scene.add
      .rectangle(x, y - TILE_SIZE, w, h, 0x333333)
      .setDepth(5)
      .setOrigin(0.5);
    this.hpFill = scene.add
      .rectangle(x, y - TILE_SIZE, w, h, 0xcc3333)
      .setDepth(6)
      .setOrigin(0.5);

    this.updateHPBar();
  }

  update(delta: number, playerX: number, playerY: number): void {
    // HP 바 업데이트
    this.sprite.setPosition(this.sprite.x, this.sprite.y);
    this.hpBg.setPosition(this.sprite.x, this.sprite.y - TILE_SIZE);
    this.hpFill.setPosition(this.sprite.x, this.sprite.y - TILE_SIZE);

    if (this.isDead) return;

    // 상태 머신
    const dx = playerX - this.sprite.x;
    const dy = playerY - this.sprite.y;
    const distPx = Math.hypot(dx, dy);
    const distTiles = distPx / TILE_SIZE;

    this.stateTimer += delta;

    switch (this.state) {
      case 'AGGRESSIVE': {
        // 플레이어 추격
        if (distTiles > 20) {
          // 플레이어가 너무 멀면 배회 상태로
          this.state = 'WANDER';
          this.stateTimer = 0;
          this.target = null;
        } else if (distTiles > 1) {
          // 이동
          const step = this.getMoveSpeed() * (delta / 1000);
          this.moveWithCollision(
            (dx / distPx) * step,
            (dy / distPx) * step
          );
          this.sprite.flipX = dx < 0;
          if (!this.sprite.anims.isPlaying || this.sprite.anims.currentAnim?.key === 'raider_idle') {
            if (this.sprite.anims.exists?.('raider_walk')) this.sprite.play('raider_walk', true);
          }
        } else {
          if (this.sprite.anims.currentAnim?.key === 'raider_walk') {
            if (this.sprite.anims.exists?.('raider_idle')) this.sprite.play('raider_idle', true);
          }
        }

        // 공격 쿨다운
        this.attackTimer -= delta;
        // 실제 공격은 GameScene에서 처리
        break;
      }

      case 'WANDER': {
        // 배회
        if (distTiles < 15) {
          // 플레이어 재발견
          this.state = 'AGGRESSIVE';
          this.stateTimer = 0;
          this.target = null;
        } else if (this.stateTimer > 5000) {
          // 5초마다 새로운 목표
          this.stateTimer = 0;
          const angle = this.rng.next() * Math.PI * 2;
          const dist = 3 + this.rng.next() * 4; // 3~7 타일
          this.target = {
            x: this.sprite.x + Math.cos(angle) * dist * TILE_SIZE,
            y: this.sprite.y + Math.sin(angle) * dist * TILE_SIZE,
          };
        }

        if (this.target) {
          const tdx = this.target.x - this.sprite.x;
          const tdy = this.target.y - this.sprite.y;
          const tdist = Math.hypot(tdx, tdy);

          if (tdist > 4) {
            const step = (this.getMoveSpeed() * 0.5) * (delta / 1000);
            this.moveWithCollision(
              (tdx / tdist) * step,
              (tdy / tdist) * step
            );
          } else {
            this.target = null;
          }
        }
        break;
      }
    }

    this.hpBarTimer += delta;
    if (this.hpBarTimer > 3000) {
      this.hpBg.setVisible(false);
      this.hpFill.setVisible(false);
    }
  }

  private getMoveSpeed(): number {
    return 120 + (this.config.agi - 5) * 12;
  }

  private moveWithCollision(dx: number, dy: number): void {
    const newX = this.sprite.x + dx;
    const newY = this.sprite.y + dy;

    // 간단한 타일 충돌 체크
    if (this.tiles) {
      const tx = Math.floor(newX / TILE_SIZE);
      const ty = Math.floor(newY / TILE_SIZE);

      if (tx >= 0 && tx < MAP_TILES && ty >= 0 && ty < MAP_TILES) {
        const tileType = this.tiles[ty]?.[tx];
        if (tileType !== TileType.Water && tileType !== TileType.Rock) {
          this.sprite.setPosition(newX, newY);
          return;
        }
      }
    }

    // 충돌이 없으면 이동
    this.sprite.setPosition(newX, newY);
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    if (this.hp < 0) this.hp = 0;

    this.hpBarTimer = 0;
    this.hpBg.setVisible(true);
    this.hpFill.setVisible(true);

    this.updateHPBar();

    if (this.isDead) {
      this.die();
    }
  }

  private updateHPBar(): void {
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpFill.setSize(32 * ratio, 5);
  }

  private die(): void {
    this.sprite.setAlpha(0.7);
    // 페이드 아웃은 GameScene에서 처리
  }

  destroy(): void {
    this.sprite.destroy();
    this.hpBg.destroy();
    this.hpFill.destroy();
  }

  canAttack(): boolean {
    return this.attackTimer <= 0 && !this.isDead;
  }

  resetAttackTimer(): void {
    // 무기 기본 쿨다운: fists 2.0s, sword_wood 1.5s, sword_stone 1.5s, bow 2.0s
    const baseCooldown: Record<string, number> = {
      fists: 2000,
      sword_wood: 1500,
      sword_stone: 1500,
      bow: 2000,
    };
    const base = baseCooldown[this.config.weapon] || 2000;
    // AGI 기반 보정
    const cooldown = Math.max(
      600,
      base - (this.config.agi - 5) * 100
    );
    this.attackTimer = cooldown;
  }

  getState(): EnemyState {
    return this.state;
  }
}
