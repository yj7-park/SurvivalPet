import Phaser from 'phaser';
import type { ProficiencyType } from '../systems/ProficiencySystem';

/**
 * 숙련도 XP 바 tween 애니메이션 + 레벨업 글로우.
 */
export class ProficiencyBarAnimator {
  private tweens = new Map<ProficiencyType, Phaser.Tweens.Tween>();
  private barObjects = new Map<ProficiencyType, { xp: number }>();

  constructor(private scene: Phaser.Scene) {}

  /** XP 획득 시 바 채움 애니메이션 */
  animateXpGain(
    id: ProficiencyType,
    prevXp: number,
    newXp: number,
    maxXp: number,
    onUpdate: (id: ProficiencyType, xp: number) => void,
  ): void {
    const existing = this.tweens.get(id);
    existing?.stop();

    const barObj = { xp: prevXp };
    this.barObjects.set(id, barObj);

    const tween = this.scene.tweens.add({
      targets: barObj,
      xp: Math.min(newXp, maxXp),
      duration: 600,
      ease: 'Quad.easeOut',
      onUpdate: () => onUpdate(id, barObj.xp),
      onComplete: () => {
        if (newXp >= maxXp) this.triggerLevelUpGlow(id, onUpdate);
      },
    });
    this.tweens.set(id, tween);
  }

  private triggerLevelUpGlow(
    id: ProficiencyType,
    onUpdate: (id: ProficiencyType, xp: number) => void,
  ): void {
    const barObj = this.barObjects.get(id);
    if (!barObj) return;

    let glowDir = -1;
    let alpha = 1.0;
    let count = 0;
    const timer = this.scene.time.addEvent({
      delay: 200,
      repeat: 5,
      callback: () => {
        alpha += glowDir * 0.3;
        glowDir *= -1;
        count++;
        onUpdate(id, barObj.xp);
        if (count >= 6) timer.remove();
      },
    });
    void alpha;
  }

  destroy(): void {
    for (const t of this.tweens.values()) t.stop();
    this.tweens.clear();
  }
}
