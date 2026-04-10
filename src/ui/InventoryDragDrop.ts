import Phaser from 'phaser';

/**
 * 인벤토리 드래그-드롭 고스트 아이콘 + snap tween.
 * depth 129/130, scrollFactor 0.
 */
export class InventoryDragDrop {
  private ghostIcon: Phaser.GameObjects.Image | null = null;
  private shadowIcon: Phaser.GameObjects.Image | null = null;

  constructor(private scene: Phaser.Scene) {}

  /** 드래그 시작: 마우스 위치에 고스트 아이콘 생성 */
  startDrag(iconKey: string, screenX: number, screenY: number): void {
    this.cleanupDrag();

    if (!this.scene.textures.exists(iconKey)) return;

    this.shadowIcon = this.scene.add.image(screenX + 3, screenY + 3, iconKey)
      .setScrollFactor(0).setDepth(129).setScale(1.15).setAlpha(0.35).setTint(0x000000);

    this.ghostIcon = this.scene.add.image(screenX, screenY, iconKey)
      .setScrollFactor(0).setDepth(130).setScale(1.15).setAlpha(0.9);

    const canvas = this.scene.game.canvas;
    canvas.style.cursor = 'grabbing';
  }

  /** 드래그 중: 고스트 위치 업데이트 */
  updateDrag(screenX: number, screenY: number): void {
    this.ghostIcon?.setPosition(screenX, screenY);
    this.shadowIcon?.setPosition(screenX + 3, screenY + 3);
  }

  /** 슬롯에 드롭: snap tween 후 정리 */
  dropOnSlot(targetX: number, targetY: number): void {
    if (!this.ghostIcon) return;
    const targets = [this.ghostIcon, this.shadowIcon].filter(Boolean);
    this.scene.tweens.add({
      targets,
      x: targetX, y: targetY,
      duration: 100, ease: 'Quad.easeOut',
      onComplete: () => this.cleanupDrag(),
    });
    this.resetCursor();
  }

  /** 땅에 버리기: 아래로 떨어지며 fade */
  dropOnGround(): void {
    if (!this.ghostIcon) return;
    const targets = [this.ghostIcon, this.shadowIcon].filter(Boolean);
    this.scene.tweens.add({
      targets,
      y: (this.ghostIcon?.y ?? 0) + 20,
      alpha: 0,
      duration: 250,
      onComplete: () => this.cleanupDrag(),
    });
    this.resetCursor();
  }

  /** 슬롯 scale punch (드롭 피드백) */
  punchSlot(container: Phaser.GameObjects.Container): void {
    this.scene.tweens.add({
      targets: container,
      scaleX: 0.9, scaleY: 0.9,
      duration: 80, ease: 'Quad.easeOut',
      yoyo: true,
    });
  }

  isDragging(): boolean { return this.ghostIcon !== null; }

  private resetCursor(): void {
    this.scene.game.canvas.style.cursor = 'default';
  }

  private cleanupDrag(): void {
    this.ghostIcon?.destroy(); this.ghostIcon = null;
    this.shadowIcon?.destroy(); this.shadowIcon = null;
  }

  destroy(): void { this.cleanupDrag(); }
}

/** 슬롯 호버 강조 tween */
export function animateSlotHover(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  entering: boolean,
): void {
  scene.tweens.add({
    targets: container,
    scaleX: entering ? 1.06 : 1.0,
    scaleY: entering ? 1.06 : 1.0,
    duration: entering ? 100 : 80,
    ease: entering ? 'Quad.easeOut' : 'Linear',
  });
}
