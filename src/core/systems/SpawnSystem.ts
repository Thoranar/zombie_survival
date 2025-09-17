import { EventBus } from '@app/EventBus';
import { ConfigService } from '../data/ConfigService';
import { ResourceNode } from '../entities/ResourceNode';
import type { TimePhase } from './TimeSystem';

/**
 * Responsibility: Spawn resource nodes according to spawn.json5 rules and phase.
 * Publishes: none
 * Subscribes: none
 * Config: spawn.resourceNodes[*] with min, max, rarity, phase gating
 */
export interface SpawnTypeRule {
  min: number;
  max: number;
  rarity: number; // weight in random selection
  phase?: 'any' | 'day' | 'night' | 'eclipse';
}

export interface SpawnConfig {
  resourceNodes: Record<string, SpawnTypeRule>;
  totals?: { min: number; max: number };
  respawnEveryDays?: number;
  storage?: { count: number };
  minSeparationTiles?: number;
  noSpawnRadiusTilesAroundStart?: number;
}

export class SpawnSystem {
  private readonly bus: EventBus;
  private readonly cfg: ConfigService;
  private spawnCfg!: SpawnConfig;

  constructor(bus: EventBus, cfg: ConfigService) {
    this.bus = bus;
    this.cfg = cfg;
  }

  public setConfig(spawn: SpawnConfig): void {
    this.spawnCfg = spawn;
  }

  public planCounts(phase: TimePhase): Record<string, number> {
    const rules = this.spawnCfg.resourceNodes;
    const allowed: Array<[string, SpawnTypeRule]> = Object.entries(rules).filter(([_, rule]) => {
      const r = rule.phase ?? 'any';
      if (r === 'any') return true;
      if (r === 'night') return phase === 'night' || phase === 'eclipse';
      return r === phase;
    });
    const totals = this.spawnCfg.totals ?? { min: 0, max: Number.MAX_SAFE_INTEGER };
    let totalPlanned = 0;
    const planned: Record<string, number> = {};
    for (const [type, rule] of allowed) {
      const count = Math.floor(rule.min + Math.random() * Math.max(0, rule.max - rule.min + 1));
      planned[type] = count;
      totalPlanned += count;
    }
    if (totalPlanned > totals.max) {
      const ordered = [...allowed].sort((a, b) => (a[1].rarity ?? 1) - (b[1].rarity ?? 1));
      let over = totalPlanned - totals.max;
      for (const [type] of ordered) {
        if (over <= 0) break;
        const reducible = Math.min(over, Math.max(0, planned[type] - (rules[type].min ?? 0)));
        planned[type] -= reducible;
        over -= reducible;
      }
    }
    if (totalPlanned < totals.min) {
      const ordered = [...allowed].sort((a, b) => (b[1].rarity ?? 1) - (a[1].rarity ?? 1));
      let needed = totals.min - totalPlanned;
      let idx = 0;
      while (needed > 0 && ordered.length > 0) {
        const [type, rule] = ordered[idx % ordered.length];
        if (planned[type] < rule.max) {
          planned[type] += 1;
          needed -= 1;
        }
        idx += 1;
      }
    }
    return planned;
  }

  public buildFromCounts(counts: Record<string, number>, worldW: number, worldH: number): ResourceNode[] {
    return this.buildFromCountsWithConstraints(counts, worldW, worldH, {});
  }

  public buildFromCountsWithConstraints(
    counts: Record<string, number>,
    worldW: number,
    worldH: number,
    opts: {
      colliders?: Array<{ x: number; y: number; hw: number; hh: number }>;
      avoid?: { x: number; y: number; radiusPx: number };
      minSeparationPx?: number;
    }
  ): ResourceNode[] {
    const tileSize = this.cfg.getGame().tileSize;
    const resources = this.cfg.getResources();
    const result: ResourceNode[] = [];
    const colliders = [...(opts.colliders ?? [])];
    const minSepPx = opts.minSeparationPx ?? (Number(this.spawnCfg.minSeparationTiles ?? 0) * tileSize);
    const avoid = opts.avoid;
    const marginTiles = 1; // keep one tile margin from world edges
    const tilesX = Math.floor(worldW / tileSize);
    const tilesY = Math.floor(worldH / tileSize);

    const intersects = (ax: number, ay: number, ahw: number, ahh: number, bx: number, by: number, bhw: number, bhh: number) =>
      Math.abs(ax - bx) <= ahw + bhw && Math.abs(ay - by) <= ahh + bhh;

    for (const [type, count] of Object.entries(counts)) {
      for (let i = 0; i < count; i += 1) {
        const r = resources.nodes[type];
        if (!r) continue;
        const cap = Math.floor(r.capacityMin + Math.random() * (r.capacityMax - r.capacityMin + 1));
        const areaTiles = Math.max(1, Math.floor(r.tileAreaTiles ?? 1));
        const span = Math.max(1, Math.floor(Math.sqrt(areaTiles))); // developer must set perfect square
        const n = new ResourceNode(
          `${type}-${i}-${Date.now()}`,
          { id: '', archetype: type, capacity: cap },
          tileSize * 0.45 * span
        );
        const hw = (span * tileSize) / 2;
        const hh = (span * tileSize) / 2;
        let placed = false;
        for (let attempt = 0; attempt < 64 && !placed; attempt += 1) {
          // choose a random tile cell within bounds, then center
          const tx = Math.floor(Math.random() * (tilesX - marginTiles * 2 - span + 1)) + marginTiles;
          const ty = Math.floor(Math.random() * (tilesY - marginTiles * 2 - span + 1)) + marginTiles;
          const x = (tx + span / 2) * tileSize;
          const y = (ty + span / 2) * tileSize;
          // avoid start area
          if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < avoid.radiusPx) continue;
          // check collisions with static colliders and already placed nodes
          let ok = true;
          for (const c of colliders) {
            if (intersects(x, y, hw + minSepPx, hh + minSepPx, c.x, c.y, c.hw, c.hh)) { ok = false; break; }
          }
          if (!ok) continue;
          // all good
          n.x = x; n.y = y;
          placed = true;
        }
        if (placed) {
          result.push(n);
          colliders.push({ x: n.x, y: n.y, hw, hh });
        }
      }
    }
    return result;
  }

  public buildNodes(phase: TimePhase, worldW: number, worldH: number): ResourceNode[] {
    const counts = this.planCounts(phase);
    return this.buildFromCounts(counts, worldW, worldH);
  }

  public planCountsAll(): Record<string, number> {
    const rules = this.spawnCfg.resourceNodes;
    const totals = this.spawnCfg.totals ?? { min: 0, max: Number.MAX_SAFE_INTEGER };
    let totalPlanned = 0;
    const planned: Record<string, number> = {};
    for (const [type, rule] of Object.entries(rules)) {
      const count = Math.floor(rule.min + Math.random() * Math.max(0, rule.max - rule.min + 1));
      planned[type] = count;
      totalPlanned += count;
    }
    if (totalPlanned > totals.max) {
      const ordered = Object.entries(rules).sort((a, b) => (a[1].rarity ?? 1) - (b[1].rarity ?? 1));
      let over = totalPlanned - totals.max;
      for (const [type] of ordered) {
        if (over <= 0) break;
        const reducible = Math.min(over, Math.max(0, planned[type] - (rules[type].min ?? 0)));
        planned[type] -= reducible;
        over -= reducible;
      }
    }
    if (totalPlanned < totals.min) {
      const ordered = Object.entries(rules).sort((a, b) => (b[1].rarity ?? 1) - (a[1].rarity ?? 1));
      let needed = totals.min - totalPlanned;
      let idx = 0;
      while (needed > 0 && ordered.length > 0) {
        const [type, rule] = ordered[idx % ordered.length];
        if (planned[type] < rule.max) {
          planned[type] += 1;
          needed -= 1;
        }
        idx += 1;
      }
    }
    return planned;
  }

  public getStorageCount(): number {
    return Number(this.spawnCfg.storage?.count ?? 1);
  }
}
