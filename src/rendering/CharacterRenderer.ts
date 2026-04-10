import Phaser from 'phaser';
import {
  Direction,
  WEAPON_OFFSETS, SHIELD_OFFSETS,
  getWeaponOverlayKey, getArmorOverlayKey, getShieldOverlayKey,
} from '../config/overlays';

export class CharacterRenderer {
  private weaponSprite: Phaser.GameObjects.Sprite | null = null;
  private armorSprite: Phaser.GameObjects.Sprite | null = null;
  private shieldSprite: Phaser.GameObjects.Sprite | null = null;

  private currentWeapon: string | null = null;
  private currentArmor: string | null = null;
  private currentShield: string | null = null;

  private lastAnimKey = '';

  constructor(
    private scene: Phaser.Scene,
    readonly sprite: Phaser.GameObjects.Sprite,
    private skin: number,
  ) {}

  // ── Equipment overlay management ─────────────────────────────────────────────

  updateEquipment(weapon: string | null, armor: string | null, shield: string | null): void {
    this.syncOverlay('weapon', weapon, this.currentWeapon, getWeaponOverlayKey, (s) => { this.weaponSprite = s; });
    this.syncOverlay('armor',  armor,  this.currentArmor,  getArmorOverlayKey,  (s) => { this.armorSprite = s; });
    this.syncOverlay('shield', shield, this.currentShield, getShieldOverlayKey, (s) => { this.shieldSprite = s; });
    this.currentWeapon = weapon;
    this.currentArmor  = armor;
    this.currentShield = shield;
  }

  private syncOverlay(
    _slot: string,
    newId: string | null,
    oldId: string | null,
    keyFn: (id: string | null) => string | null,
    setter: (s: Phaser.GameObjects.Sprite | null) => void,
  ): void {
    if (newId === oldId) return;
    // destroy old
    if (_slot === 'weapon') this.weaponSprite?.destroy();
    else if (_slot === 'armor') this.armorSprite?.destroy();
    else this.shieldSprite?.destroy();

    const textureKey = keyFn(newId);
    if (textureKey && this.scene.textures.exists(textureKey)) {
      setter(this.scene.add.sprite(this.sprite.x, this.sprite.y, textureKey).setDepth(this.sprite.depth));
    } else {
      setter(null);
    }
  }

  // ── Per-frame update ──────────────────────────────────────────────────────────

  update(
    dir: Direction,
    isMoving: boolean,
    time: number,
    hp: number,
    hunger: number,
    isFrenzy: boolean,
    isSleeping: boolean,
  ): void {
    const x = this.sprite.x;
    const y = this.sprite.y;
    const depth = this.sprite.depth;

    // Animation
    const actualDir = dir === 'right' ? 'left' : dir;
    const animKey = isMoving
      ? `walk_${this.skin}_${actualDir}`
      : `idle_${this.skin}_${actualDir}`;

    if (this.lastAnimKey !== animKey) {
      this.sprite.play(animKey, true);
      this.lastAnimKey = animKey;
    }
    this.sprite.setFlipX(dir === 'right');

    // Breathing on idle
    if (!isMoving && !isSleeping) {
      const breathScale = 1.0 + Math.sin(time * 1.2) * 0.012;
      this.sprite.setScale(1.0, breathScale);
    } else {
      this.sprite.setScale(1.0, 1.0);
    }

    // Visual state (priority order: flash > frenzy > hp_crit > hunger_warn)
    if (isSleeping) {
      this.sprite.setAngle(90);
      this.sprite.setAlpha(0.7);
      this.sprite.clearTint();
    } else if (isFrenzy) {
      this.sprite.setAngle(0);
      this.sprite.setTint(0xff6666);
      this.sprite.setAlpha(1);
    } else if (hp <= 10) {
      this.sprite.setAngle(0);
      const pulse = Math.sin(time * 4) * 0.5 + 0.5;
      const r = Math.floor(Phaser.Math.Linear(200, 255, pulse));
      this.sprite.setTint(Phaser.Display.Color.GetColor(r, 100, 100));
      this.sprite.setAlpha(1);
    } else if (hunger <= 20) {
      this.sprite.setAngle(0);
      this.sprite.clearTint();
      const alpha = Math.sin(time * 3) * 0.15 + 0.85;
      this.sprite.setAlpha(alpha);
    } else {
      this.sprite.setAngle(0);
      this.sprite.clearTint();
      this.sprite.setAlpha(1);
    }

    // Update overlay positions
    if (this.weaponSprite) {
      const wo = WEAPON_OFFSETS[dir];
      this.weaponSprite
        .setPosition(x + wo.x, y + wo.y)
        .setAngle(wo.angle)
        .setDepth(depth + 0.1)
        .setFlipX(dir === 'right');
    }
    if (this.armorSprite) {
      this.armorSprite.setPosition(x, y).setDepth(depth + 0.05);
    }
    if (this.shieldSprite) {
      const so = SHIELD_OFFSETS[dir];
      this.shieldSprite.setPosition(x + so.x, y + so.y).setDepth(depth + 0.02);
    }
  }

  // ── Hit flash ─────────────────────────────────────────────────────────────────

  flashHit(): void {
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.sprite.active) return;
      this.sprite.clearTint();
    });
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  destroy(): void {
    this.weaponSprite?.destroy();
    this.armorSprite?.destroy();
    this.shieldSprite?.destroy();
  }
}
