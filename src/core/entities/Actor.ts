import { Entity } from './Entity';

/**
 * Responsibility: Movable entity with speed selection (walk/crouch/sprint).
 * Publishes: none
 * Subscribes: none
 * Config: game.player.* speeds are interpreted in tiles/sec
 */
export class Actor extends Entity {
  protected speedWalkTiles = 0;
  protected speedCrouchTiles = 0;
  protected speedSprintTiles = 0;
  protected readonly tileSize: number;
  protected speedFactor = 1;

  constructor(id: string, tileSize: number) {
    super(id);
    this.tileSize = tileSize;
  }

  public setSpeedsTiles(walk: number, crouch: number, sprint: number): void {
    this.speedWalkTiles = walk;
    this.speedCrouchTiles = crouch;
    this.speedSprintTiles = sprint;
  }

  public getSpeedPxPerSec(mode: 'walk' | 'crouch' | 'sprint'): number {
    const tps =
      mode === 'crouch' ? this.speedCrouchTiles : mode === 'sprint' ? this.speedSprintTiles : this.speedWalkTiles;
    return tps * this.tileSize * this.speedFactor;
  }

  public setSpeedFactor(f: number): void {
    this.speedFactor = f;
  }
}
