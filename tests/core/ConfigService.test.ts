import { describe, it, expect } from 'vitest';
import { ConfigService, resolvePublicConfigPath } from '../../src/core/data/ConfigService';
import fs from 'node:fs';

describe('ConfigService', () => {
  it('loads and validates JSON5 game config', () => {
    const svc = new ConfigService();
    const p = resolvePublicConfigPath('game.json5');
    svc.loadGameConfig(p);
    const g = svc.getGame();
    expect(g.tileSize).toBeGreaterThan(0);
    expect(g.player.walkSpeed).toBeGreaterThan(0);
  });

  it('rejects invalid config missing required fields', () => {
    const svc = new ConfigService();
    const tmp = `{
      // missing tileSize
      "player": { "walkSpeed": 3.6 },
      "dayNight": { "daySec": 120 }
    }`;
    const path = 'public/config/__bad.json5';
    fs.writeFileSync(path, tmp, 'utf-8');
    try {
      expect(() => svc.loadGameConfig(path)).toThrowError();
    } finally {
      fs.unlinkSync(path);
    }
  });
});
