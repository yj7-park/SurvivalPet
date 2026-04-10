import Phaser from 'phaser';

const SKILL_COLORS: Record<string, string> = {
  woodcutting: '#c07040',
  mining:      '#909090',
  fishing:     '#4080c0',
  building:    '#c8a030',
  cooking:     '#e06020',
  crafting:    '#8060c0',
  combat:      '#cc3030',
  farming:     '#40a030',
};

/**
 * Visual effects for feedback events: XP gain, level-up, eating, healing, food poison.
 */
export class FeedbackRenderer {
  constructor(private scene: Phaser.Scene) {}

  // ── XP gain popup ─────────────────────────────────────────────────────────

  showXpGain(x: number, y: number, skill: string, xp: number): void {
    const color = SKILL_COLORS[skill] ?? '#aaaaaa';
    const text = this.scene.add.text(x, y, `+${xp} ${skill}`, {
      fontSize: '10px', fontFamily: 'Courier New',
      color, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(80).setAlpha(0.85);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 18,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  // ── Level-up fanfare ──────────────────────────────────────────────────────

  playLevelUpEffect(x: number, y: number, skill: string, newLevel: number): void {
    // Expanding golden rings (2, staggered)
    [0, 150].forEach(delay => {
      const ring = this.scene.add.graphics().setDepth(85);
      ring.lineStyle(2, 0xffd060, 0.9);
      ring.strokeCircle(x, y, 8);
      this.scene.time.delayedCall(delay, () => {
        this.scene.tweens.add({
          targets: ring,
          scale: 4,
          alpha: 0,
          duration: 500,
          ease: 'Quad.easeOut',
          onComplete: () => ring.destroy(),
        });
      });
    });

    // 12 star particles radially
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const star = this.scene.add.star(x, y, 4, 2, 6, 0xffd060).setDepth(85);
      this.scene.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * 50,
        y: y + Math.sin(angle) * 50,
        alpha: 0,
        scale: 0,
        angle: 360,
        duration: 700,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy(),
      });
    }

    // Level-up text (scale punch)
    const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
    const lvText = this.scene.add.text(x, y - 30, `⬆ ${skillName} Lv.${newLevel}!`, {
      fontSize: '14px', fontFamily: 'Courier New',
      color: '#ffd060', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(90).setScale(0);

    this.scene.tweens.add({
      targets: lvText, scale: 1, y: lvText.y - 10,
      duration: 300, ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: lvText, alpha: 0,
      duration: 600, delay: 1200, ease: 'Quad.easeIn',
      onComplete: () => lvText.destroy(),
    });
  }

  // ── Food eating effect ────────────────────────────────────────────────────

  playEatEffect(x: number, y: number, hungerRestore: number): void {
    // Hearts floating up
    const count = Math.max(1, Math.ceil(hungerRestore / 10));
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(i * 60, () => {
        const heart = this.scene.add.text(
          x + Phaser.Math.Between(-12, 12),
          y - Phaser.Math.Between(10, 20),
          '♥',
          { fontSize: '11px', color: '#ff9944', stroke: '#000000', strokeThickness: 1 },
        ).setOrigin(0.5).setDepth(80);
        this.scene.tweens.add({
          targets: heart, y: heart.y - 20, alpha: 0,
          duration: 700, ease: 'Quad.easeOut',
          onComplete: () => heart.destroy(),
        });
      });
    }
  }

  // ── HP heal effect ────────────────────────────────────────────────────────

  playHealEffect(x: number, y: number, amount: number): void {
    const popup = this.scene.add.text(x, y - 16, `+${amount}`, {
      fontSize: '12px', fontFamily: 'Courier New',
      color: '#44cc66', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(80);
    this.scene.tweens.add({
      targets: popup, y: popup.y - 16, alpha: 0,
      duration: 600, ease: 'Quad.easeOut',
      onComplete: () => popup.destroy(),
    });

    // Green dot burst
    for (let i = 0; i < 4; i++) {
      const dot = this.scene.add.circle(
        x + Phaser.Math.Between(-10, 10),
        y + Phaser.Math.Between(-5, 5),
        2, 0x44cc66,
      ).setDepth(79);
      this.scene.tweens.add({
        targets: dot,
        y: dot.y - Phaser.Math.Between(15, 30),
        alpha: 0, scale: 0,
        duration: Phaser.Math.Between(500, 800),
        ease: 'Quad.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  // ── Food poison effect ────────────────────────────────────────────────────

  playFoodPoisonEffect(x: number, y: number): void {
    const colors = [0x88cc44, 0x44aa22, 0xaacc00];
    for (let i = 0; i < 6; i++) {
      const dot = this.scene.add.circle(
        x, y,
        Phaser.Math.Between(2, 4),
        colors[Math.floor(Math.random() * colors.length)],
      ).setDepth(79);
      this.scene.tweens.add({
        targets: dot,
        x: dot.x + Phaser.Math.Between(-25, 25),
        y: dot.y + Phaser.Math.Between(10, 30),
        alpha: 0,
        duration: Phaser.Math.Between(400, 700),
        onComplete: () => dot.destroy(),
      });
    }

    const txt = this.scene.add.text(x, y - 30, '🤢 식중독!', {
      fontSize: '11px', fontFamily: 'Courier New',
      color: '#aacc44', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(80);
    this.scene.tweens.add({
      targets: txt, y: txt.y - 16, alpha: 0, duration: 1200,
      onComplete: () => txt.destroy(),
    });
  }

  destroy(): void {}
}
