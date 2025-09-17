export class SpatialGrid {
  private cellSize: number;
  private buckets: Map<string, number[]> = new Map();

  constructor(cellSize: number) {
    this.cellSize = Math.max(1, Math.floor(cellSize));
  }

  public clear(): void { this.buckets.clear(); }

  private key(ix: number, iy: number): string { return `${ix},${iy}`; }

  private cellIndex(x: number): number { return Math.floor(x / this.cellSize); }

  public insert(id: number, x: number, y: number): void {
    const ix = this.cellIndex(x);
    const iy = this.cellIndex(y);
    const k = this.key(ix, iy);
    let arr = this.buckets.get(k);
    if (!arr) { arr = []; this.buckets.set(k, arr); }
    arr.push(id);
  }

  public rebuild(xs: number[], ys: number[]): void {
    this.clear();
    for (let i = 0; i < xs.length; i++) this.insert(i, xs[i], ys[i]);
  }

  public queryNeighborhood(x: number, y: number): number[] {
    const ix = this.cellIndex(x);
    const iy = this.cellIndex(y);
    const out: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const arr = this.buckets.get(this.key(ix + dx, iy + dy));
        if (arr) out.push(...arr);
      }
    }
    return out;
  }
}

