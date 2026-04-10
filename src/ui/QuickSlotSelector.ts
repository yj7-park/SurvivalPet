import Phaser from 'phaser';

/**
 * 빠른 슬롯 선택 이동 표시자 + 아이템 이름 팝업.
 * depth 84/98, scrollFactor 0.
 */
export class QuickSlotSelector {
  private selectorGfx: Phaser.GameObjects.Graphics;
  private currentIndex = -1;

  constructor(private scene: Phaser.Scene) {
    this.selectorGfx = scene.add.graphics()
      .setScrollFactor(0).setDepth(84).setVisible(false);
    this.drawSelector();
  }

  private drawSelector(): void {
    this.selectorGfx.clear();
    this.selectorGfx.lineStyle(2, 0xf0c030, 1.0);
    this.selectorGfx.strokeRoundedRect(0, 0, 38, 38, 3);
  }

  /** 슬롯 선택 시 호출. slotX/slotY는 슬롯 중심 화면 좌표 */
  selectSlot(
    index: number,
    slotCenterX: number,
    slotCenterY: number,
    itemName?: string,
  ): void {
    this.currentIndex = index;
    this.selectorGfx.setVisible(true);

    // 선택 표시자 슬라이드
    this.scene.tweens.add({
      targets: this.selectorGfx,
      x: slotCenterX - 19,
      y: slotCenterY - 19,
      duration: 120,
      ease: 'Quad.easeOut',
    });

    // 아이템 이름 팝업
    if (itemName) {
      this.showItemLabel(slotCenterX, slotCenterY - 22, itemName);
    }
  }

  private showItemLabel(x: number, y: number, name: string): void {
    const lbl = this.scene.add.text(x, y, name, {
      fontSize: '9px', fontFamily: 'Courier New',
      color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setScrollFactor(0).setDepth(98).setOrigin(0.5).setAlpha(0);

    this.scene.tweens.add({
      targets: lbl,
      alpha: { from: 0, to: 1 }, y: y - 4,
      duration: 150,
      onComplete: () => {
        this.scene.time.delayedCall(1200, () => {
          this.scene.tweens.add({
            targets: lbl, alpha: 0, duration: 300,
            onComplete: () => lbl.destroy(),
          });
        });
      },
    });
  }

  destroy(): void { this.selectorGfx.destroy(); }
}

/** 아이템 버리기 연출 */
export function playDropItemEffect(
  scene: Phaser.Scene,
  slotScreenX: number,
  slotScreenY: number,
  iconKey: string,
): void {
  if (!scene.textures.exists(iconKey)) {
    showDropText(scene, slotScreenX, slotScreenY);
    return;
  }

  const icon = scene.add.image(slotScreenX, slotScreenY, iconKey)
    .setScrollFactor(0).setDepth(130).setScale(1.0);

  scene.tweens.add({
    targets: icon,
    y: slotScreenY + 50,
    angle: Phaser.Math.Between(-30, 30),
    alpha: 0,
    duration: 400,
    ease: 'Quad.easeIn',
    onComplete: () => icon.destroy(),
  });

  showDropText(scene, slotScreenX, slotScreenY);
}

function showDropText(scene: Phaser.Scene, x: number, y: number): void {
  const txt = scene.add.text(x, y - 12, '버림', {
    fontSize: '9px', fontFamily: 'Courier New',
    color: '#888880', stroke: '#000000', strokeThickness: 1,
  }).setScrollFactor(0).setDepth(131).setOrigin(0.5);

  scene.tweens.add({
    targets: txt, y: txt.y - 20, alpha: { from: 1, to: 0 },
    duration: 600, onComplete: () => txt.destroy(),
  });
}
