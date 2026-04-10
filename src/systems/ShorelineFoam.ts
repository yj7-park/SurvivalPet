import Phaser from 'phaser';

type Direction = 'north' | 'south' | 'east' | 'west';

interface ShoreTile {
  wx: number;
  wy: number;
  dir: Direction;
}

export class ShorelineFoam {
  private foamGraphics: Phaser.GameObjects.Graphics[] = [];
  private events: Phaser.Time.TimerEvent[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  init(shoreTiles: ShoreTile[]): void {
    this.destroy();
    shoreTiles.forEach(tile => this.createFoamSegment(tile.wx, tile.wy, tile.dir));
  }

  private createFoamSegment(wx: number, wy: number, dir: Direction): void {
    const gfx = this.scene.add.graphics().setDepth(11);
    let phase = Math.random() * Math.PI * 2;

    const event = this.scene.time.addEvent({
      delay: 50, loop: true,
      callback: () => {
        phase += 0.08;
        const alpha = (Math.sin(phase) * 0.5 + 0.5) * 0.45 + 0.1;
        gfx.clear();
        gfx.fillStyle(0xffffff, alpha);

        switch (dir) {
          case 'south': gfx.fillRect(wx,      wy + 28, 32, 3); break;
          case 'north': gfx.fillRect(wx,      wy + 1,  32, 3); break;
          case 'east':  gfx.fillRect(wx + 28, wy,      3, 32); break;
          case 'west':  gfx.fillRect(wx + 1,  wy,      3, 32); break;
        }
      }
    });

    this.foamGraphics.push(gfx);
    this.events.push(event);
  }

  destroy(): void {
    this.events.forEach(e => e.remove());
    this.foamGraphics.forEach(g => g.destroy());
    this.events = [];
    this.foamGraphics = [];
  }
}
