import Phaser from 'phaser';
import type { RemotePlayerState } from '../systems/MultiplayerSystem';

const PLAYER_COLORS = [
  0xe04040, 0x4080e0, 0x40c060, 0xe0a020,
  0xc040c0, 0x40c0c0, 0xe0e040, 0xe06080,
];

export function assignPlayerColor(uid: string): number {
  const hash = uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PLAYER_COLORS[hash % PLAYER_COLORS.length];
}

function getStatusIcons(state: RemotePlayerState): string {
  const icons: string[] = [];
  if (state.hp / (state.maxHp ?? 100) < 0.3) icons.push('🩸');
  if (state.hunger < 30)                      icons.push('🍖');
  if (state.frenzy)                            icons.push('⚡');
  if ((state.afkSeconds ?? 0) > 30)           icons.push('AFK');
  return icons.join(' ');
}

/**
 * 단일 원격 플레이어의 이름표 + HP 게이지 + 상태 아이콘 컴포넌트.
 */
export class PlayerNameTag {
  private nameText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private barGfx!: Phaser.GameObjects.Graphics;
  private bgGfx!: Phaser.GameObjects.Graphics;

  private readonly isSelf: boolean;

  constructor(
    private scene: Phaser.Scene,
    private playerId: string,
    selfId: string,
  ) {
    this.isSelf = playerId === selfId;
    this.create();
  }

  private create(): void {
    const borderColor = this.isSelf ? '#f0c030' : '#aaaaaa';

    this.bgGfx = this.scene.add.graphics().setDepth(86);
    this.barGfx = this.scene.add.graphics().setDepth(87);

    this.nameText = this.scene.add.text(0, 0, '', {
      fontSize: '9px', fontFamily: 'Courier New',
      color: '#ffffff', stroke: '#000000', strokeThickness: 1,
      fontStyle: this.isSelf ? 'bold' : 'normal',
    }).setDepth(88).setOrigin(0.5, 0.5);
    this.nameText.setColor(borderColor);

    this.statusText = this.scene.add.text(0, 0, '', {
      fontSize: '8px', fontFamily: 'Courier New',
      color: '#ffcccc',
    }).setDepth(88).setOrigin(0.5, 0.5);
  }

  update(state: RemotePlayerState): void {
    const wx = state.renderX;
    const wy = state.renderY - 36;

    const maxHp = state.maxHp ?? 100;
    const hpRatio = Math.max(0, Math.min(1, state.hp / maxHp));
    const spRatio = Math.max(0, Math.min(1, state.fatigue / 100));
    const status = getStatusIcons(state);

    const tagW = 52, tagH = 22;
    const bx = wx - tagW / 2;
    const by = wy - tagH / 2;

    // 배경
    this.bgGfx.clear();
    this.bgGfx.fillStyle(0x000000, 0.45);
    this.bgGfx.fillRoundedRect(bx, by, tagW, tagH, 3);
    this.bgGfx.lineStyle(1, this.isSelf ? 0xf0c030 : 0xaaaaaa, 0.7);
    this.bgGfx.strokeRoundedRect(bx, by, tagW, tagH, 3);

    // HP/SP 바
    const barW = tagW - 8, barH = 3;
    const bBarX = bx + 4;
    this.barGfx.clear();
    // HP
    this.barGfx.fillStyle(0x3a1010, 0.9);
    this.barGfx.fillRect(bBarX, by + 2, barW, barH);
    this.barGfx.fillStyle(hpRatio > 0.3 ? 0xe04040 : 0xff2020, 1.0);
    this.barGfx.fillRect(bBarX, by + 2, Math.ceil(barW * hpRatio), barH);
    // SP (피로 역방향: fatigue 100=full energy)
    this.barGfx.fillStyle(0x10103a, 0.9);
    this.barGfx.fillRect(bBarX, by + 7, barW, barH);
    this.barGfx.fillStyle(0x4080e0, 1.0);
    this.barGfx.fillRect(bBarX, by + 7, Math.ceil(barW * spRatio), barH);

    // 이름
    this.nameText.setPosition(wx, by + 14).setText(state.name);
    // 상태 아이콘
    if (status) {
      this.statusText.setPosition(wx, by + 4).setText(status).setVisible(true);
    } else {
      this.statusText.setVisible(false);
    }
  }

  setPosition(wx: number, wy: number): void {
    // Called externally if needed — update() handles positioning
    void wx; void wy;
  }

  destroy(): void {
    this.bgGfx.destroy();
    this.barGfx.destroy();
    this.nameText.destroy();
    this.statusText.destroy();
  }
}
