import { describe, it, expect } from 'vitest';
import { InventorySystem } from '../../../src/core/systems/InventorySystem';

describe('InventorySystem', () => {
  it('adds, takes all, and resets totals', () => {
    const inv = new InventorySystem({ Scrap: 1, Wood: 1 }, 10);
    inv.add('Scrap', 3);
    inv.add('Wood', 2);
    expect(inv.getCarryWeight()).toBe(5);
    const all = inv.takeAll();
    expect(all.Scrap).toBe(3);
    expect(all.Wood).toBe(2);
    expect(inv.getCarryWeight()).toBe(0);
  });
});

