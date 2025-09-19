export type StructureState = 'underConstruction' | 'completed';

export interface StructureInitParams {
  id: string;
  kind: string;
  tileSize: number;
  footprintTiles: number;
  maxHp: number;
  cost: Record<string, number>;
  buildTimeSec: number;
  noisePerSec: number;
  playerBuilt?: boolean;
  initialHp?: number;
  state?: StructureState;
}

/**
 * Responsibility: Shared placement and construction logic for buildable structures.
 */
export abstract class Structure {
  public x = 0;
  public y = 0;
  public gridX = 0;
  public gridY = 0;
  public readonly id: string;
  public readonly kind: string;
  public readonly tileSize: number;
  public readonly footprintTiles: number;
  public readonly widthPx: number;
  public readonly heightPx: number;
  public readonly cost: Readonly<Record<string, number>>;
  public readonly buildTimeSec: number;
  public readonly noisePerSec: number;
  public playerBuilt: boolean;
  public state: StructureState;
  public buildProgressSec = 0;
  public readonly maxHp: number;
  public hp: number;

  protected constructor(params: StructureInitParams) {
    this.id = params.id;
    this.kind = params.kind;
    this.tileSize = params.tileSize;
    this.footprintTiles = Math.max(1, Math.floor(params.footprintTiles));
    this.widthPx = this.tileSize * this.footprintTiles;
    this.heightPx = this.widthPx;
    this.cost = { ...params.cost };
    this.buildTimeSec = Math.max(0.1, params.buildTimeSec);
    this.noisePerSec = Math.max(0, params.noisePerSec);
    this.playerBuilt = Boolean(params.playerBuilt);
    this.maxHp = Math.max(1, Math.floor(params.maxHp));
    const initialHp = params.initialHp ?? 0;
    const clampedHp = Math.max(0, Math.min(this.maxHp, Math.floor(initialHp)));
    const initialState = params.state ?? (clampedHp >= this.maxHp ? 'completed' : 'underConstruction');
    this.state = initialState;
    if (initialState === 'completed') {
      this.buildProgressSec = this.buildTimeSec;
      this.hp = this.maxHp;
    } else {
      this.buildProgressSec = Math.min(this.buildTimeSec, (clampedHp / this.maxHp) * this.buildTimeSec);
      const ratio = this.buildTimeSec > 0 ? this.buildProgressSec / this.buildTimeSec : 0;
      this.hp = Math.max(clampedHp, Math.floor(this.maxHp * ratio));
    }
  }

  public setGridPosition(tileX: number, tileY: number): void {
    this.gridX = tileX;
    this.gridY = tileY;
    const offset = this.footprintTiles / 2;
    this.x = (tileX + offset) * this.tileSize;
    this.y = (tileY + offset) * this.tileSize;
  }

  public setWorldPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    const halfFootprint = this.footprintTiles / 2;
    this.gridX = Math.round(x / this.tileSize - halfFootprint);
    this.gridY = Math.round(y / this.tileSize - halfFootprint);
  }

  public getHalfWidth(): number { return this.widthPx / 2; }
  public getHalfHeight(): number { return this.heightPx / 2; }

  public getBounds(): { x: number; y: number; hw: number; hh: number } {
    return { x: this.x, y: this.y, hw: this.getHalfWidth(), hh: this.getHalfHeight() };
  }

  public containsPoint(px: number, py: number): boolean {
    const hw = this.getHalfWidth();
    const hh = this.getHalfHeight();
    return px >= this.x - hw && px <= this.x + hw && py >= this.y - hh && py <= this.y + hh;
  }

  public isCompleted(): boolean {
    return this.state === 'completed';
  }

  public getConstructionRatio(): number {
    if (this.buildTimeSec <= 0) return 1;
    return Math.max(0, Math.min(1, this.buildProgressSec / this.buildTimeSec));
  }

  public beginConstruction(): void {
    if (this.state !== 'completed') this.state = 'underConstruction';
  }

  public advanceConstruction(dtSec: number): boolean {
    if (this.state === 'completed') return true;
    const delta = Math.max(0, dtSec);
    this.buildProgressSec = Math.min(this.buildTimeSec, this.buildProgressSec + delta);
    const ratio = this.getConstructionRatio();
    this.hp = Math.max(this.hp, Math.floor(this.maxHp * ratio));
    if (this.buildProgressSec >= this.buildTimeSec) {
      this.state = 'completed';
      this.hp = this.maxHp;
      return true;
    }
    return false;
  }

  public applyDamage(amount: number): number {
    if (amount <= 0 || this.hp <= 0) return 0;
    const dmg = Math.min(this.hp, Math.max(0, amount));
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'underConstruction';
      this.buildProgressSec = Math.min(this.buildProgressSec, this.buildTimeSec * 0.5);
    }
    return dmg;
  }

  public heal(amount: number): number {
    if (amount <= 0 || this.hp >= this.maxHp) return 0;
    const healed = Math.min(this.maxHp - this.hp, Math.max(0, amount));
    this.hp += healed;
    if (this.hp >= this.maxHp) this.state = 'completed';
    return healed;
  }
}
