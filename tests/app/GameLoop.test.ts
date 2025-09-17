import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/app/EventBus';

describe('Fixed step loop (unit)', () => {
  it('emits tick events at fixed dt when stepped manually', () => {
    const bus = new EventBus();
    const ticks: number[] = [];
    bus.on<number>('tick', (dt) => ticks.push(dt));

    // Emulate a very small integrator: push 10 ticks of 1/60
    const steps = 10;
    const fixedDt = 1 / 60;
    for (let i = 0; i < steps; i += 1) bus.emit('tick', fixedDt);

    expect(ticks.length).toBe(steps);
    expect(ticks.every((d) => Math.abs(d - fixedDt) < 1e-9)).toBe(true);
  });
});
