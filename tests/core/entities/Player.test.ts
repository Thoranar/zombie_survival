import { describe, it, expect } from 'vitest';
import { Player } from '../../../src/core/entities/Player';
import { InputController } from '../../../src/engine/input/InputController';
import { ConfigService } from '../../../src/core/data/ConfigService';

const makeCfg = () => {
  const svc = new ConfigService();
  // Use public config to stay in sync with values
  svc.loadGameConfig('public/config/game.json5');
  return svc;
};

describe('Player movement', () => {
  it('selects speed mode based on input modifiers', () => {
    const cfg = makeCfg();
    const ic = new InputController();
    const p = new Player('p', cfg, ic);
    ic.setKeyState('w', true);
    const dt = 1; // seconds
    const tile = cfg.getGame().tileSize;

    // walk
    const x0 = p.x;
    const y0 = p.y;
    p.update(dt);
    const walked = y0 - p.y; // moving up
    expect(Math.round(walked)).toBe(Math.round(cfg.getGame().player.walkSpeed * tile * dt));

    // crouch
    ic.setKeyState('Control', true);
    p.update(dt);
    const crouched = (y0 - walked) - p.y;
    expect(Math.round(crouched)).toBe(Math.round(cfg.getGame().player.crouchSpeed * tile * dt));

    // sprint
    ic.setKeyState('Control', false);
    ic.setKeyState('Shift', true);
    p.update(dt);
    const sprinted = (y0 - walked - crouched) - p.y;
    expect(Math.round(sprinted)).toBe(Math.round(cfg.getGame().player.sprintSpeed * tile * dt));
  });
});
