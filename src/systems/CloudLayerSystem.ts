import {
  CloudType, CloudTint,
  getCloudTextureKey, registerCloudTextures, CLOUD_CONFIGS,
} from '../generators/CloudSpriteGenerator';

export interface CloudInstance {
  id:     string;
  type:   CloudType;
  x:      number;
  y:      number;
  speed:  number;
  alpha:  number;
  scale:  number;
  layer:  0 | 1;
  tint:   CloudTint;
}

const LAYER_CONFIGS = [
  { speedMin: 8,  speedMax: 14, yMin: 20,  yMax: 60,  alphaMin: 0.5, alphaMax: 0.7, scale: 0.7, depth: 2 },
  { speedMin: 18, speedMax: 26, yMin: 50,  yMax: 110, alphaMin: 0.7, alphaMax: 0.9, scale: 1.0, depth: 3 },
];

const SPAWN_INTERVAL = 8000;

export class CloudLayerSystem {
  clouds: CloudInstance[] = [];
  private sprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private scene: Phaser.Scene;
  private maxClouds = 10;
  private stormSpeedMultiplier = 1.0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  init(cam: Phaser.Cameras.Scene2D.Camera): void {
    registerCloudTextures(this.scene);

    const count = Phaser.Math.Between(8, 12);
    for (let i = 0; i < count; i++) {
      this.spawnCloud(cam, Phaser.Math.Between(0, cam.width));
    }

    this.scene.time.addEvent({
      delay: SPAWN_INTERVAL,
      loop: true,
      callback: () => {
        if (this.clouds.length < this.maxClouds) {
          this.spawnCloud(cam, cam.width + 60);
        }
      },
    });
  }

  private spawnCloud(cam: Phaser.Cameras.Scene2D.Camera, startX: number): void {
    const layer = (Math.random() < 0.4 ? 0 : 1) as 0 | 1;
    const cfg   = LAYER_CONFIGS[layer];
    const types: CloudType[] = ['cumulus_small', 'cumulus_large', 'cirrus'];
    const type  = types[Math.floor(Math.random() * types.length)];
    const tint  = this.getCurrentTint();

    const inst: CloudInstance = {
      id:    Math.random().toString(36).slice(2),
      type,
      x:     startX,
      y:     cfg.yMin + Math.random() * (cfg.yMax - cfg.yMin),
      speed: (cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin)) * this.stormSpeedMultiplier,
      alpha: cfg.alphaMin + Math.random() * (cfg.alphaMax - cfg.alphaMin),
      scale: cfg.scale * (0.85 + Math.random() * 0.30),
      layer,
      tint,
    };

    this.clouds.push(inst);
    this.createCloudSprite(inst, cfg.depth);
  }

  private createCloudSprite(inst: CloudInstance, depth: number): void {
    const key = getCloudTextureKey(inst.type, inst.tint);
    const img = this.scene.add.image(inst.x, inst.y, key)
      .setScrollFactor(0)
      .setDepth(depth)
      .setAlpha(inst.alpha)
      .setScale(inst.scale)
      .setOrigin(0, 0);
    this.sprites.set(inst.id, img);
  }

  getSprite(id: string): Phaser.GameObjects.Image | undefined {
    return this.sprites.get(id);
  }

  updateCloudTexture(cloud: CloudInstance): void {
    const sprite = this.sprites.get(cloud.id);
    if (!sprite) return;
    const key = getCloudTextureKey(cloud.type, cloud.tint);
    sprite.setTexture(key);
  }

  update(delta: number, gameHour: number): void {
    const newTint = this.getCurrentTint(gameHour);

    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cloud = this.clouds[i];
      cloud.x -= cloud.speed * (delta / 1000);
      const sprite = this.sprites.get(cloud.id);
      if (sprite) {
        sprite.setX(cloud.x);
        if (cloud.x < -200) {
          sprite.destroy();
          this.sprites.delete(cloud.id);
          this.clouds.splice(i, 1);
          continue;
        }
      }

      if (cloud.tint !== newTint) {
        cloud.tint = newTint;
        this.updateCloudTexture(cloud);
      }
    }
  }

  getCurrentTint(gameHour?: number): CloudTint {
    const h = gameHour ?? 12;
    if (h >= 5.5 && h < 7.5)  return 'dawn';
    if (h >= 7.5 && h < 17.5) return 'day';
    if (h >= 17.5 && h < 20)  return 'sunset';
    return 'day';
  }

  setMaxClouds(n: number): void {
    this.maxClouds = n;
    // 초과분 제거
    while (this.clouds.length > n) {
      const cloud = this.clouds.pop()!;
      this.sprites.get(cloud.id)?.destroy();
      this.sprites.delete(cloud.id);
    }
  }

  setStormCloudSpeed(multiplier: number): void {
    this.stormSpeedMultiplier = multiplier;
    this.clouds.forEach(c => {
      const cfg = LAYER_CONFIGS[c.layer];
      c.speed = (cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin)) * multiplier;
    });
  }

  replaceWithStormClouds(): void {
    this.clouds.forEach(cloud => {
      const sprite = this.sprites.get(cloud.id);
      if (!sprite) return;
      this.scene.tweens.add({
        targets: sprite, alpha: 0, duration: 3000,
        onComplete: () => {
          cloud.type = 'storm_cloud';
          cloud.tint = 'storm';
          this.updateCloudTexture(cloud);
          this.scene.tweens.add({ targets: sprite, alpha: cloud.alpha, duration: 3000 });
        },
      });
    });
  }

  destroy(): void {
    this.sprites.forEach(s => s.destroy());
    this.sprites.clear();
    this.clouds = [];
  }
}
