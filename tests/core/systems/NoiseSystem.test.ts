import { describe, it, expect } from 'vitest';
import { NoiseSystem } from '../../../src/core/systems/NoiseSystem';

describe('NoiseSystem', () => {
  it('ramps up toward movement target and decays when lower', () => {
    const ns = new NoiseSystem({ walkTiles: 4, crouchTiles: 2, sprintTiles: 7, rampTilesPerSec: 6, decayTilesPerSec: 5, harvestTilesPerNoise: 8, harvestScalePerSec: 0.15, tileSize: 10 });
    ns.setByMovement('walk');
    ns.tick(0.0, true); // establish target
    ns.tick(0.5, true); // ramp 3 tiles
    expect(Math.round(ns.getRadiusTiles())).toBe(3);
    ns.tick(1, true); // ramp to 4 (target)
    expect(Math.round(ns.getRadiusTiles())).toBe(4);
    // lower target to crouch -> decay
    ns.setByMovement('crouch');
    ns.tick(0.5, true);
    expect(ns.getRadiusTiles()).toBeLessThan(4);
    // px conversion
    expect(ns.getRadiusPx()).toBeGreaterThan(0);
  });

  it('adds harvesting contribution and ramps accordingly', () => {
    const ns = new NoiseSystem({ walkTiles: 0, crouchTiles: 0, sprintTiles: 0, rampTilesPerSec: 10, decayTilesPerSec: 5, harvestTilesPerNoise: 10, harvestScalePerSec: 0, tileSize: 10 });
    ns.setHarvestNoisePerSec(0.5); // target = 5 tiles
    ns.setByMovement('idle');
    ns.tick(0.3, true); // 3 tiles ramp (10*0.3)
    expect(Math.round(ns.getRadiusTiles())).toBe(3);
    ns.tick(0.2, true);
    expect(Math.round(ns.getRadiusTiles())).toBe(5);
  });

  it('applies pulse tiles for door open', () => {
    const ns = new NoiseSystem({ walkTiles: 0, crouchTiles: 0, sprintTiles: 0, rampTilesPerSec: 5, decayTilesPerSec: 5, harvestTilesPerNoise: 10, harvestScalePerSec: 0, tileSize: 10 });
    ns.addPulseTiles(2);
    expect(ns.getRadiusTiles()).toBe(2);
    ns.setByMovement('idle');
    ns.tick(0.5, false);
    expect(ns.getRadiusTiles()).toBeLessThan(2);
  });
});
