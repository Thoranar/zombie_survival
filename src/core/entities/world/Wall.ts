/**
 * Responsibility: Simple wall/door structure with health and cost info.
 * Publishes: none
 * Subscribes: none
 * Config: buildables.fort.Wall / Door
 */
export class Wall {
  public x = 0;
  public y = 0;
  public widthPx: number;
  public heightPx: number;
  public readonly id: string;
  public readonly type: 'Wall' | 'Door';
  public hp: number;
  public readonly maxHp: number;
  public readonly cost: Record<string, number>
  public playerBuilt = false;
  public isOpen = false;

  constructor(id: string, type: 'Wall' | 'Door', sizePx: number, hp: number, cost: Record<string, number>) {
    this.id = id;
    this.type = type;
    this.widthPx = sizePx;
    this.heightPx = sizePx;
    this.hp = hp;
    this.maxHp = hp;
    this.cost = cost;
    this.playerBuilt = false;
  }

  public containsPoint(px: number, py: number): boolean {
    return px >= this.x - this.widthPx / 2 && px <= this.x + this.widthPx / 2 && py >= this.y - this.heightPx / 2 && py <= this.y + this.heightPx / 2;
  }

  public toggleOpen(): void {
    if (this.type === 'Door') this.isOpen = !this.isOpen;
  }
}
