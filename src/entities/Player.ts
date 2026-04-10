import Phaser from 'phaser';
import { TileType, TILE_SIZE } from '../world/MapGenerator';
import { CharacterStats } from './CharacterStats';

const HITBOX = 10;    // 충돌 박스 반절 크기 (픽셀)
const HITBOX_IN = 1;  // 모서리 inset: 대각 벽 끼임 방지
const MAP_TILES = 100;

type Dir = 'down' | 'up' | 'left' | 'right';

export class Player {
  sprite: Phaser.GameObjects.Sprite;
  readonly stats: CharacterStats;
  dir: Dir = 'down';

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private tiles: TileType[][] | null = null;
  private buildingPassCb?: (tx: number, ty: number) => boolean;

  readonly appearance: number;

  constructor(scene: Phaser.Scene, x: number, y: number, stats: CharacterStats, appearance = 0) {
    this.stats = stats;
    this.appearance = appearance;
    this.sprite = scene.add.sprite(x, y, `char_${appearance}_down`).setDepth(1);
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  setTiles(tiles: TileType[][]) { this.tiles = tiles; }
  setBuildingPassCallback(cb: (tx: number, ty: number) => boolean): void { this.buildingPassCb = cb; }

  /** 외부(GameScene lock-on / auto-move)에서 타일 충돌을 적용해 이동 */
  moveWithCollision(dx: number, dy: number): void {
    if (dx !== 0 && this.canMoveX(dx)) this.sprite.x += dx;
    if (dy !== 0 && this.canMoveY(dy)) this.sprite.y += dy;
  }

  /** 현재 프레임에서 이동 키가 눌려있으면 true */
  isMovingByKeyboard(): boolean {
    const { left, right, up, down } = this.cursors;
    return left.isDown || right.isDown || up.isDown || down.isDown
      || this.wasd.left.isDown || this.wasd.right.isDown
      || this.wasd.up.isDown || this.wasd.down.isDown;
  }

  update(delta: number, isIncapacitated: boolean, externalSpeedMult = 1.0, touchVelocity?: { x: number; y: number }) {
    if (isIncapacitated) return;

    const dt = delta / 1000;
    // 물 위에 있으면 50% 속도
    const currentTile = this.getTileAt(this.sprite.x, this.sprite.y);
    const speedMult = (currentTile === TileType.Water ? 0.5 : 1.0) * externalSpeedMult;
    const speed = this.stats.moveSpeed * speedMult;
    const { left, right, up, down } = this.cursors;

    let vx = 0, vy = 0;
    if (left.isDown  || this.wasd.left.isDown)  vx -= speed;
    if (right.isDown || this.wasd.right.isDown) vx += speed;
    if (up.isDown    || this.wasd.up.isDown)    vy -= speed;
    if (down.isDown  || this.wasd.down.isDown)  vy += speed;

    // Touch joystick input
    if (touchVelocity && (touchVelocity.x !== 0 || touchVelocity.y !== 0)) {
      vx += touchVelocity.x * speed;
      vy += touchVelocity.y * speed;
    }

    if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }

    const dx = vx * dt;
    const dy = vy * dt;

    // 이동 방향의 leading edge만 체크 → 벽 슬라이딩 정상 동작
    if (dx !== 0 && this.canMoveX(dx)) this.sprite.x += dx;
    if (dy !== 0 && this.canMoveY(dy)) this.sprite.y += dy;

    // Direction sprite
    let newDir: Dir = this.dir;
    if (vy < 0) newDir = 'up';
    else if (vy > 0) newDir = 'down';
    else if (vx < 0) newDir = 'left';
    else if (vx > 0) newDir = 'right';

    if (newDir !== this.dir) {
      this.dir = newDir;
      this.sprite.setTexture(`char_${this.appearance}_${this.dir}`);
    }
  }

  /** 수평 이동 가능 여부: 이동 방향의 수직 엣지 2점만 체크 */
  private canMoveX(dx: number): boolean {
    const ex = this.sprite.x + dx + (dx > 0 ? HITBOX : -HITBOX);
    const cy = this.sprite.y;
    return this.isTilePassable(ex, cy - HITBOX + HITBOX_IN)
        && this.isTilePassable(ex, cy + HITBOX - HITBOX_IN);
  }

  /** 수직 이동 가능 여부: 이동 방향의 수평 엣지 2점만 체크 */
  private canMoveY(dy: number): boolean {
    const ey = this.sprite.y + dy + (dy > 0 ? HITBOX : -HITBOX);
    const cx = this.sprite.x;
    return this.isTilePassable(cx - HITBOX + HITBOX_IN, ey)
        && this.isTilePassable(cx + HITBOX - HITBOX_IN, ey);
  }

  /** 현재 위치의 타일 반환 */
  private getTileAt(px: number, py: number): TileType {
    if (!this.tiles) return TileType.Dirt;
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (tx < 0 || tx >= MAP_TILES || ty < 0 || ty >= MAP_TILES) return TileType.Dirt;
    return this.tiles[ty]?.[tx] ?? TileType.Dirt;
  }

  /** 픽셀 좌표가 통과 가능한 타일인지 확인 (물 포함, 건물 충돌 포함) */
  private isTilePassable(px: number, py: number): boolean {
    if (!this.tiles) return true;
    const tile = this.getTileAt(px, py);
    if (tile !== TileType.Dirt && tile !== TileType.Water) return false;
    if (this.buildingPassCb) {
      const tx = Math.floor(px / TILE_SIZE);
      const ty = Math.floor(py / TILE_SIZE);
      if (!this.buildingPassCb(tx, ty)) return false;
    }
    return true;
  }
}
