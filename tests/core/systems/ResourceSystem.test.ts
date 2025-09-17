import { describe, it, expect } from 'vitest';
import { EventBus } from '../../../src/app/EventBus';
import { ConfigService } from '../../../src/core/data/ConfigService';
import { ResourceSystem } from '../../../src/core/systems/ResourceSystem';
import { ResourceNode } from '../../../src/core/entities/ResourceNode';

function makeCfg(): ConfigService {
  const cfg = new ConfigService();
  cfg.loadResourcesConfig('public/config/resources.json5');
  return cfg;
}

describe('ResourceSystem', () => {
  it('harvest applies rate and emits NodeDepleted', () => {
    const bus = new EventBus();
    const cfg = makeCfg();
    const sys = new ResourceSystem(bus, cfg);
    const max = cfg.getResources().nodes.ScrapHeap.capacityMax;
    const node = new ResourceNode('n1', { id: 'n1', archetype: 'ScrapHeap', capacity: 3 }, 10);
    node.throttle = 'Loud';
    sys.addNode(node);
    let depleted = 0;
    bus.on('NodeDepleted', () => { depleted += 1; });
    const rate = cfg.getResources().throttles.Loud.ratePerSec;
    const dt = 3 / rate + 0.001;
    const res = sys.harvest(node, dt);
    expect(res.harvested).toBeGreaterThan(0);
    expect(node.capacity).toBe(0);
    expect(depleted).toBe(1);
  });

  it('respects different throttle speeds', () => {
    const bus = new EventBus();
    const cfg = makeCfg();
    const sys = new ResourceSystem(bus, cfg);
    const node = new ResourceNode('n2', { id: 'n2', archetype: 'ScrapHeap', capacity: 100 }, 10);
    sys.addNode(node);
    node.throttle = 'Quiet';
    sys.harvest(node, 2);
    const quietLeft = node.capacity;
    node.throttle = 'Loud';
    sys.harvest(node, 2);
    const loudLeft = node.capacity;
    // Loud should remove more capacity over same time
    expect(loudLeft).toBeLessThan(quietLeft);
  });
});
