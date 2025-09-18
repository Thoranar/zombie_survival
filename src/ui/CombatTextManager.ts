import type { IEngineAdapter } from '@app/EngineAdapter';

interface CombatTextInstance {
  id: number;
  text: string;
  rgb: [number, number, number];
  age: number;
  lifetime: number;
  risePx: number;
  baseOffsetPx: number;
  offsetXPx: number;
  getPosition: () => { x: number; y: number };
}

export interface CombatTextSpawnOptions {
  text: string;
  color?: string;
  lifetimeSec?: number;
  risePx?: number;
  baseYOffsetPx?: number;
  spreadXPx?: number;
  offsetXPx?: number;
  getPosition?: () => { x: number; y: number };
  position?: { x: number; y: number };
}

/**
 * Responsibility: Maintain and render scrolling combat text instances with pooling limits.
 */
export class CombatTextManager {
  private readonly instances: CombatTextInstance[] = [];
  private idSeq = 0;
  private readonly maxInstances: number;

  constructor(maxInstances = 64) {
    this.maxInstances = Math.max(1, Math.floor(maxInstances));
  }

  public spawn(options: CombatTextSpawnOptions): void {
    const positionGetter = this.resolvePositionGetter(options);
    const color = this.parseColor(options.color);
    const lifetime = options.lifetimeSec ?? 1.8;
    if (!(lifetime > 0)) return;
    const risePx = options.risePx ?? 48;
    const baseOffsetPx = options.baseYOffsetPx ?? 32;
    const spreadXPx = options.spreadXPx ?? 16;
    const offsetXPx = typeof options.offsetXPx === 'number'
      ? options.offsetXPx
      : (Math.random() * 2 - 1) * spreadXPx;
    const instance: CombatTextInstance = {
      id: ++this.idSeq,
      text: options.text,
      rgb: color,
      age: 0,
      lifetime,
      risePx,
      baseOffsetPx,
      offsetXPx,
      getPosition: positionGetter
    };
    if (this.instances.length >= this.maxInstances) {
      this.instances.shift();
    }
    this.instances.push(instance);
  }

  public update(dtSec: number): void {
    if (!this.instances.length) return;
    const dt = Math.max(0, dtSec);
    this.pruneExpired(dt);
  }

  public render(renderer: Pick<IEngineAdapter, 'drawTextWorld'>): void {
    if (!this.instances.length) return;
    for (const inst of this.instances) {
      const progress = Math.min(1, inst.age / inst.lifetime);
      const alpha = Math.max(0, 1 - progress);
      if (alpha <= 0) continue;
      const pos = inst.getPosition();
      const rise = inst.risePx * progress;
      const y = pos.y - inst.baseOffsetPx - rise;
      const x = pos.x + inst.offsetXPx;
      const color = `rgba(${inst.rgb[0]}, ${inst.rgb[1]}, ${inst.rgb[2]}, ${alpha.toFixed(2)})`;
      renderer.drawTextWorld(x, y, inst.text, color);
    }
  }

  public clear(): void {
    this.instances.length = 0;
  }

  private pruneExpired(dtSec: number): void {
    let write = 0;
    for (let i = 0; i < this.instances.length; i += 1) {
      const inst = this.instances[i];
      inst.age += dtSec;
      if (inst.age < inst.lifetime) {
        this.instances[write] = inst;
        write += 1;
      }
    }
    if (write < this.instances.length) {
      this.instances.length = write;
    }
  }

  private resolvePositionGetter(options: CombatTextSpawnOptions): () => { x: number; y: number } {
    if (typeof options.getPosition === 'function') return options.getPosition;
    if (options.position) {
      const { x, y } = options.position;
      return () => ({ x, y });
    }
    return () => ({ x: 0, y: 0 });
  }

  private parseColor(color: string | undefined): [number, number, number] {
    if (!color) return [255, 96, 96];
    const trimmed = color.trim();
    if (trimmed.startsWith('#')) {
      return this.parseHex(trimmed);
    }
    const rgbMatch = trimmed.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (rgbMatch) {
      return [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map((v) => this.clamp255(Number(v))) as [number, number, number];
    }
    return [255, 96, 96];
  }

  private parseHex(hex: string): [number, number, number] {
    const normalized = hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
    const match = normalized.match(/^#([0-9a-fA-F]{6})$/);
    if (!match) return [255, 96, 96];
    const intVal = parseInt(match[1], 16);
    const r = (intVal >> 16) & 0xff;
    const g = (intVal >> 8) & 0xff;
    const b = intVal & 0xff;
    return [r, g, b];
  }

  private clamp255(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value >= 255) return 255;
    return Math.floor(value);
  }
}
