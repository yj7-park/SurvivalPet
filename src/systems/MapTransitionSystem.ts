import Phaser from 'phaser';

const MAP_PX = 100 * 32; // 3200px per map

export type ExitDirection = 'north' | 'south' | 'east' | 'west';

export class MapTransitionSystem {
  private transitioning = false;
  private edgeBlocked = false; // debounce edge message

  constructor(
    private scene: Phaser.Scene,
    private onTransition: (newMapX: number, newMapY: number, newPx: number, newPy: number) => void,
    private onEdgeBlocked: (msg: string) => void,
  ) {}

  get isTransitioning(): boolean { return this.transitioning; }

  /** Call every frame. Returns true if a transition was triggered. */
  check(px: number, py: number, mapX: number, mapY: number): boolean {
    if (this.transitioning) return false;

    let nmx = mapX, nmy = mapY, npx = px, npy = py;
    let exited = false;

    // X axis first (east/west take priority at corners)
    if (px < 0) {
      if (mapX === 0) { this.triggerEdgeBlock(); return false; }
      nmx = mapX - 1; npx = MAP_PX + px; exited = true;
    } else if (px >= MAP_PX) {
      if (mapX === 9) { this.triggerEdgeBlock(); return false; }
      nmx = mapX + 1; npx = px - MAP_PX; exited = true;
    }

    if (py < 0) {
      if (mapY === 0) { this.triggerEdgeBlock(); return false; }
      nmy = mapY - 1; npy = MAP_PX + py; exited = true;
    } else if (py >= MAP_PX) {
      if (mapY === 9) { this.triggerEdgeBlock(); return false; }
      nmy = mapY + 1; npy = py - MAP_PX; exited = true;
    }

    if (!exited) {
      this.edgeBlocked = false; // reset once player moves away from edge
      return false;
    }

    this.transitioning = true;
    this.scene.cameras.main.fadeOut(300, 0, 0, 0);
    this.scene.cameras.main.once('camerafadeoutcomplete', () => {
      this.onTransition(nmx, nmy, npx, npy);
      this.scene.cameras.main.fadeIn(300, 0, 0, 0);
      this.scene.cameras.main.once('camerafadeincomplete', () => {
        this.transitioning = false;
      });
    });
    return true;
  }

  private triggerEdgeBlock(): void {
    if (!this.edgeBlocked) {
      this.edgeBlocked = true;
      this.onEdgeBlocked('더 이상 갈 수 없습니다');
    }
  }
}
