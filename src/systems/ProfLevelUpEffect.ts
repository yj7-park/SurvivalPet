import Phaser from 'phaser';
import type { ProficiencyType } from './ProficiencySystem';
import { PROF_NAMES } from './ProficiencySystem';

const PROF_CONFIG: Record<ProficiencyType, { icon: string; color: number }> = {
  woodcutting: { icon: '🪓', color: 0x8a6030 },
  mining:      { icon: '⛏', color: 0x808080 },
  fishing:     { icon: '🎣', color: 0x4080c0 },
  crafting:    { icon: '🔨', color: 0x8060c0 },
  building:    { icon: '🏗', color: 0xc8a030 },
  cooking:     { icon: '🍳', color: 0xe06020 },
  combat:      { icon: '⚔', color: 0xe04040 },
  farming:     { icon: '🌾', color: 0x60a830 },
};

/**
 * 숙련도 레벨업 연출: 링 파티클 + 텍스트 팝업 + notify.
 */
export function playProfLevelUpEffect(
  scene: Phaser.Scene,
  id: ProficiencyType,
  newLevel: number,
  playerX: number,
  playerY: number,
): void {
  const cfg = PROF_CONFIG[id];
  const colorHex = '#' + cfg.color.toString(16).padStart(6, '0');

  // 확장 링 2개 (지연 150ms)
  [0, 150].forEach(delay => {
    scene.time.delayedCall(delay, () => {
      const gfx = scene.add.graphics().setDepth(75);
      const proxy = { r: 0 };
      scene.tweens.add({
        targets: proxy, r: 64,
        duration: 500, ease: 'Quad.easeOut',
        onUpdate: () => {
          gfx.clear();
          gfx.lineStyle(2, cfg.color, 1 - proxy.r / 64);
          gfx.strokeCircle(playerX, playerY, proxy.r);
        },
        onComplete: () => gfx.destroy(),
      });
    });
  });

  // 아이콘 + 레벨 팝업
  const popup = scene.add.text(
    playerX, playerY - 48,
    `${cfg.icon} Lv.${newLevel}!`,
    {
      fontSize: '14px', fontFamily: 'Courier New',
      color: colorHex, stroke: '#000000', strokeThickness: 3,
    },
  ).setDepth(90).setOrigin(0.5);

  scene.tweens.add({
    targets: popup,
    scaleX: { from: 0.5, to: 1.0 },
    scaleY: { from: 0.5, to: 1.0 },
    duration: 400, ease: 'Back.easeOut',
  });
  scene.time.delayedCall(1800, () => {
    scene.tweens.add({
      targets: popup, y: popup.y - 20, alpha: 0,
      duration: 400, onComplete: () => popup.destroy(),
    });
  });

  // 방사형 파티클
  if (scene.textures.exists('fx_pixel')) {
    const emitter = scene.add.particles(playerX, playerY, 'fx_pixel', {
      tint:     [cfg.color, 0xffffff],
      speed:    { min: 60, max: 140 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.4, end: 0 },
      lifespan: 700,
      quantity: 12,
      emitting: false,
    }).setDepth(75);
    emitter.explode(12);
    scene.time.delayedCall(800, () => emitter.destroy());
  }

  // Notify
  const notifyScene = scene.scene.get('UIScene') as unknown as {
    notifySystem?: { show: (type: string, msg: string) => void };
  };
  notifyScene?.notifySystem?.show('info', `${PROF_NAMES[id]} 숙련도 Lv.${newLevel} 달성!`);
}
