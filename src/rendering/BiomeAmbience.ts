import { AmbientParticleSystem, AmbientType } from './AmbientParticleSystem';

export type BiomeType =
  | 'forest' | 'desert' | 'cave' | 'swamp'
  | 'mountain' | 'beach' | 'mushroom_forest' | 'ruins';

const BIOME_AMBIENTS: Record<BiomeType, AmbientType[]> = {
  forest:          ['leaf_fall', 'firefly'],
  desert:          ['dust_mote'],
  cave:            ['dust_mote', 'water_drip'],
  swamp:           ['mist_wisp', 'bubble'],
  mountain:        ['snow_drift', 'dust_mote'],
  beach:           ['petal', 'bubble'],
  mushroom_forest: ['spore', 'mist_wisp'],
  ruins:           ['dust_mote', 'leaf_fall'],
};

export class BiomeAmbience {
  private scene:        Phaser.Scene;
  private systems:      AmbientParticleSystem[] = [];
  private currentBiome: BiomeType | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setBiome(biome: BiomeType, camW: number, camH: number): void {
    if (this.currentBiome === biome) return;
    this.currentBiome = biome;

    const oldSystems = [...this.systems];
    this.systems = [];

    oldSystems.forEach(s => s.pause());
    this.scene.time.delayedCall(600, () => oldSystems.forEach(s => s.destroy()));

    const types = BIOME_AMBIENTS[biome] ?? [];
    const area  = {
      x: this.scene.cameras.main.scrollX - 64,
      y: this.scene.cameras.main.scrollY - 64,
      w: camW + 128,
      h: camH + 128,
    };

    for (const type of types) {
      this.systems.push(new AmbientParticleSystem(this.scene, type, area));
    }
  }

  update(delta: number): void {
    const cam = this.scene.cameras.main;
    for (const sys of this.systems) {
      sys.update(delta, cam.scrollX, cam.scrollY);
    }
  }

  destroy(): void {
    this.systems.forEach(s => s.destroy());
    this.systems.length = 0;
  }
}
