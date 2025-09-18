/**
 * Responsibility: Load and cache JSON5 configs; expose typed getters.
 * Publishes: none
 * Subscribes: none
 * Config: reads from `/public/config/game.json5` (Milestone 0 scope)
 * Notes: Minimal JSON5 parsing implemented to avoid external engine deps.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface ExperienceProgressionConfig {
  curve?: { base?: number; growth?: number; exponent?: number };
  maxLevel?: number;
  orb?: { radiusTiles?: number; attractRadiusTiles?: number; pickupRadiusTiles?: number; speedTilesPerSec?: number };
  defaultEnemyXpDrop?: number;
  harvestXpPerUnitDefault?: number;
  cardPlaceholders?: string[];
  debugShowNumbers?: boolean;
}

export interface GameConfig {
  tileSize: number;
  dayNight: { daySec: number; nightSec: number; eclipseSec: number; eclipseEvery: number };
  scaling: unknown;
  player: { hp: number; walkSpeed: number; crouchSpeed: number; sprintSpeed: number; pushCooldownSec: number; carryCap: number };
  storage: { autoDepositRadius: number };
  horde: { noiseThreshold: number; sustainSec: number; cooldownSec: number };
  progression?: ExperienceProgressionConfig;
}

export interface ResourcesConfig {
  nodes: Record<string, {
    yield?: string;
    noiseLevel?: number;
    tileAreaTiles?: number;
    capacityMin: number; capacityMax: number; respawnSecMin: number; respawnSecMax: number; threatWeight: number; nightOnly?: boolean; xpPerUnit?: number
  }>;
  throttles: Record<'Quiet' | 'Normal' | 'Loud', { ratePerSec: number; noisePerSec?: number; clankChancePer5s?: number; clankNoisePulse?: number; clankCapacityPenalty?: number }>;
  weights: Record<string, number>;
}

function stripJson5(input: string): string {
  // Remove // line comments and /* ... */ block comments
  const noComments = input
    .replace(/\/\*[^]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
  // Remove trailing commas before } or ]
  return noComments.replace(/,\s*([}\]])/g, '$1');
}

export class ConfigService {
  private gameConfig?: GameConfig;
  private resourcesConfig?: ResourcesConfig;
  private spawnConfig?: import('../systems/SpawnSystem').SpawnConfig;
  private buildablesConfig?: any;
  private enemiesConfig?: any;

  public loadGameConfig(filePath: string): void {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const cleaned = stripJson5(raw);
    const json = JSON.parse(cleaned);
    this.validateGameConfig(json);
    this.gameConfig = json as GameConfig;
  }

  public async loadGameConfigBrowser(url: string): Promise<void> {
    const res = await fetch(url);
    const raw = await res.text();
    const cleaned = stripJson5(raw);
    const json = JSON.parse(cleaned);
    this.validateGameConfig(json);
    this.gameConfig = json as GameConfig;
  }

  public getGame(): Readonly<GameConfig> {
    if (!this.gameConfig) throw new Error('Game config not loaded');
    return this.gameConfig;
  }

  public loadResourcesConfig(filePath: string): void {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const cleaned = stripJson5(raw);
    const json = JSON.parse(cleaned);
    this.validateResourcesConfig(json);
    this.resourcesConfig = json as ResourcesConfig;
  }

  public async loadResourcesConfigBrowser(url: string): Promise<void> {
    const res = await fetch(url);
    const raw = await res.text();
    const cleaned = stripJson5(raw);
    const json = JSON.parse(cleaned);
    this.validateResourcesConfig(json);
    this.resourcesConfig = json as ResourcesConfig;
  }

  public getResources(): Readonly<ResourcesConfig> {
    if (!this.resourcesConfig) throw new Error('Resources config not loaded');
    return this.resourcesConfig;
  }

  public loadSpawnConfig(filePath: string): void {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const cleaned = stripJson5(raw);
    const json = JSON.parse(cleaned);
    this.spawnConfig = json as any;
  }

  public async loadSpawnConfigBrowser(url: string): Promise<void> {
    const res = await fetch(url);
    const raw = await res.text();
    const cleaned = stripJson5(raw);
    const json = JSON.parse(cleaned);
    this.spawnConfig = json as any;
  }

  public getSpawn(): Readonly<import('../systems/SpawnSystem').SpawnConfig> {
    if (!this.spawnConfig) throw new Error('Spawn config not loaded');
    return this.spawnConfig as any;
  }

  public loadBuildablesConfig(filePath: string): void {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const cleaned = stripJson5(raw);
    const json = JSON.parse(cleaned);
    this.buildablesConfig = json as any;
  }

  public async loadBuildablesConfigBrowser(url: string): Promise<void> {
    const res = await fetch(url);
    const raw = await res.text();
    const cleaned = stripJson5(raw);
    const json = JSON.parse(cleaned);
    this.buildablesConfig = json as any;
  }

  public getBuildables(): Readonly<any> {
    if (!this.buildablesConfig) throw new Error('Buildables config not loaded');
    return this.buildablesConfig as any;
  }

  public loadEnemiesConfig(filePath: string): void {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const cleaned = stripJson5(raw);
    const json = JSON.parse(cleaned);
    this.enemiesConfig = json as any;
  }

  public async loadEnemiesConfigBrowser(url: string): Promise<void> {
    const res = await fetch(url);
    const raw = await res.text();
    const cleaned = stripJson5(raw);
    const json = JSON.parse(cleaned);
    this.enemiesConfig = json as any;
  }

  public getEnemies(): Readonly<any> {
    if (!this.enemiesConfig) throw new Error('Enemies config not loaded');
    return this.enemiesConfig as any;
  }

  private validateGameConfig(json: any): void {
    if (typeof json?.tileSize !== 'number') throw new Error('game.tileSize missing');
    if (typeof json?.dayNight?.daySec !== 'number') throw new Error('game.dayNight.daySec missing');
    if (typeof json?.player?.walkSpeed !== 'number') throw new Error('game.player.walkSpeed missing');
  }

  private validateResourcesConfig(json: any): void {
    if (typeof json?.nodes !== 'object') throw new Error('resources.nodes missing');
    if (typeof json?.throttles?.Quiet?.ratePerSec !== 'number') throw new Error('resources.throttles.Quiet.ratePerSec missing');
  }
}

export function resolvePublicConfigPath(rel: string): string {
  return path.join(process.cwd(), 'public', 'config', rel);
}
