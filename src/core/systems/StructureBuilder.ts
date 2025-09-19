import { Structure } from '@core/entities/world/Structure';
import { Wall } from '@core/entities/world/Wall';

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
        label: key,
        kind: key,
        category: 'Fortifications',
        footprintTiles: Math.max(1, Math.floor(entry?.footprintTiles ?? 1)),
        cost,
        maxHp: Math.max(1, Math.floor(entry?.hp ?? 100)),
        buildTimeSec: Math.max(0.25, Number(entry?.buildTimeSec ?? 2.5)),
        noisePerSec: Math.max(0, Number(entry?.noisePerSec ?? 0.4))
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
    switch (blueprint.kind) {
      case 'Wall':
      case 'Door':
        return new Wall({
          id: instanceId,
          tileSize: this.tileSize,
          hp: blueprint.maxHp,
          cost: blueprint.cost,
          buildTimeSec: blueprint.buildTimeSec,
          noisePerSec: blueprint.noisePerSec,
          footprintTiles: blueprint.footprintTiles,
          type: (blueprint.kind as 'Wall' | 'Door')
        });
      default:
        throw new Error(`No structure factory implemented for kind: ${blueprint.kind}`);
    }
  }
}

