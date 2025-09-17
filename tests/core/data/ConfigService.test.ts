import { describe, it, expect } from 'vitest';
import { ConfigService, resolvePublicConfigPath } from '../../../src/core/data/ConfigService';
import fs from 'node:fs';
import path from 'node:path';

describe('ConfigService', () => {
  it('parses JSON5 comments and trailing commas', () => {
    const tmpDir = path.join(process.cwd(), 'tests', 'fixtures');
    const file = path.join(tmpDir, 'game.json5');
    const json5 = `{
      // comment line
      "tileSize": 32,
      "dayNight": { "daySec": 120, "nightSec": 90, "eclipseSec": 180, "eclipseEvery": 3 },
      "player": { "hp": 100, "walkSpeed": 1, "crouchSpeed": 1, "sprintSpeed": 1, "pushCooldownSec": 1, "carryCap": 1 },
      /* block comment */
      "storage": { "autoDepositRadius": 2, },
      "horde": { "noiseThreshold": 70, "sustainSec": 4, "cooldownSec": 30 },
      "loop": { "tickHz": 60 },
      "render": { "playerRadiusTiles": 0.35 },
    }`;
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(file, json5);
    const svc = new ConfigService();
    svc.loadGameConfig(file);
    const cfg = svc.getGame();
    expect(cfg.tileSize).toBe(32);
    // @ts-expect-error extra props allowed in runtime
    expect(cfg.loop.tickHz).toBe(60);
  });

  it('loads from public config path helper', () => {
    const file = resolvePublicConfigPath('game.json5');
    const exists = fs.existsSync(file);
    expect(exists).toBe(true);
  });
});

