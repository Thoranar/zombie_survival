import { EventBus } from '@app/EventBus';
import type { Zombie } from '../entities/enemies/Zombie';
import { Player } from '../entities/Player';
import type { Wall } from '../entities/world/Wall';

export interface PlayerDamagedEvent {
  zombieId: string;
  amount: number;
  remainingHp: number;
}

export interface PlayerDiedEvent {
  killerId: string;
}

export interface StructureDamagedEvent {
  structureId: string;
  attackerId: string;
  amount: number;
  remainingHp: number;
}

export interface StructureDestroyedEvent {
  structureId: string;
  attackerId: string;
}

/**
 * Responsibility: Resolve melee combat between zombies, the player, and fortifications.
 * Publishes: PlayerDamaged, PlayerDied, StructureDamaged, StructureDestroyed
 * Subscribes: none
 * Config: zombie attack stats from enemies.json5, player HP from game.json5
 */
export class CombatSystem {
  private readonly bus: EventBus;
  private readonly tileSize: number;
  private readonly cooldowns: Map<string, number> = new Map();

  constructor(bus: EventBus, tileSize: number) {
    this.bus = bus;
    this.tileSize = tileSize;
  }

  public update(dtSec: number, zombies: readonly Zombie[], player: Player, structures: readonly Wall[]): void {
    const active = new Set<string>();
    for (const zombie of zombies) {
      active.add(zombie.id);
      const remainingCd = Math.max(0, (this.cooldowns.get(zombie.id) ?? 0) - dtSec);
      this.cooldowns.set(zombie.id, remainingCd);
      if (zombie.state !== 'attack') continue;

      const structureTarget = zombie.getAttackStructure();
      if (structureTarget) {
        const structure = structures.find((s) => s.id === structureTarget.id);
        const structureValid = structure && structure.playerBuilt && !(structure.type === 'Door' && structure.isOpen);
        if (!structureValid) {
          zombie.clearAttackStructure();
        } else {
          const s = structure as Wall;
          const sx = Math.max(structureTarget.x - structureTarget.hw, Math.min(zombie.x, structureTarget.x + structureTarget.hw));
          const sy = Math.max(structureTarget.y - structureTarget.hh, Math.min(zombie.y, structureTarget.y + structureTarget.hh));
          const dxS = sx - zombie.x;
          const dyS = sy - zombie.y;
          const distSqS = dxS * dxS + dyS * dyS;
          const rangeS = zombie.stats.attackRangeTiles * this.tileSize;
          if (distSqS <= rangeS * rangeS) {
            if (remainingCd > 0) continue;
            const dealt = Math.max(0, zombie.stats.attackPower);
            if (dealt > 0) {
              s.hp = Math.max(0, s.hp - dealt);
              this.cooldowns.set(zombie.id, zombie.stats.attackIntervalSec);
              this.bus.emit<StructureDamagedEvent>('StructureDamaged', {
                structureId: s.id,
                attackerId: zombie.id,
                amount: dealt,
                remainingHp: s.hp
              });
              if (s.hp <= 0) {
                this.bus.emit<StructureDestroyedEvent>('StructureDestroyed', {
                  structureId: s.id,
                  attackerId: zombie.id
                });
                zombie.clearAttackStructure();
              }
            } else {
              this.cooldowns.set(zombie.id, 0);
            }
            continue;
          }
          continue;
        }
      }

      if (player.isDead()) continue;
      const dx = zombie.x - player.x;
      const dy = zombie.y - player.y;
      const distSq = dx * dx + dy * dy;
      const range = zombie.stats.attackRangeTiles * this.tileSize;
      if (distSq > range * range) continue;
      if (remainingCd > 0) continue;
      const dealt = player.applyDamage(zombie.stats.attackPower);
      if (dealt <= 0) {
        this.cooldowns.set(zombie.id, 0);
        continue;
      }
      this.cooldowns.set(zombie.id, zombie.stats.attackIntervalSec);
      this.bus.emit<PlayerDamagedEvent>('PlayerDamaged', {
        zombieId: zombie.id,
        amount: dealt,
        remainingHp: player.getHp()
      });
      if (player.isDead()) {
        this.bus.emit<PlayerDiedEvent>('PlayerDied', { killerId: zombie.id });
        break;
      }
    }
    for (const id of Array.from(this.cooldowns.keys())) {
      if (!active.has(id)) this.cooldowns.delete(id);
    }
  }

  public reset(): void {
    this.cooldowns.clear();
  }
}



