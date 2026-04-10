import { SwordAttackAnimator }  from './SwordAttackAnimator';
import { AxeAttackAnimator }    from './AxeAttackAnimator';
import { BowAttackAnimator }    from './BowAttackAnimator';
import { StaffAttackAnimator }  from './StaffAttackAnimator';
import { SpearAttackAnimator }  from './SpearAttackAnimator';
import { DaggerAttackAnimator } from './DaggerAttackAnimator';

export type WeaponType =
  | 'sword' | 'axe' | 'bow' | 'staff' | 'spear' | 'dagger';

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIR_OFFSETS: Record<Direction, { x: number; y: number }> = {
  up:    { x:  0, y: -1 },
  down:  { x:  0, y:  1 },
  left:  { x: -1, y:  0 },
  right: { x:  1, y:  0 },
};

export const DIR_BASE_ANGLES: Record<Direction, number> = {
  up:    -Math.PI / 2,
  down:   Math.PI / 2,
  left:   Math.PI,
  right:  0,
};

export class WeaponAttackSystem {
  private sword  = new SwordAttackAnimator();
  private axe    = new AxeAttackAnimator();
  private bow    = new BowAttackAnimator();
  private staff  = new StaffAttackAnimator();
  private spear  = new SpearAttackAnimator();
  private dagger = new DaggerAttackAnimator();

  attack(
    weapon: WeaponType,
    scene: Phaser.Scene,
    attacker: Phaser.GameObjects.Sprite,
    dir: Direction
  ): void {
    switch (weapon) {
      case 'sword':  this.sword.attack(scene, attacker, dir);  break;
      case 'axe':    this.axe.attack(scene, attacker, dir);    break;
      case 'staff':  this.staff.attack(scene, attacker, dir);  break;
      case 'spear':  this.spear.attack(scene, attacker, dir);  break;
      case 'dagger': this.dagger.attack(scene, attacker, dir); break;
      case 'bow':    this.bow.release(scene, attacker, dir);   break;
    }
  }

  startBowCharge(scene: Phaser.Scene, attacker: Phaser.GameObjects.Sprite): void {
    this.bow.startCharge(scene, attacker);
  }

  cancelBowCharge(): void {
    this.bow.cancelCharge();
  }
}
