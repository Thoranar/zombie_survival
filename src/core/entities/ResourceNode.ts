import { Entity } from './Entity';

/**
 * Responsibility: Resource node with capacity and adjustable harvest throttle.
 * Publishes: NodeDepleted (via external bus by system)
 * Subscribes: none
 * Config: resources.nodes[archetype].*, resources.throttles.*
 */
export type ThrottleKey = 'Quiet' | 'Normal' | 'Loud';

export interface ResourceNodeStats {
  id: string;
  archetype: string;
  capacity: number; // units
}

export class ResourceNode extends Entity {
  public readonly archetype: string;
  public capacity: number;
  public throttle: ThrottleKey = 'Normal';
  public readonly radiusPx: number;

  constructor(id: string, stats: ResourceNodeStats, radiusPx: number) {
    super(id);
    this.archetype = stats.archetype;
    this.capacity = stats.capacity;
    this.radiusPx = radiusPx;
  }

  public isDepleted(): boolean { return this.capacity <= 0; }
}

