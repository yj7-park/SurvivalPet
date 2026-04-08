import Phaser from 'phaser';
import { Animal } from '../entities/Animal';
import { Player } from '../entities/Player';
import { CharacterStats } from '../entities/CharacterStats';
import { SurvivalStats } from './SurvivalStats';
import { Inventory } from './Inventory';
import { AnimalManager } from './AnimalManager';
import { SeededRandom } from '../utils/seedRandom';
import { WeaponConfig, calcDamage, calcCooldownMs, calcDodgeChance, WEAPONS } from '../config/weapons';
import { TILE_SIZE } from '../world/MapGenerator';

export class CombatSystem {
  private lockedTarget: Animal | null = null;
  private _tracking = false;   // true = 자동 추적, false = 수동 이동(락온 유지)
  private attackTimer = 0;
  private equippedWeaponId: string | null = null;
  private lockCircle: Phaser.GameObjects.Arc;
  private projectiles: Phaser.GameObjects.Rectangle[] = [];
  private damageTexts: { text: Phaser.GameObjects.Text; vy: number; life: number }[] = [];
  private hitFlashCallback: (() => void) | null = null;
  private combatEndCallback: (() => void) | null = null;

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
    private stats: CharacterStats,
    private survival: SurvivalStats,
    private inventory: Inventory,
    private animalMgr: AnimalManager,
    private rng: SeededRandom,
  ) {
    // Lock-on indicator: red circle around target
    this.lockCircle = scene.add.arc(0, 0, 18, 0, 360, false, 0xff0000, 0)
      .setStrokeStyle(1.5, 0xff3333, 0.8).setDepth(3).setVisible(false);
  }

  get equippedWeapon(): WeaponConfig | null {
    if (!this.equippedWeaponId) return null;
    return WEAPONS.find(w => w.id === this.equippedWeaponId) ?? null;
  }

  equipWeapon(id: string | null): void {
    this.equippedWeaponId = id;
  }

  lockOn(target: Animal): void {
    this.lockedTarget = target;
    this._tracking = true;   // 클릭할 때마다 추적 모드로 진입
    this.attackTimer = 0;
  }

  unlock(): void {
    const wasTargeted = this.lockedTarget !== null && this.lockedTarget.isDead;
    this.lockedTarget = null;
    this._tracking = false;
    this.lockCircle.setVisible(false);
    // 적이 죽었으면 전투 종료 콜백 호출 (큐 진행)
    if (wasTargeted) {
      this.combatEndCallback?.();
    }
  }

  /** 이동키 입력 시: 추적만 해제하고 락온은 유지 */
  stopTracking(): void { this._tracking = false; }

  get tracking(): boolean { return this._tracking; }
  isLockedOn(): boolean { return this.lockedTarget !== null; }
  getLockedTarget(): Animal | null { return this.lockedTarget; }

  setHitFlashCallback(cb: () => void): void { this.hitFlashCallback = cb; }
  setCombatEndCallback(cb: () => void): void { this.combatEndCallback = cb; }

  /** Called when player takes damage from an animal */
  onPlayerHit(dmg: number): void {
    // Dodge check for player
    const dodge = calcDodgeChance(this.stats.agi);
    if (this.rng.next() < dodge) {
      this.spawnFloatText(this.player.sprite.x, this.player.sprite.y - 20, 'DODGE!', '#88ddff');
      return;
    }
    const actual = Math.max(1, Math.floor(dmg - this.stats.con * 0.5));
    this.survival.hp = Math.max(0, this.survival.hp - actual);
    this.spawnFloatText(this.player.sprite.x, this.player.sprite.y - 20, `-${actual}`, '#ff4444');
    this.hitFlashCallback?.();
  }

  update(delta: number): void {
    this.updateLockOn(delta);
    this.updateProjectiles(delta);
    this.updateDamageTexts(delta);
  }

  private updateLockOn(delta: number): void {
    if (!this.lockedTarget) return;
    if (this.lockedTarget.isDead) { this.unlock(); return; }
    if (this.survival.isIncapacitated) return;

    const weapon = this.equippedWeapon;
    const rangePx = (weapon?.rangeTiles ?? 1) * TILE_SIZE;
    const dx = this.lockedTarget.x - this.player.sprite.x;
    const dy = this.lockedTarget.y - this.player.sprite.y;
    const dist = Math.hypot(dx, dy);

    // Move lock-on circle
    this.lockCircle.setPosition(this.lockedTarget.x, this.lockedTarget.y).setVisible(true);

    this.attackTimer -= delta;
    if (dist <= rangePx) {
      if (this.attackTimer <= 0) {
        this.attackTimer = calcCooldownMs(weapon, this.stats.agi);
        this.executeAttack();
      }
    }
    // Note: auto-movement toward target is handled in GameScene
  }

  private executeAttack(): void {
    if (!this.lockedTarget || this.lockedTarget.isDead) return;
    const weapon = this.equippedWeapon;
    if (weapon?.type === 'ranged') {
      this.spawnArrow(this.lockedTarget);
    } else {
      const tx = this.lockedTarget.x, ty = this.lockedTarget.y;
      this.applyMeleeDamage(this.lockedTarget);
      this.spawnHitFlash(tx, ty); // lockedTarget이 죽어서 null이 될 수 있으므로 미리 캡처
    }
  }

  private applyMeleeDamage(target: Animal): void {
    const dmg = calcDamage(this.equippedWeapon, this.stats.str);
    const drops = this.animalMgr.attackAnimal(target, dmg, this.player.sprite.x, this.player.sprite.y, this.rng);
    drops.forEach(d => this.inventory.add(d.itemKey, d.count));
    this.spawnFloatText(target.x, target.y - 20, `-${dmg}`, '#ff6666');
    if (target.isDead) { this.survival.addAction(10); this.unlock(); }
  }

  private spawnArrow(target: Animal): void {
    const px = this.player.sprite.x, py = this.player.sprite.y;
    const dx = target.x - px, dy = target.y - py;
    const dist = Math.hypot(dx, dy);
    const nx = dx / dist, ny = dy / dist;
    const speed = this.equippedWeapon?.projectileSpeed ?? 300;

    const arrow = this.scene.add.rectangle(px, py, 10, 3, 0xddcc88).setDepth(3);
    arrow.setRotation(Math.atan2(dy, dx));
    this.projectiles.push(arrow);

    (arrow as unknown as Record<string, unknown>)['vx'] = nx * speed;
    (arrow as unknown as Record<string, unknown>)['vy'] = ny * speed;
    (arrow as unknown as Record<string, unknown>)['dmg'] = calcDamage(this.equippedWeapon, this.stats.str);
    (arrow as unknown as Record<string, unknown>)['target'] = target;
  }

  private updateProjectiles(delta: number): void {
    const dt = delta / 1000;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const arrow = this.projectiles[i] as unknown as Record<string, unknown>;
      (arrow as unknown as Phaser.GameObjects.Rectangle).x += (arrow['vx'] as number) * dt;
      (arrow as unknown as Phaser.GameObjects.Rectangle).y += (arrow['vy'] as number) * dt;

      const target = arrow['target'] as Animal;
      const arrowRect = arrow as unknown as Phaser.GameObjects.Rectangle;
      if (!target.isDead) {
        const dist = Math.hypot(target.x - arrowRect.x, target.y - arrowRect.y);
        if (dist < 16) {
          // Hit
          const dmg = arrow['dmg'] as number;
          const drops = this.animalMgr.attackAnimal(
            target, dmg, this.player.sprite.x, this.player.sprite.y, this.rng,
          );
          drops.forEach(d => this.inventory.add(d.itemKey, d.count));
          this.spawnFloatText(target.x, target.y - 20, `-${dmg}`, '#ff6666');
          this.spawnHitFlash(target.x, target.y);
          if (target.isDead) {
            this.survival.addAction(10);
            if (this.lockedTarget === target) this.unlock();
          }
          arrowRect.destroy();
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      // Out of range or off map
      const maxRange = (this.equippedWeapon?.rangeTiles ?? 8) * TILE_SIZE;
      const originDist = Math.hypot(
        arrowRect.x - this.player.sprite.x,
        arrowRect.y - this.player.sprite.y,
      );
      if (
        originDist > maxRange + 64 ||
        arrowRect.x < -100 || arrowRect.x > 3300 ||
        arrowRect.y < -100 || arrowRect.y > 3300
      ) {
        arrowRect.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateDamageTexts(delta: number): void {
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const d = this.damageTexts[i];
      d.text.y += d.vy * (delta / 1000);
      d.life -= delta;
      d.text.setAlpha(Math.max(0, d.life / 800));
      if (d.life <= 0) { d.text.destroy(); this.damageTexts.splice(i, 1); }
    }
  }

  private spawnFloatText(x: number, y: number, msg: string, color: string): void {
    const t = this.scene.add.text(x, y, msg, {
      fontSize: '11px',
      color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setDepth(20).setOrigin(0.5);
    this.damageTexts.push({ text: t, vy: -40, life: 900 });
  }

  private spawnHitFlash(x: number, y: number): void {
    const flash = this.scene.add.rectangle(x, y, 24, 24, 0xffffff, 0.7).setDepth(15);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
  }

  destroy(): void {
    this.lockCircle.destroy();
    this.projectiles.forEach(p => (p as Phaser.GameObjects.GameObject).destroy());
    this.damageTexts.forEach(d => d.text.destroy());
  }
}
