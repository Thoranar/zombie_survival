import { EventBus } from '@app/EventBus';
import { ConfigService, ExperienceProgressionConfig } from '../data/ConfigService';

export interface ExperienceState {
  level: number;
  currentXp: number;
  requiredXp: number;
  totalXp: number;
  pendingLevelUps: number;
}

export interface LevelUpCardData {
  id: string;
  title: string;
  description: string;
}

export interface PlayerExperienceChangedEvent extends ExperienceState {}

export interface PlayerLevelUpEvent {
  level: number;
  cards: LevelUpCardData[];
}

interface ExperienceOrb {
  id: string;
  x: number;
  y: number;
  amount: number;
  state: 'idle' | 'attract';
}

interface CurveConfig {
  base: number;
  growth: number;
  exponent: number;
}

interface OrbConfigPx {
  radiusPx: number;
  attractRadiusPx: number;
  pickupRadiusPx: number;
  speedPxPerSec: number;
}

export class ExperienceSystem {
  private readonly bus: EventBus;
  private readonly cfg: ConfigService;
  private readonly curve: CurveConfig;
  private readonly maxLevel: number;
  private readonly orbCfg: OrbConfigPx;
  private readonly defaultEnemyXp: number;
  private readonly defaultHarvestXpPerUnit: number;
  private readonly cardPool: string[];
  private readonly orbs: ExperienceOrb[] = [];
  private readonly enemyXp: Record<string, number> = {};
  private readonly harvestXpPerUnit: Record<string, number> = {};

  private currentLevel = 1;
  private currentXp = 0;
  private totalXp = 0;
  private xpForNext: number;
  private pendingLevelUps = 0;

  constructor(bus: EventBus, cfg: ConfigService) {
    this.bus = bus;
    this.cfg = cfg;
    const game = cfg.getGame();
    const progression = ((game as unknown as { progression?: ExperienceProgressionConfig }).progression) ?? {};
    const curveCfg = progression.curve ?? {};
    const base = Number.isFinite(curveCfg.base) && Number(curveCfg.base) > 0 ? Number(curveCfg.base) : 20;
    const growth = Number.isFinite(curveCfg.growth) && Number(curveCfg.growth) > 0 ? Number(curveCfg.growth) : 1.2;
    const exponent = Number.isFinite(curveCfg.exponent) && Number(curveCfg.exponent) > 0 ? Number(curveCfg.exponent) : 1.35;
    this.curve = { base, growth, exponent };
    const maxLevel = Number(progression.maxLevel ?? 100);
    this.maxLevel = Number.isFinite(maxLevel) && maxLevel > 0 ? Math.floor(maxLevel) : 100;
    const tile = game.tileSize ?? 32;
    const orbCfg = progression.orb ?? {};
    const radiusTiles = Number.isFinite(orbCfg.radiusTiles) ? Number(orbCfg.radiusTiles) : 0.3;
    const attractTiles = Number.isFinite(orbCfg.attractRadiusTiles) ? Number(orbCfg.attractRadiusTiles) : 3.0;
    const pickupTiles = Number.isFinite(orbCfg.pickupRadiusTiles) ? Number(orbCfg.pickupRadiusTiles) : 0.6;
    const speedTiles = Number.isFinite(orbCfg.speedTilesPerSec) ? Number(orbCfg.speedTilesPerSec) : 9.0;
    this.orbCfg = {
      radiusPx: radiusTiles * tile,
      attractRadiusPx: attractTiles * tile,
      pickupRadiusPx: pickupTiles * tile,
      speedPxPerSec: speedTiles * tile
    };
    this.defaultEnemyXp = Number.isFinite(progression.defaultEnemyXpDrop)
      ? Number(progression.defaultEnemyXpDrop)
      : 0;
    this.defaultHarvestXpPerUnit = Number.isFinite(progression.harvestXpPerUnitDefault)
      ? Number(progression.harvestXpPerUnitDefault)
      : 0;
    this.cardPool = Array.isArray(progression.cardPlaceholders) && progression.cardPlaceholders.length > 0
      ? progression.cardPlaceholders.map((v) => String(v))
      : ['Power Surge', 'Vitality Boost', 'Harvest Fortune', 'Blade Dance', 'Arcane Flow'];
    const enemiesCfg = cfg.getEnemies();
    for (const [kind, data] of Object.entries(enemiesCfg)) {
      if (kind === 'globals') continue;
      const xpDrop = Number((data as any).xpDrop ?? (data as any).experience ?? 0);
      if (Number.isFinite(xpDrop) && xpDrop > 0) this.enemyXp[kind] = xpDrop;
    }
    const resourcesCfg = cfg.getResources();
    for (const [node, data] of Object.entries(resourcesCfg.nodes)) {
      const perUnit = Number((data as any).xpPerUnit ?? 0);
      if (Number.isFinite(perUnit) && perUnit > 0) this.harvestXpPerUnit[node] = perUnit;
    }
    this.xpForNext = this.computeRequirementForLevel(this.currentLevel);
    this.emitExperienceChanged();
  }

  public update(dtSec: number, player: { x: number; y: number }): void {
    if (!Number.isFinite(dtSec) || dtSec <= 0) return;
    const attract = this.orbCfg.attractRadiusPx;
    const pickup = this.orbCfg.pickupRadiusPx;
    const speed = this.orbCfg.speedPxPerSec;
    for (let i = this.orbs.length - 1; i >= 0; i -= 1) {
      const orb = this.orbs[i];
      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= pickup) {
        this.collectOrb(i);
        continue;
      }
      if (dist <= attract) orb.state = 'attract';
      if (orb.state === 'attract' && dist > 0) {
        const step = speed * dtSec;
        const ux = dx / dist;
        const uy = dy / dist;
        orb.x += ux * step;
        orb.y += uy * step;
      }
    }
  }

  public getOrbs(): readonly ExperienceOrb[] {
    return this.orbs;
  }

  public getOrbRadiusPx(): number {
    return this.orbCfg.radiusPx;
  }

  public getState(): ExperienceState {
    return {
      level: this.currentLevel,
      currentXp: this.currentXp,
      requiredXp: this.xpForNext,
      totalXp: this.totalXp,
      pendingLevelUps: this.pendingLevelUps
    };
  }

  public spawnOrbForZombie(kind: string, x: number, y: number): void {
    const amount = this.enemyXp[kind] ?? this.defaultEnemyXp;
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.spawnOrb(x, y, amount);
  }

  public spawnOrb(x: number, y: number, amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.orbs.push({
      id: `orb-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      x,
      y,
      amount,
      state: 'idle'
    });
  }

  public grantHarvestExperience(nodeArchetype: string, harvestedAmount: number): number {
    const perUnit = this.harvestXpPerUnit[nodeArchetype] ?? this.defaultHarvestXpPerUnit;
    if (!Number.isFinite(perUnit) || perUnit <= 0) return 0;
    const amount = harvestedAmount * perUnit;
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    this.addExperience(amount);
    return amount;
  }

  public addExperience(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (this.currentLevel >= this.maxLevel) {
      this.totalXp += amount;
      this.emitExperienceChanged();
      return;
    }
    this.currentXp += amount;
    this.totalXp += amount;
    let leveled = false;
    while (this.currentLevel < this.maxLevel && this.currentXp >= this.xpForNext) {
      this.currentXp -= this.xpForNext;
      this.currentLevel += 1;
      this.pendingLevelUps += 1;
      leveled = true;
      this.xpForNext = this.computeRequirementForLevel(this.currentLevel);
      this.bus.emit<PlayerLevelUpEvent>('PlayerLevelUp', {
        level: this.currentLevel,
        cards: this.generateCardChoices(this.currentLevel)
      });
      if (!Number.isFinite(this.xpForNext) || this.xpForNext <= 0) break;
    }
    if (this.currentLevel >= this.maxLevel) {
      this.currentXp = 0;
      this.xpForNext = Number.POSITIVE_INFINITY;
    }
    if (leveled || amount !== 0) this.emitExperienceChanged();
  }

  public applyLevelUpSelection(_cardId: string): void {
    if (this.pendingLevelUps > 0) this.pendingLevelUps -= 1;
    this.emitExperienceChanged();
  }

  private collectOrb(index: number): void {
    const [orb] = this.orbs.splice(index, 1);
    if (orb) this.addExperience(orb.amount);
  }

  private computeRequirementForLevel(level: number): number {
    if (level >= this.maxLevel) return Number.POSITIVE_INFINITY;
    const scaled = this.curve.base * Math.pow(level, this.curve.exponent) * Math.pow(this.curve.growth, Math.max(0, level - 1));
    return Math.max(1, Math.floor(scaled));
  }

  private generateCardChoices(level: number): LevelUpCardData[] {
    const pool = [...this.cardPool];
    const cards: LevelUpCardData[] = [];
    for (let i = 0; i < 3; i += 1) {
      if (pool.length === 0) break;
      const idx = Math.floor(Math.random() * pool.length);
      const title = pool.splice(idx, 1)[0];
      cards.push({
        id: `level-${level}-choice-${i}`,
        title,
        description: 'Upgrade effects coming soon.'
      });
    }
    while (cards.length < 3) {
      const fallback = `Future Upgrade ${cards.length + 1}`;
      cards.push({ id: `level-${level}-choice-${cards.length}`, title: fallback, description: 'Placeholder upgrade option.' });
    }
    return cards;
  }

  private emitExperienceChanged(): void {
    this.bus.emit<PlayerExperienceChangedEvent>('PlayerExperienceChanged', this.getState());
  }
}
