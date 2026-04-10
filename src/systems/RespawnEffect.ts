import Phaser from 'phaser';

/**
 * 멀티플레이 리스폰 카운트다운 + 도착 이펙트.
 */
export class RespawnEffect {
  constructor(private scene: Phaser.Scene) {}

  /** 리스폰 카운트다운 텍스트 표시 */
  showRespawnCountdown(seconds: number): void {
    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;
    let remaining = seconds;

    const txt = this.scene.add.text(W / 2, H / 2 + 60,
      `리스폰까지 ${remaining}초...`, {
        fontSize: '13px', fontFamily: 'Courier New',
        fontStyle: 'bold', color: '#cccccc',
        stroke: '#000000', strokeThickness: 2,
      },
    ).setScrollFactor(0).setDepth(128).setOrigin(0.5);

    const interval = this.scene.time.addEvent({
      delay: 1000,
      repeat: seconds - 1,
      callback: () => {
        remaining--;
        txt.setText(remaining > 0 ? `리스폰까지 ${remaining}초...` : '리스폰!');
        if (remaining === 0) {
          this.scene.tweens.add({
            targets: txt, alpha: 0, duration: 800,
            onComplete: () => { txt.destroy(); interval.remove(); },
          });
        }
      },
    });
  }

  /** 리스폰 위치 도착 이펙트 */
  playRespawnArrivalEffect(worldX: number, worldY: number, playerSprite?: Phaser.GameObjects.Sprite): void {
    // 흰 원형 확장
    const gfx = this.scene.add.graphics().setDepth(70);
    const animObj = { r: 0 };
    this.scene.tweens.add({
      targets: animObj,
      r: 48,
      duration: 500,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        gfx.clear();
        gfx.lineStyle(2, 0xffffff, 1 - animObj.r / 48);
        gfx.strokeCircle(worldX, worldY, animObj.r);
      },
      onComplete: () => gfx.destroy(),
    });

    // 별 파티클
    if (this.scene.textures.exists('fx_pixel')) {
      const emitter = this.scene.add.particles(worldX, worldY, 'fx_pixel', {
        tint:     [0xffffff, 0xffeeaa, 0xaaddff],
        speed:    { min: 60, max: 120 },
        angle:    { min: 0, max: 360 },
        scale:    { start: 1.5, end: 0 },
        lifespan: 600,
        quantity: 8,
        emitting: false,
      });
      emitter.explode(8);
      this.scene.time.delayedCall(700, () => emitter.destroy());
    }

    // 플레이어 스프라이트 fade in
    if (playerSprite) {
      playerSprite.setAlpha(0);
      this.scene.tweens.add({ targets: playerSprite, alpha: 1, duration: 600 });
    }
  }

  /** 감정 표현 이모지 팝업 */
  showEmote(worldX: number, worldY: number, emote: string): void {
    const txt = this.scene.add.text(worldX, worldY - 60, emote, {
      fontSize: '24px',
    }).setDepth(92).setOrigin(0.5);

    this.scene.tweens.add({
      targets: txt,
      scaleX: { from: 0.3, to: 1.0 },
      scaleY: { from: 0.3, to: 1.0 },
      duration: 350,
      ease: 'Back.easeOut',
    });
    this.scene.time.delayedCall(2500, () => {
      this.scene.tweens.add({
        targets: txt,
        alpha: 0,
        y: txt.y - 16,
        duration: 400,
        onComplete: () => txt.destroy(),
      });
    });
  }
}

/** 채팅 이모트 명령어 파싱 */
export const EMOTE_COMMANDS: Record<string, string> = {
  '/gg':    '👍',
  '/help':  '🆘',
  '/wave':  '👋',
  '/tired': '😩',
  '/nice':  '✨',
};
