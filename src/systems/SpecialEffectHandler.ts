import { SpecialEffectId, SpecialEffect } from '../data/SpecialEffects';
import { ItemData } from './ItemFactory';

export interface CombatContext {
  attackerHp:   number;
  maxHp:        number;
  damage:       number;
  targetCount:  number; // adjacent enemies for chain
  onHeal:       (amount: number) => void;
  onApplyStatus:(status: string, duration: number) => void;
  onChainDamage:(targets: number, dmg: number) => void;
  onSpeedBurst: (duration: number, multiplier: number) => void;
}

export interface DefenseContext {
  incomingDamage: number;
  attackerPos:    { x: number; y: number };
  onReflect:      (dmg: number) => void;
  onBlock:        () => void;
  onHeal:         (amount: number) => void;
}

export function processOnHitEffects(
  effects: SpecialEffect[],
  ctx: CombatContext
): number {
  let finalDamage = ctx.damage;

  for (const fx of effects) {
    switch (fx.id) {
      case 'burn_on_hit':
        if (Math.random() < (fx.tier === 2 ? 0.30 : 0.15))
          ctx.onApplyStatus('burning', fx.tier === 2 ? 5000 : 3000);
        break;
      case 'poison_on_hit':
        if (Math.random() < (fx.tier === 2 ? 0.18 : 0.10))
          ctx.onApplyStatus('poisoned', fx.tier === 2 ? 8000 : 5000);
        break;
      case 'stun_on_hit':
        if (Math.random() < (fx.tier === 2 ? 0.12 : 0.08))
          ctx.onApplyStatus('stunned', fx.tier === 2 ? 2500 : 1500);
        break;
      case 'lifesteal': {
        const heal = Math.round(ctx.damage * (fx.tier === 2 ? 0.12 : 0.08));
        ctx.onHeal(heal);
        break;
      }
      case 'chain_lightning': {
        const chains  = fx.tier === 2 ? 3 : 2;
        const chainDmg = Math.round(ctx.damage * 0.5);
        ctx.onChainDamage(chains, chainDmg);
        break;
      }
      case 'speed_burst':
        ctx.onSpeedBurst(3000, fx.tier === 2 ? 1.30 : 1.20);
        break;
    }
  }
  return finalDamage;
}

export function processOnDefenseEffects(
  effects: SpecialEffect[],
  ctx: DefenseContext
): number {
  let dmg = ctx.incomingDamage;

  for (const fx of effects) {
    switch (fx.id) {
      case 'thorns': {
        const reflectPct = fx.tier === 2 ? 0.25 : 0.15;
        ctx.onReflect(Math.round(dmg * reflectPct));
        break;
      }
      case 'damage_reduction':
        dmg = Math.round(dmg * (fx.tier === 2 ? 0.88 : 0.93));
        break;
      case 'block_chance':
        if (Math.random() < (fx.tier === 2 ? 0.08 : 0.05)) {
          ctx.onBlock();
          dmg = 0;
        }
        break;
      case 'regen_on_kill':
        // Called separately on kill event
        break;
    }
  }
  return dmg;
}

export function processOnKillEffects(
  effects: SpecialEffect[],
  onHeal: (amount: number) => void
): void {
  for (const fx of effects) {
    if (fx.id === 'regen_on_kill') {
      onHeal(fx.tier === 2 ? 25 : 15);
    }
  }
}

export function getPassiveBonuses(equippedItems: ItemData[]): {
  gatherBonus:  number;
  xpAura:       number;
  luckyFind:    number;
  autoRepair:   number;
} {
  let gatherBonus = 0, xpAura = 0, luckyFind = 0, autoRepair = 0;

  for (const item of equippedItems) {
    for (const fx of item.specialEffects) {
      switch (fx.id) {
        case 'gather_bonus':  gatherBonus += fx.tier === 2 ? 2 : 1; break;
        case 'xp_aura':       xpAura      += fx.tier === 2 ? 0.20 : 0.10; break;
        case 'lucky_find':    luckyFind   += fx.tier === 2 ? 0.08 : 0.05; break;
        case 'auto_repair':   autoRepair  += fx.tier === 2 ? 0.2 : 0.1; break;
      }
    }
  }
  return { gatherBonus, xpAura, luckyFind, autoRepair };
}
