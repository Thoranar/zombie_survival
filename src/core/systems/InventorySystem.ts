/**
 * Responsibility: Track resource totals and carry weight against capacity.
 * Publishes: none
 * Subscribes: none
 * Config: resources.weights.*, game.player.carryCap
 */
export class InventorySystem {
  private readonly weights: Record<string, number>;
  private readonly carryCap: number;
  private totals: Record<string, number> = {};

  constructor(weights: Record<string, number>, carryCap: number) {
    this.weights = { ...weights };
    this.carryCap = carryCap;
    for (const k of Object.keys(weights)) this.totals[k] = 0;
  }

  public add(type: string, amount: number): void {
    if (!(type in this.totals)) this.totals[type] = 0;
    this.totals[type] += amount;
  }

  public getTotals(): Readonly<Record<string, number>> {
    return this.totals;
  }

  public canAfford(cost: Record<string, number>): boolean {
    for (const [resource, amount] of Object.entries(cost)) {
      const need = Math.max(0, amount);
      if (need === 0) continue;
      if ((this.totals[resource] ?? 0) < need) return false;
    }
    return true;
  }

  public spend(cost: Record<string, number>): boolean {
    if (!this.canAfford(cost)) return false;
    for (const [resource, amount] of Object.entries(cost)) {
      const need = Math.max(0, amount);
      if (need === 0) continue;
      if (!(resource in this.totals)) this.totals[resource] = 0;
      this.totals[resource] = Math.max(0, this.totals[resource] - need);
    }
    return true;
  }

  public takeAll(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.totals)) out[k] = v;
    for (const k of Object.keys(this.totals)) this.totals[k] = 0;
    return out;
  }

  public getCarryWeight(): number {
    let sum = 0;
    for (const [k, v] of Object.entries(this.totals)) {
      const w = this.weights[k] ?? 1;
      sum += v * w;
    }
    return sum;
  }

  public isOverCapacity(): boolean {
    return this.getCarryWeight() > this.carryCap;
  }
}
