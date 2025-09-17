import { describe, it, expect } from 'vitest';
import { TimeSystem } from '../../../src/core/systems/TimeSystem';

describe('TimeSystem', () => {
  it('transitions day -> night -> day with correct durations', () => {
    const t = new TimeSystem({ daySec: 10, nightSec: 5, eclipseSec: 7, eclipseEvery: 3 });
    expect(t.getPhase()).toBe('day');
    // advance less than a day
    t.tick(3);
    expect(Math.round(t.getTimeLeftSec())).toBe(7);
    // finish day
    t.tick(7);
    expect(t.getPhase()).toBe('night');
    expect(Math.round(t.getTimeLeftSec())).toBe(5);
    // finish night
    t.tick(5);
    expect(t.getPhase()).toBe('day');
    expect(t.getDayNumber()).toBe(2);
  });

  it('marks every Nth night as eclipse using eclipseSec', () => {
    const t = new TimeSystem({ daySec: 2, nightSec: 2, eclipseSec: 4, eclipseEvery: 2 });
    // Cycle 1 night (normal)
    t.tick(2); // finish day
    expect(t.getPhase()).toBe('night');
    expect(Math.round(t.getTimeLeftSec())).toBe(2);
    t.tick(2); // finish night
    expect(t.getPhase()).toBe('day');
    // Cycle 2 night (eclipse)
    t.tick(2); // finish day
    expect(t.getPhase()).toBe('eclipse');
    expect(Math.round(t.getTimeLeftSec())).toBe(4);
  });
});

