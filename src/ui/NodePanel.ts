import { ResourcesConfig } from '@core/data/ConfigService';
import { ResourceNode, ThrottleKey } from '@core/entities/ResourceNode';
import { Wall } from '@core/entities/world/Wall';

/**
 * Responsibility: Simple UI to show selected node and switch throttles.
 * Publishes: none (callback invoked)
 * Subscribes: none
 * Config: uses resources.throttles to show labels
 */
export class NodePanel {
  private readonly root: HTMLDivElement;
  private node: ResourceNode | null = null;
  private wall: Wall | null = null;
  private readonly onThrottle: (t: ThrottleKey) => void;
  private readonly cfg: ResourcesConfig;

  constructor(host: HTMLElement, cfg: ResourcesConfig, onThrottle: (t: ThrottleKey) => void) {
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.left = '8px';
    root.style.bottom = '8px';
    root.style.padding = '6px 8px';
    root.style.background = 'rgba(0,0,0,0.5)';
    root.style.color = '#fff';
    root.style.font = '12px monospace';
    host.appendChild(root);
    this.root = root;
    this.onThrottle = onThrottle;
    this.cfg = cfg;
    this.render();
  }

  public setNode(node: ResourceNode | null): void {
    this.node = node;
    this.wall = null;
    this.render();
  }

  public setWall(wall: Wall | null, salvage: Record<string, number> | null): void {
    this.wall = wall;
    if (wall) this.node = null;
    this.render(salvage ?? undefined);
  }

  private render(salvage?: Record<string, number>): void {
    const n = this.node;
    this.root.innerHTML = '';
    const title = document.createElement('div');
    if (this.wall) {
      title.textContent = `${this.wall.type} (${this.wall.id})`;
    } else {
      title.textContent = n ? `${n.archetype} (${n.id})` : 'No selection';
    }
    this.root.appendChild(title);
    if (this.wall) {
      const stats = document.createElement('div');
      stats.style.marginTop = '4px';
      const salvTxt = salvage ? Object.entries(salvage).map(([k, v]) => `${k}:${Math.floor(v)}`).join(' ') : 'N/A';
      stats.textContent = `HP: ${Math.floor(this.wall.hp)}  |  Salvage: ${salvTxt}`;
      this.root.appendChild(stats);
      return;
    }
    if (n) {
      const max = this.cfg.nodes[n.archetype]?.capacityMax ?? 0;
      const noise = this.cfg.nodes[n.archetype]?.noiseLevel ?? 0;
      const stats = document.createElement('div');
      stats.style.marginTop = '4px';
      stats.textContent = `Capacity: ${Math.floor(n.capacity)} / ${Math.floor(max)}  |  Noise: ${noise}`;
      this.root.appendChild(stats);
      const btn = (label: string, key: ThrottleKey) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.marginRight = '6px';
        b.onclick = () => this.onThrottle(key);
        this.root.appendChild(b);
      };
      const row = document.createElement('div');
      row.style.marginTop = '6px';
      this.root.appendChild(row);
      btn('Quiet', 'Quiet');
      btn('Normal', 'Normal');
      btn('Loud', 'Loud');
    }
  }
}
