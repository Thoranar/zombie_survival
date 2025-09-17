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
