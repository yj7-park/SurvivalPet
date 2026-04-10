import Phaser from 'phaser';
import type { RemotePlayerState } from '../systems/MultiplayerSystem';
import { assignPlayerColor } from './PlayerNameTag';

/**
 * 화면 밖 플레이어를 화면 가장자리 화살표로 표시.
 * scrollFactor(0) 오버레이 위에 렌더링.
 */
export class RemotePlayerIndicator {
  private arrows = new Map<string, Phaser.GameObjects.Container>();

  constructor(private scene: Phaser.Scene) {}

  update(remoteStates: RemotePlayerState[], localMapX: number, localMapY: number): void {
    const cam = this.scene.cameras.main;
    const camBounds = cam.worldView;
    const seen = new Set<string>();

    for (const state of remoteStates) {
      if (state.mapX !== localMapX || state.mapY !== localMapY) continue;
      const wx = state.renderX, wy = state.renderY;
      seen.add(state.id);

      const inView = camBounds.contains(wx, wy);
      if (inView) {
        this.hideArrow(state.id);
        continue;
      }

      const cx = camBounds.x + camBounds.width  / 2;
      const cy = camBounds.y + camBounds.height / 2;
      const angle = Math.atan2(wy - cy, wx - cx);
      const edge  = this.getEdgePosition(angle, cam);
      const color = state.playerColor ?? assignPlayerColor(state.id);
      this.showArrow(state.id, edge, angle, color);
    }

    // 사라진 플레이어 화살표 제거
    this.arrows.forEach((_, id) => {
      if (!seen.has(id)) this.hideArrow(id);
    });
  }

  private showArrow(id: string, pos: { x: number; y: number }, angle: number, color: number): void {
    let c = this.arrows.get(id);
    if (!c) {
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(color, 0.85);
      gfx.fillTriangle(0, -8, -6, 8, 6, 8);
      gfx.fillStyle(0x000000, 0.5);
      gfx.fillCircle(0, 4, 4);

      c = this.scene.add.container(pos.x, pos.y, [gfx]);
      c.setDepth(95).setScrollFactor(0);
      this.scene.tweens.add({
        targets: c, alpha: { from: 1, to: 0.4 },
        duration: 800, yoyo: true, repeat: -1,
      });
      this.arrows.set(id, c);
    }
    c.setPosition(pos.x, pos.y).setRotation(angle + Math.PI / 2).setVisible(true);
  }

  private hideArrow(id: string): void {
    const c = this.arrows.get(id);
    if (c) {
      c.setVisible(false);
    }
  }

  private getEdgePosition(angle: number, cam: Phaser.Cameras.Scene2D.Camera): { x: number; y: number } {
    const margin = 24;
    const W = cam.width, H = cam.height;
    const cx = W / 2, cy = H / 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);

    const tRight  = (W  - margin - cx) / (cos || 0.0001);
    const tLeft   = (margin - cx)       / (cos || 0.0001);
    const tBottom = (H  - margin - cy) / (sin || 0.0001);
    const tTop    = (margin - cy)       / (sin || 0.0001);

    const candidates = [tRight, tLeft, tBottom, tTop].filter(t => t > 0);
    const t = Math.min(...candidates);

    return {
      x: Phaser.Math.Clamp(cx + cos * t, margin, W - margin),
      y: Phaser.Math.Clamp(cy + sin * t, margin, H - margin),
    };
  }

  destroy(): void {
    this.arrows.forEach(c => c.destroy());
    this.arrows.clear();
  }
}

/**
 * 아군이 피해를 받을 때 방향 플래시 표시.
 */
export function showAllyDamageFlash(scene: Phaser.Scene, direction: 'north' | 'south' | 'east' | 'west'): void {
  const W = scene.cameras.main.width;
  const H = scene.cameras.main.height;

  const gfx = scene.add.graphics().setScrollFactor(0).setDepth(105);
  gfx.fillStyle(0xff2020, 0);

  const rects: Record<string, [number, number, number, number]> = {
    north: [0,      0,      W,  40],
    south: [0,      H - 40, W,  40],
    east:  [W - 40, 0,      40, H],
    west:  [0,      0,      40, H],
  };
  const [rx, ry, rw, rh] = rects[direction];
  gfx.fillRect(rx, ry, rw, rh);

  scene.tweens.add({
    targets: gfx,
    alpha: { from: 0, to: 0.5 },
    duration: 150,
    yoyo: true,
    onComplete: () => gfx.destroy(),
  });
}

/**
 * 입장 위치 팝업.
 */
export function showJoinLocationPopup(scene: Phaser.Scene, worldX: number, worldY: number, name: string): void {
  const popup = scene.add.text(worldX, worldY - 56, `${name} 입장`, {
    fontSize: '10px', fontFamily: 'Courier New',
    color: '#aaffaa', stroke: '#000000', strokeThickness: 2,
  }).setDepth(91).setOrigin(0.5);

  scene.tweens.add({
    targets: popup,
    y: popup.y - 20,
    alpha: { from: 1, to: 0 },
    duration: 2000,
    ease: 'Quad.easeOut',
    onComplete: () => popup.destroy(),
  });
}
