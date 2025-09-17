import { EventBus } from '@app/EventBus';
import { ConfigService, ResourcesConfig } from '../data/ConfigService';
import { ResourceNode, ThrottleKey } from '../entities/ResourceNode';

/**
 * Responsibility: Manage resource nodes and apply harvesting per tick.
 * Publishes: 'NodeDepleted' when capacity reaches 0
 * Subscribes: none
 * Config: resources.nodes.*, resources.throttles.* (rates per second)
 */
export class ResourceSystem {
  private readonly bus: EventBus;
  private readonly cfg: ResourcesConfig;
  private readonly nodes: ResourceNode[] = [];

  constructor(bus: EventBus, cfg: ConfigService) {
    this.bus = bus;
    this.cfg = cfg.getResources();
  }

  public addNode(node: ResourceNode): void {
    this.nodes.push(node);
  }

  public getNodes(): readonly ResourceNode[] { return this.nodes; }

  public clear(): void {
    this.nodes.splice(0, this.nodes.length);
  }

  // Interactive harvest: apply depletion for a specific node and duration
  public harvest(node: ResourceNode, durationSec: number): { harvested: number; type: string } {
    const t = this.cfg.throttles[node.throttle as ThrottleKey];
    const rate = t?.ratePerSec ?? 0;
    const amount = Math.max(0, Math.min(node.capacity, rate * durationSec));
    node.capacity -= amount;
    if (node.capacity <= 0) {
      node.capacity = 0;
      this.bus.emit('NodeDepleted', { id: node.id, archetype: node.archetype });
      // remove
      const idx = this.nodes.findIndex((n) => n.id === node.id);
      if (idx >= 0) this.nodes.splice(idx, 1);
    }
    // yield type from config
    const arche = (this.cfg.nodes as any)[node.archetype];
    const type = String(arche?.yield ?? 'Scrap');
    return { harvested: amount, type };
  }
}
