import { Structure } from '@core/entities/world/Structure';
import { Trap } from '@core/entities/world/Trap';
import { Wall } from '@core/entities/world/Wall';

export interface TrapBlueprintConfig {
  damageOnTrigger: number;
  selfDamageOnTrigger: number;
  icon: string;
  triggerIntervalSec: number;
}

export interface StructureBlueprint {
  id: string;
  label: string;
  kind: string;
  category: string;
  footprintTiles: number;
  cost: Record<string, number>;
  maxHp: number;
  buildTimeSec: number;
  noisePerSec: number;
  role: 'fort' | 'trap';
  trap?: TrapBlueprintConfig;
}

/**
 * Responsibility: Parse buildable definitions and spawn structure instances for placement.
 */
export class StructureBuilder {
  private readonly tileSize: number;
  private readonly blueprints: StructureBlueprint[] = [];

  constructor(buildablesConfig: any, tileSize: number) {
    this.tileSize = tileSize;
    this.parse(buildablesConfig ?? {});
  }

  private parse(config: any): void {
    const fort = (config?.fort ?? {}) as Record<string, any>;
    for (const [key, value] of Object.entries(fort)) {
      const entry = value as any;
      const cost: Record<string, number> = {};
      for (const [resource, amount] of Object.entries(entry?.cost ?? {})) {
        cost[resource] = Number(amount ?? 0);
      }
      const blueprint: StructureBlueprint = {
        id: `fort:${key}`,
        label: String(entry?.label ?? key),
        kind: key,
        category: 'Fortifications',
        footprintTiles: Math.max(1, Math.floor(entry?.footprintTiles ?? 1)),
        cost,
        maxHp: Math.max(1, Math.floor(entry?.hp ?? 100)),
        buildTimeSec: Math.max(0.25, Number(entry?.buildTimeSec ?? 2.5)),
        noisePerSec: Math.max(0, Number(entry?.noisePerSec ?? 0.4)),
        role: 'fort'
      };
      this.blueprints.push(blueprint);
    }

    const traps = (config?.traps ?? {}) as Record<string, any>;
    for (const [key, value] of Object.entries(traps)) {
      const entry = value as any;
      const cost: Record<string, number> = {};
      for (const [resource, amount] of Object.entries(entry?.cost ?? {})) {
        cost[resource] = Number(amount ?? 0);
      }
      const trapStats: TrapBlueprintConfig = {
        damageOnTrigger: Math.max(0, Number(entry?.damageOnTrigger ?? entry?.trapDamage ?? 0)),
        selfDamageOnTrigger: Math.max(0, Number(entry?.selfDamageOnTrigger ?? entry?.selfDamage ?? 0)),
        icon: String(entry?.icon ?? 'spike'),
        triggerIntervalSec: Math.max(0, Number(entry?.triggerIntervalSec ?? 1))
      };
      const blueprint: StructureBlueprint = {
        id: `trap:${key}`,
        label: String(entry?.label ?? key),
        kind: key,
        category: 'Traps',
        footprintTiles: Math.max(1, Math.floor(entry?.footprintTiles ?? 1)),
        cost,
        maxHp: Math.max(1, Math.floor(entry?.hp ?? 60)),
        buildTimeSec: Math.max(0.25, Number(entry?.buildTimeSec ?? 2.0)),
        noisePerSec: Math.max(0, Number(entry?.noisePerSec ?? 0.2)),
        role: 'trap',
        trap: trapStats
      };
      this.blueprints.push(blueprint);
    }
  }

  public getBlueprints(): readonly StructureBlueprint[] {
    return this.blueprints;
  }

  public getBlueprint(id: string): StructureBlueprint | undefined {
    return this.blueprints.find((bp) => bp.id === id);
  }

  public createStructureInstance(blueprintId: string, instanceId: string): Structure {
    const blueprint = this.getBlueprint(blueprintId);
    if (!blueprint) {
      throw new Error(`Unknown structure blueprint: ${blueprintId}`);
    }
    if (blueprint.role === 'fort') {
      const type: 'Wall' | 'Door' = blueprint.kind === 'Door' ? 'Door' : 'Wall';
      return new Wall({
        id: instanceId,
        tileSize: this.tileSize,
        hp: blueprint.maxHp,
        cost: blueprint.cost,
        buildTimeSec: blueprint.buildTimeSec,
        noisePerSec: blueprint.noisePerSec,
        footprintTiles: blueprint.footprintTiles,
        type
      });
    }
    if (blueprint.role === 'trap' && blueprint.trap) {
      return new Trap({
        id: instanceId,
        kind: blueprint.kind,
        tileSize: this.tileSize,
        footprintTiles: blueprint.footprintTiles,
        maxHp: blueprint.maxHp,
        cost: blueprint.cost,
        buildTimeSec: blueprint.buildTimeSec,
        noisePerSec: blueprint.noisePerSec,
        damageOnTrigger: blueprint.trap.damageOnTrigger,
        selfDamageOnTrigger: blueprint.trap.selfDamageOnTrigger,
        icon: blueprint.trap.icon,
        triggerIntervalSec: blueprint.trap.triggerIntervalSec
      });
    }
    throw new Error(`No structure factory implemented for kind: ${blueprint.kind}`);
  }
}
