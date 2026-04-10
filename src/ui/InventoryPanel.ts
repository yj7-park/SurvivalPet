import Phaser from 'phaser';

/**
 * 인벤토리 패널 열기/닫기 scale tween 유틸리티.
 * 기존 HTML 기반 InventoryUI의 Phaser Container 래퍼.
 */
export class InventoryPanelAnimator {
  constructor(private scene: Phaser.Scene) {}

  /** 패널 열기 애니메이션: scaleY 0.1 → 1.0 + fade in (0.2s Back.easeOut) */
  animateOpen(container: Phaser.GameObjects.Container): void {
    container.setVisible(true).setAlpha(0).setScale(1, 0.1);
    this.scene.tweens.add({
      targets: container,
      alpha: 1, scaleY: 1,
      duration: 200, ease: 'Back.easeOut',
    });
  }

  /** 패널 닫기 애니메이션: scaleY 1.0 → 0.1 + fade out (0.15s) */
  animateClose(container: Phaser.GameObjects.Container, onDone?: () => void): void {
    this.scene.tweens.add({
      targets: container,
      alpha: 0, scaleY: 0.1,
      duration: 150,
      onComplete: () => {
        container.setVisible(false);
        onDone?.();
      },
    });
  }
}

/** 아이템 줍기 (pickup) fly-in 연출: 월드 위치 → HUD 슬롯 */
export function playPickupFlyIn(
  scene: Phaser.Scene,
  fromWorldX: number,
  fromWorldY: number,
  toScreenX: number,
  toScreenY: number,
  iconKey: string,
): void {
  const cam = scene.cameras.main;
  const fromSX = (fromWorldX - cam.worldView.x) * cam.zoom;
  const fromSY = (fromWorldY - cam.worldView.y) * cam.zoom;

  if (!scene.textures.exists(iconKey)) return;

  const icon = scene.add.image(fromSX, fromSY, iconKey)
    .setScrollFactor(0).setDepth(130).setScale(0.8).setAlpha(0.9);

  scene.tweens.add({
    targets: icon,
    x: toScreenX, y: toScreenY,
    scaleX: 0.4, scaleY: 0.4,
    alpha: 0,
    duration: 350, ease: 'Quad.easeIn',
    onComplete: () => icon.destroy(),
  });
}
