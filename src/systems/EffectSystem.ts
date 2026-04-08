import Phaser from 'phaser';

export class EffectSystem {
  constructor(private scene: Phaser.Scene) {}

  /** 피해량 숫자 팝업 */
  spawnDamageNumber(x: number, y: number, damage: number): void {
    const text = this.scene.add.text(x, y, `${damage}`, {
      fontSize: '14px',
      color: '#ff4444',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.scene.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  /** "DODGE!" 팝업 */
  spawnDodgeText(x: number, y: number): void {
    const text = this.scene.add.text(x, y, 'DODGE!', {
      fontSize: '14px',
      color: '#aaccff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  /** 근접 타격 섬광 (흰 플래시) */
  spawnHitFlash(x: number, y: number): void {
    const flash = this.scene.add.rectangle(x, y, 16, 16, 0xffffff, 0.7)
      .setOrigin(0.5)
      .setDepth(8);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  /** 걷기 먼지 파티클 */
  spawnDust(x: number, y: number): void {
    const dust = this.scene.add.circle(x, y, 2, 0x888888, 0.4)
      .setOrigin(0.5)
      .setDepth(6);

    this.scene.tweens.add({
      targets: dust,
      y: y + 10,
      alpha: 0,
      duration: 300,
      ease: 'Quad.easeOut',
      onComplete: () => dust.destroy(),
    });
  }

  /** 물 입수 파문 */
  spawnSplash(x: number, y: number): void {
    const splash = this.scene.add.circle(x, y, 4, 0xaaddff, 0.5)
      .setOrigin(0.5)
      .setDepth(6);

    this.scene.tweens.add({
      targets: splash,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => splash.destroy(),
    });
  }

  /** 벌목 파편 */
  spawnWoodChip(x: number, y: number, vx: number = 0, vy: number = -20): void {
    const chip = this.scene.add.rectangle(x, y, 4, 4, 0x8b5e2a, 1)
      .setOrigin(0.5)
      .setDepth(6);

    this.scene.tweens.add({
      targets: chip,
      x: x + vx,
      y: y + vy + 30,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => chip.destroy(),
    });
  }

  /** 피격 파티클 (빨강) */
  spawnBloodParticles(x: number, y: number, count: number = 5): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const vx = Math.cos(angle) * 60;
      const vy = Math.sin(angle) * 60 - 20; // 위쪽으로 편향

      const drop = this.scene.add.circle(x, y, 2, 0xcc0000, 1)
        .setOrigin(0.5)
        .setDepth(6);

      this.scene.tweens.add({
        targets: drop,
        x: x + vx,
        y: y + vy + 50,
        alpha: 0,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => drop.destroy(),
      });
    }
  }

  /** 아이템 획득 반짝임 */
  spawnItemPickup(x: number, y: number, count: number = 6): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const vx = Math.cos(angle) * 40;
      const vy = Math.sin(angle) * 40;

      const star = this.scene.add.polygon(
        x, y,
        [0, -3, 1, -1, 3, -1, 1, 1, 1, 3, 0, 1, -1, 3, -1, 1, -3, -1, -1, -1],
        0xffdd00,
        1,
      ).setOrigin(0.5).setDepth(7);

      this.scene.tweens.add({
        targets: star,
        x: x + vx,
        y: y + vy,
        alpha: 0,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  /** 수면 ZZZ 이펙트 */
  spawnSleepZZZ(x: number, y: number): void {
    const chars = ['Z', 'Z', 'Z'];
    chars.forEach((char, idx) => {
      const delay = idx * 1500;
      this.scene.time.delayedCall(delay, () => {
        const z = this.scene.add.text(x, y - 20, char, {
          fontSize: '16px',
          color: '#aaccff',
          fontFamily: 'monospace',
          fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(7);

        this.scene.tweens.add({
          targets: z,
          y: y - 60,
          alpha: 0,
          duration: 2500,
          ease: 'Quad.easeOut',
          onComplete: () => z.destroy(),
        });
      });
    });
  }

  /** 광기 모드 오라 이펙트 */
  spawnFrenzyAura(x: number, y: number): void {
    const aura = this.scene.add.circle(x, y, 12, 0xff0000, 0.3)
      .setOrigin(0.5)
      .setDepth(5);

    this.scene.tweens.add({
      targets: aura,
      scale: 1.5,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => aura.destroy(),
    });
  }

  /** 근접 공격 호(arc) 이펙트 */
  spawnAttackArc(x: number, y: number, angle: number): void {
    const arc = this.scene.add.arc(x, y, 18, angle - 0.5, angle + 0.5, false, 0xffdd00, 0.4)
      .setOrigin(0.5)
      .setDepth(7);

    this.scene.tweens.add({
      targets: arc,
      alpha: 0,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => arc.destroy(),
    });
  }

  /** 화살 발사 이펙트 (흔들림 + 잔상) */
  spawnArrowTrail(x: number, y: number, vx: number, vy: number): void {
    const trail = this.scene.add.line(x, y, 0, 0, x - vx * 0.1, y - vy * 0.1, 0xffddaa, 0.6)
      .setOrigin(0)
      .setDepth(7);

    this.scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => trail.destroy(),
    });
  }

  /** 텍스트 팝업 (일반) */
  spawnFloatText(x: number, y: number, text: string, color: string = '#ffffff'): void {
    const txt = this.scene.add.text(x, y, text, {
      fontSize: '12px',
      color,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10);

    this.scene.tweens.add({
      targets: txt,
      y: y - 30,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => txt.destroy(),
    });
  }
}
