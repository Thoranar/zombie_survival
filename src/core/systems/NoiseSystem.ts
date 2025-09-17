/**
 * Responsibility: Compute and track player noise radius based on movement/actions.
 * Publishes: none (future: NoisePulse events)
 * Subscribes: none
 * Config: game.noise.movement.*, game.noise.decayTilesPerSec, game.tileSize
 */
export type MoveMode = 'walk' | 'crouch' | 'sprint' | 'idle';

export interface NoiseConfig {
  walkTiles: number;
  crouchTiles: number;
  sprintTiles: number;
  rampTilesPerSec: number;
  decayTilesPerSec: number;
  harvestTilesPerNoise: number;
  harvestScalePerSec: number;
  tileSize: number;
}

export class NoiseSystem {
  private readonly cfg: NoiseConfig;
  private radiusTiles = 0;
  private targetTiles = 0;
  private harvestNoisePerSec = 0;
  private harvestActive = false;
  private harvestAccumSec = 0;

  constructor(cfg: NoiseConfig) {
    this.cfg = cfg;
  }

  public setByMovement(mode: MoveMode): void {
    const base =
      mode === 'crouch' ? this.cfg.crouchTiles : mode === 'sprint' ? this.cfg.sprintTiles : mode === 'walk' ? this.cfg.walkTiles : 0;
    this.targetTiles = Math.max(0, base + this.getHarvestContributionTiles());
  }

  public setHarvestNoisePerSec(noisePerSec: number): void {
    this.harvestNoisePerSec = Math.max(0, noisePerSec || 0);
    // update target in case movement target already set
    this.targetTiles = Math.max(0, this.targetTiles - this.getHarvestContributionTiles() + this.getHarvestContributionTiles());
  }

  public setHarvestActive(active: boolean): void {
    this.harvestActive = active;
  }

  private getHarvestContributionTiles(): number {
    const scale = 1 + this.cfg.harvestScalePerSec * this.harvestAccumSec;
    return this.harvestNoisePerSec * this.cfg.harvestTilesPerNoise * scale;
  }

  public tick(dtSec: number, _moving: boolean): void {
    // Update continuous harvest accumulation
    if (this.harvestActive && this.harvestNoisePerSec > 0) this.harvestAccumSec += dtSec;
    else this.harvestAccumSec = 0;
    // Approach target with ramp up; if current above target, decay down
    if (this.radiusTiles < this.targetTiles) {
      const inc = this.cfg.rampTilesPerSec * dtSec;
      this.radiusTiles = Math.min(this.targetTiles, this.radiusTiles + inc);
    } else {
      const dec = this.cfg.decayTilesPerSec * dtSec;
      this.radiusTiles = Math.max(this.targetTiles, this.radiusTiles - dec);
    }
  }

  public getRadiusPx(): number {
    return this.radiusTiles * this.cfg.tileSize;
  }

  public getRadiusTiles(): number {
    return this.radiusTiles;
  }

  public addPulseTiles(tiles: number): void {
    const v = Math.max(0, tiles || 0);
    this.radiusTiles = Math.max(this.radiusTiles, v, this.targetTiles);
  }
}
