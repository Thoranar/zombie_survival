import { Structure, StructureInitParams, StructureState } from './Structure';

export interface WallInitParams {
  id: string;
  tileSize: number;
  hp: number;
  cost: Record<string, number>;
  buildTimeSec: number;
  noisePerSec: number;
  footprintTiles?: number;
  type?: 'Wall' | 'Door';
  initialHp?: number;
  state?: StructureState;
  playerBuilt?: boolean;
}

/**
 * Responsibility: Fortification structure (wall/door) with health, cost, and construction state.
 */
export class Wall extends Structure {
  public readonly type: 'Wall' | 'Door';
  public isOpen = false;

  constructor(params: WallInitParams) {
    const init: StructureInitParams = {
      id: params.id,
      kind: (params.type ?? 'Wall'),
      tileSize: params.tileSize,
      footprintTiles: params.footprintTiles ?? 1,
      maxHp: params.hp,
      cost: params.cost,
      buildTimeSec: params.buildTimeSec,
      noisePerSec: params.noisePerSec,
      initialHp: params.initialHp,
      state: params.state,
      playerBuilt: params.playerBuilt
    };
    super(init);
    this.type = params.type ?? 'Wall';
  }

  public toggleOpen(): void {
    if (this.type !== 'Door') return;
    if (!this.isCompleted()) return;
    this.isOpen = !this.isOpen;
  }
}
