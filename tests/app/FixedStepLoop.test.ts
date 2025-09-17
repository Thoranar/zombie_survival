import { describe, it, expect } from 'vitest';
import { FixedStepLoop } from '../../src/app/FixedStepLoop';

describe('FixedStepLoop', () => {
  it('accumulates time and steps deterministically', () => {
    const steps: number[] = [];
    const stepSec = 1 / 60;
    const loop = new FixedStepLoop(stepSec, () => steps.push(1));
    let now = 0;
    loop.start(now);

    now += stepSec * 0.5; // half step, should not step yet
    expect(loop.tick(now)).toBe(0);
    expect(steps.length).toBe(0);

    now += stepSec * 0.6; // total 1.1 steps -> 1 step
    expect(loop.tick(now)).toBe(1);
    expect(steps.length).toBe(1);

    now += stepSec * 3.0; // 3 steps
    expect(loop.tick(now)).toBe(3);
    expect(steps.length).toBe(4);

    // large delta clamps to at most 5 steps worth of accumulation
    now += stepSec * 20.0;
    const stepped = loop.tick(now);
    expect(stepped).toBeGreaterThan(0);
    expect(stepped).toBeLessThanOrEqual(5);
  });
});

