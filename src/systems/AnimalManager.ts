import Phaser from 'phaser';
import { Animal, AnimalType, DEER_CONFIG, TIGER_CONFIG } from '../entities/Animal';
import { TileType, TILE_SIZE } from '../world/MapGenerator';
import { SeededRandom } from '../utils/seedRandom';
import { Inventory } from './Inventory';

void Inventory; // imported for potential future use

const INTERACTION_RANGE = 2.5 * TILE_SIZE; // 80px
void INTERACTION_RANGE;

export class AnimalManager {
  private animals: Animal[] = [];
  private deadIds = new Set<string>();
  private scene!: Phaser.Scene;

  spawnForMap(seed: string, mapX: number, mapY: number, tiles: TileType[][], scene: Phaser.Scene, deadIdsFromServer: Set<string>): void {
    this.scene = scene;
    // clear existing
    this.animals.forEach(a => a.destroy());
    this.animals = [];
    this.deadIds = new Set(deadIdsFromServer);

    const rng = new SeededRandom(`${seed}_animals_${mapX}_${mapY}`);

    const dirtTiles: [number, number][] = [];
    for (let ty = 0; ty < 100; ty++)
      for (let tx = 0; tx < 100; tx++)
        if (tiles[ty][tx] === TileType.Dirt) dirtTiles.push([tx, ty]);

    const spawnList: { type: AnimalType; count: number }[] = [
      { type: 'deer',  count: rng.int(3, 6) },
      { type: 'tiger', count: rng.int(1, 2) },
    ];

    for (const { type, count } of spawnList) {
      for (let i = 0; i < count; i++) {
        const id = `${mapX}_${mapY}_${type}_${i}`;
        if (this.deadIds.has(id)) continue;

        // Pick random dirt tile
        const [tx, ty] = dirtTiles[Math.floor(rng.next() * dirtTiles.length)];
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = ty * TILE_SIZE + TILE_SIZE / 2;
        const config = type === 'deer' ? DEER_CONFIG : TIGER_CONFIG;
        const animalRng = new SeededRandom(`${seed}_animal_${id}`);
        const animal = new Animal(scene, wx, wy, config, id, animalRng);
        animal.setTiles(tiles);
        this.animals.push(animal);
      }
    }
  }

  update(delta: number, playerX: number, playerY: number, onPlayerHit: (dmg: number) => void): void {
    for (const animal of this.animals) {
      if (!animal.isDead) {
        animal.update(delta, playerX, playerY, onPlayerHit);
      }
    }
  }

  /** Returns animal within interaction range of (x,y), or null */
  getHovered(worldX: number, worldY: number): Animal | null {
    for (const a of this.animals) {
      if (a.isDead) continue;
      if (Math.hypot(a.x - worldX, a.y - worldY) < TILE_SIZE * 1.2) return a;
    }
    return null;
  }

  /** Attack animal, returns drops if killed */
  attackAnimal(animal: Animal, damage: number, playerX: number, playerY: number, rng: SeededRandom): { itemKey: string; count: number }[] {
    animal.onHit(playerX, playerY, damage);
    if (animal.isDead) {
      this.deadIds.add(animal.id);
      // fade out and destroy after 500ms
      this.scene.tweens.add({
        targets: animal.sprite,
        alpha: 0,
        duration: 500,
        onComplete: () => animal.destroy(),
      });
      return animal.rollDrops(rng);
    }
    return [];
  }

  getAnimals(): Animal[] { return this.animals; }
  getDeadIds(): Set<string> { return this.deadIds; }

  destroyAll(): void {
    this.animals.forEach(a => a.destroy());
    this.animals = [];
  }
}
