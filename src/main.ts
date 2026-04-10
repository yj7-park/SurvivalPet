import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { LoadingScene } from './scenes/LoadingScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  render: {
    pixelArt: true,
    antialias: false,
    powerPreference: 'high-performance',
    batchSize: 2048,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
    smoothStep: true,
  },
  scene: [TitleScene, LoadingScene, GameScene, UIScene],
  parent: document.body,
};

new Phaser.Game(config);
