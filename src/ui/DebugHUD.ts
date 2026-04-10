import Phaser from 'phaser';

export class DebugHUD {
  private fpsText: Phaser.GameObjects.Text;
  private coordText: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const cam = scene.cameras.main;

    this.fpsText = scene.add.text(cam.width - 60, 8, '', {
      fontSize: '10px', fontFamily: 'Courier New', color: '#60e060',
      stroke: '#000000', strokeThickness: 2
    }).setScrollFactor(0).setDepth(89).setVisible(false);

    this.coordText = scene.add.text(cam.width - 90, 22, '', {
      fontSize: '9px', fontFamily: 'Courier New', color: '#c8b88a',
      stroke: '#000000', strokeThickness: 2
    }).setScrollFactor(0).setDepth(89).setVisible(false);
  }

  update(
    delta: number,
    showFps: boolean,
    showCoords: boolean,
    playerTX: number,
    playerTY: number
  ): void {
    const fps = Math.round(1000 / delta);

    if (showFps) {
      const color = fps >= 55 ? '#60e060' : fps >= 30 ? '#e0c040' : '#e04040';
      this.fpsText.setText(`${fps} fps`).setStyle({ color }).setVisible(true);
    } else {
      this.fpsText.setVisible(false);
    }

    if (showCoords) {
      this.coordText.setText(`(${playerTX}, ${playerTY})`).setVisible(true);
    } else {
      this.coordText.setVisible(false);
    }
  }

  destroy(): void {
    this.fpsText.destroy();
    this.coordText.destroy();
  }
}
