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
  private movementTiles = 0;
  private harvestNoisePerSec = 0;
  private harvestActive = false;
  private harvestAccumSec = 0;
  private buildNoisePerSec = 0;
  private buildActive = false;
  private buildAccumSec = 0;
  private deconstructNoisePerSec = 0;
  private deconstructActive = false;
  private deconstructAccumSec = 0;

  constructor(cfg: NoiseConfig) {
    this.cfg = cfg;
  }

  public setByMovement(mode: MoveMode): void {
    const base =
      mode === 'crouch' ? this.cfg.crouchTiles : mode === 'sprint' ? this.cfg.sprintTiles : mode === 'walk' ? this.cfg.walkTiles : 0;
    this.movementTiles = Math.max(0, base);
    this.updateTarget();
  }

  public setHarvestNoisePerSec(noisePerSec: number): void {
    this.harvestNoisePerSec = Math.max(0, noisePerSec || 0);
    this.updateTarget();
  }

  public setHarvestActive(active: boolean): void {
    this.harvestActive = active;
    if (!active) this.harvestAccumSec = 0;
    this.updateTarget();
  }

  public setBuildNoisePerSec(noisePerSec: number): void {
    this.buildNoisePerSec = Math.max(0, noisePerSec || 0);
    this.updateTarget();
  }

  public setBuildActive(active: boolean): void {
    this.buildActive = active;
    if (!active) this.buildAccumSec = 0;
    this.updateTarget();
  }

  public setDeconstructNoisePerSec(noisePerSec: number): void {
    this.deconstructNoisePerSec = Math.max(0, noisePerSec || 0);
    this.updateTarget();
  }

  public setDeconstructActive(active: boolean): void {
    this.deconstructActive = active;
    if (!active) this.deconstructAccumSec = 0;
    this.updateTarget();
  }

  private getActionContributionTiles(): number {
    const harvest = this.harvestNoisePerSec * this.cfg.harvestTilesPerNoise * (1 + this.cfg.harvestScalePerSec * this.harvestAccumSec);
    const build = this.buildNoisePerSec * this.cfg.harvestTilesPerNoise * (1 + this.cfg.harvestScalePerSec * this.buildAccumSec);
    const deconstruct = this.deconstructNoisePerSec * this.cfg.harvestTilesPerNoise * (1 + this.cfg.harvestScalePerSec * this.deconstructAccumSec);
    return harvest + build + deconstruct;
  }

  private updateTarget(): void {
    this.targetTiles = Math.max(0, this.movementTiles + this.getActionContributionTiles());
  }

  public tick(dtSec: number, _moving: boolean): void {
    if (this.harvestActive && this.harvestNoisePerSec > 0) this.harvestAccumSec += dtSec;
    else this.harvestAccumSec = 0;
    if (this.buildActive && this.buildNoisePerSec > 0) this.buildAccumSec += dtSec;
    else this.buildAccumSec = 0;
    if (this.deconstructActive && this.deconstructNoisePerSec > 0) this.deconstructAccumSec += dtSec;
    else this.deconstructAccumSec = 0;
    this.updateTarget();
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
