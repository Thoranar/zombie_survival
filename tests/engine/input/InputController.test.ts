import { describe, it, expect } from 'vitest';
import { InputController } from '../../../src/engine/input/InputController';

describe('InputController', () => {
  it('maps WASD to normalized vector', () => {
    const ic = new InputController();
    ic.setKeyState('w', true);
    const up = ic.getMoveDir();
    expect(up.x).toBe(0);
    expect(up.y).toBe(-1);

    ic.setKeyState('d', true);
    const upRight = ic.getMoveDir();
    expect(Math.abs(upRight.x - Math.SQRT1_2)).toBeLessThan(1e-9);
    expect(Math.abs(upRight.y + Math.SQRT1_2)).toBeLessThan(1e-9);

    ic.setKeyState('w', false);
    ic.setKeyState('d', false);
    const idle = ic.getMoveDir();
    expect(idle.x).toBe(0);
    expect(idle.y).toBe(0);
  });

  it('detects crouch and sprint modifiers', () => {
    const ic = new InputController();
    expect(ic.isCrouching()).toBe(false);
    expect(ic.isSprinting()).toBe(false);
    ic.setKeyState('Control', true);
    expect(ic.isCrouching()).toBe(true);
    ic.setKeyState('Control', false);
    ic.setKeyState('Shift', true);
    expect(ic.isSprinting()).toBe(true);
  });
});

