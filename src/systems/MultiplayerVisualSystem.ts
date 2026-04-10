import Phaser from 'phaser';
import type { RemotePlayerState } from './MultiplayerSystem';
import { PlayerNameTag, assignPlayerColor } from '../ui/PlayerNameTag';
import { RemotePlayerIndicator, showJoinLocationPopup } from '../ui/RemotePlayerIndicator';
import { RespawnEffect } from './RespawnEffect';

interface PlayerDisplay {
  sprite: Phaser.GameObjects.Sprite;
  nameTag: PlayerNameTag;
}

/**
 * 원격 플레이어 비주얼 전체 통합 관리.
 * GameScene의 remotePlayerDisplays를 대체·확장.
 */
export class MultiplayerVisualSystem {
  private displays = new Map<string, PlayerDisplay>();
  private indicator: RemotePlayerIndicator;
  readonly respawnEffect: RespawnEffect;
  private selfId: string;

  constructor(private scene: Phaser.Scene, selfId: string) {
    this.selfId    = selfId;
    this.indicator = new RemotePlayerIndicator(scene);
    this.respawnEffect = new RespawnEffect(scene);
  }

  /** 각 프레임 원격 플레이어 상태 업데이트 */
  update(
    players: RemotePlayerState[],
    localMapX: number,
    localMapY: number,
    chatBubbles?: { updateBubblePosition(id: string, x: number, y: number): void },
  ): void {
    const seen = new Set<string>();

    for (const p of players) {
      if (p.mapX !== localMapX || p.mapY !== localMapY) continue;
      seen.add(p.id);

      let disp = this.displays.get(p.id);
      if (!disp) {
        disp = this.createDisplay(p);
      }

      // 스프라이트 위치·애니메이션
      const { sprite, nameTag } = disp;
      sprite.setPosition(p.renderX, p.renderY);
      const remDir = p.facing === 'right' ? 'left' : p.facing;
      const animKey = p.isMoving ? `walk_${p.skin}_${remDir}` : `idle_${p.skin}_${remDir}`;
      if (sprite.anims.currentAnim?.key !== animKey) sprite.play(animKey, true);
      sprite.setFlipX(p.facing === 'right');
      sprite.setTint(p.frenzy ? 0xff6666 : 0xffffff);

      // 이름표
      nameTag.update(p);

      chatBubbles?.updateBubblePosition(p.id, p.renderX, p.renderY);
    }

    // 사라진 플레이어 제거
    this.displays.forEach((disp, id) => {
      if (!seen.has(id)) { this.removeDisplay(id); }
    });

    // 화면 밖 방향 인디케이터 갱신
    this.indicator.update(players, localMapX, localMapY);
  }

  private createDisplay(p: RemotePlayerState): PlayerDisplay {
    const color = assignPlayerColor(p.id);
    (p as { playerColor?: number }).playerColor = color;

    const sprite = this.scene.add.sprite(p.renderX, p.renderY, `char_skin${p.skin}`, 0)
      .setDepth(5).setAlpha(0.85);
    const nameTag = new PlayerNameTag(this.scene, p.id, this.selfId);
    const disp: PlayerDisplay = { sprite, nameTag };
    this.displays.set(p.id, disp);
    return disp;
  }

  private removeDisplay(id: string): void {
    const disp = this.displays.get(id);
    if (!disp) return;
    disp.sprite.destroy();
    disp.nameTag.destroy();
    this.displays.delete(id);
  }

  getSprite(playerId: string): Phaser.GameObjects.Sprite | undefined {
    return this.displays.get(playerId)?.sprite;
  }

  /** 새 플레이어 입장 팝업 */
  showJoinPopup(worldX: number, worldY: number, name: string): void {
    showJoinLocationPopup(this.scene, worldX, worldY, name);
  }

  clearMap(): void {
    this.displays.forEach((_, id) => this.removeDisplay(id));
    this.displays.clear();
  }

  destroy(): void {
    this.clearMap();
    this.indicator.destroy();
  }
}
