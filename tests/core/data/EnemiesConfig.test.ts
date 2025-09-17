import { describe, it, expect } from 'vitest';
import { ConfigService, resolvePublicConfigPath } from '../../../src/core/data/ConfigService';

describe('Enemies config', () => {
  it('throws if getEnemies called before load', () => {
    const cfg = new ConfigService();
    expect(() => cfg.getEnemies()).toThrow();
  });

  it('loads enemies.json5 and exposes BaseZombie', () => {
    const cfg = new ConfigService();
    const p = resolvePublicConfigPath('enemies.json5');
    cfg.loadEnemiesConfig(p);
    const e = cfg.getEnemies();
    expect(e).toBeTruthy();
    expect(e.BaseZombie).toBeTruthy();
    expect(typeof e.BaseZombie.walkTiles).toBe('number');
    expect(typeof e.BaseZombie.sprintTiles).toBe('number');
    expect(typeof e.BaseZombie.hp).toBe('number');
    expect(typeof e.BaseZombie.detectRadiusTiles).toBe('number');
  });
});

