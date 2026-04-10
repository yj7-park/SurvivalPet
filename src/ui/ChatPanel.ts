import Phaser from 'phaser';

type ChatMessageType = 'user' | 'system' | 'join' | 'leave' | 'death' | 'combat';

export interface ChatMessage {
  type: ChatMessageType;
  text: string;
  playerName?: string;
  playerColor?: string;
}

const CHAT_MESSAGE_COLORS: Record<ChatMessageType, string> = {
  user:   '#e8d8b0',
  system: '#f09040',
  join:   '#60e080',
  leave:  '#e06060',
  death:  '#e04040',
  combat: '#ff8080',
};

const SYSTEM_LABELS: Record<string, string> = {
  system: '시스템', join: '입장', leave: '퇴장', death: '사망', combat: '전투'
};

function getSystemLabel(type: string): string {
  return SYSTEM_LABELS[type] ?? '시스템';
}

export class ChatPanel {
  private container: Phaser.GameObjects.Container;
  private logCanvas: Phaser.GameObjects.RenderTexture;
  private bg: Phaser.GameObjects.Graphics;
  private badge: Phaser.GameObjects.Text | null = null;
  private messages: ChatMessage[] = [];
  private fadeTimer: Phaser.Time.TimerEvent | null = null;
  private readonly W = 320;
  private readonly H = 120;
  private readonly FADE_DELAY = 8000;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const cam = scene.cameras.main;
    const px = 8;
    const py = cam.height - 168;

    this.bg = scene.add.graphics()
      .fillStyle(0x0a0805, 0.65)
      .fillRect(0, 0, this.W, this.H)
      .setDepth(86);

    this.logCanvas = scene.add.renderTexture(px, py, this.W, this.H)
      .setScrollFactor(0)
      .setDepth(86);

    this.container = scene.add.container(px, py, [this.bg, this.logCanvas])
      .setScrollFactor(0)
      .setDepth(86);

    this.container.setAlpha(0.65);
    this.container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, this.W, this.H),
      Phaser.Geom.Rectangle.Contains
    );
    this.container.on('pointerover', () => this.onHover());
    this.container.on('pointerout',  () => this.onHoverOut());
  }

  addMessage(msg: ChatMessage): void {
    this.messages.push(msg);
    if (this.messages.length > 50) this.messages.shift();
    this.redraw();
    this.onNewMessage();
  }

  private redraw(): void {
    const visible = this.messages.slice(-8);
    const offCanvas = document.createElement('canvas');
    offCanvas.width = this.W;
    offCanvas.height = this.H;
    const ctx = offCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.W, this.H);

    visible.forEach((msg, i) => {
      const y = this.H - 16 - (visible.length - 1 - i) * 14;
      if (msg.type === 'user') {
        ctx.fillStyle = msg.playerColor ?? '#aaaaaa';
        ctx.font = 'bold 9px "Courier New"';
        const nameLabel = `${msg.playerName ?? '?'}:`;
        ctx.fillText(nameLabel, 4, y);
        const nameW = ctx.measureText(`${nameLabel} `).width;
        ctx.fillStyle = CHAT_MESSAGE_COLORS.user;
        ctx.font = '9px "Courier New"';
        ctx.fillText(msg.text, 4 + nameW, y);
      } else {
        ctx.fillStyle = CHAT_MESSAGE_COLORS[msg.type] ?? '#f09040';
        ctx.font = 'italic 9px "Courier New"';
        ctx.fillText(`[${getSystemLabel(msg.type)}] ${msg.text}`, 4, y);
      }
    });

    this.logCanvas.clear();
    this.logCanvas.draw(
      this.scene.textures.addCanvas('_chat_tmp', offCanvas),
      0, 0
    );
  }

  private onNewMessage(): void {
    this.container.setAlpha(0.92);
    this.resetFadeTimer();
    this.showBadge();
  }

  private onHover(): void {
    this.container.setAlpha(0.92);
    this.fadeTimer?.remove();
  }

  private onHoverOut(): void {
    this.resetFadeTimer();
  }

  private resetFadeTimer(): void {
    this.fadeTimer?.remove();
    this.fadeTimer = this.scene.time.delayedCall(this.FADE_DELAY, () => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0.35, duration: 1000
      });
    });
  }

  private showBadge(): void {
    const cam = this.scene.cameras.main;
    if (!this.badge) {
      this.badge = this.scene.add.text(8, cam.height - 172, '',
        { fontSize: '9px', fontFamily: 'Courier New',
          color: '#1a1008', backgroundColor: '#f0c030',
          padding: { x: 4, y: 2 } }
      ).setScrollFactor(0).setDepth(87);
    }
    const unread = this.messages.length;
    this.badge.setText(`+${unread}`).setVisible(true);
    this.scene.time.delayedCall(3000, () => this.badge?.setVisible(false));
  }

  destroy(): void {
    this.fadeTimer?.remove();
    this.container.destroy();
    this.badge?.destroy();
  }
}
