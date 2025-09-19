import { ResourcesConfig } from '@core/data/ConfigService';
import { ResourceNode, ThrottleKey } from '@core/entities/ResourceNode';
import { Structure } from '@core/entities/world/Structure';
import { Trap } from '@core/entities/world/Trap';
import { Wall } from '@core/entities/world/Wall';

/**
 * Responsibility: Simple UI to show selected node or structure details.
 * Publishes: none (callback invoked)
 * Subscribes: none
 * Config: uses resources.throttles to show labels
 */
export class NodePanel {
  private readonly root: HTMLDivElement;
  private node: ResourceNode | null = null;
  private structure: Structure | null = null;
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
    this.structure = null;
    this.render();
  }

  public setStructure(structure: Structure | null, salvage: Record<string, number> | null): void {
    this.structure = structure;
    if (structure) this.node = null;
    this.render(salvage ?? undefined);
  }

  private render(salvage?: Record<string, number>): void {
    const n = this.node;
    const s = this.structure;
    this.root.innerHTML = '';
    const title = document.createElement('div');
    if (s) {
      let label = `${s.kind} (${s.id})`;
      if (s instanceof Wall) label = `${s.type} (${s.id})`;
      title.textContent = label;
    } else {
      title.textContent = n ? `${n.archetype} (${n.id})` : 'No selection';
    }
    this.root.appendChild(title);
    if (s) {
      const stats = document.createElement('div');
      stats.style.marginTop = '4px';
      const salvTxt = salvage ? Object.entries(salvage).map(([k, v]) => `${k}:${Math.floor(v)}`).join(' ') : 'N/A';
      const hpTxt = `${Math.floor(s.hp)} / ${Math.floor(s.maxHp)}`;
      const builtTxt = s.playerBuilt ? 'Yes' : 'No';
      const extraParts: string[] = [];
      if (s instanceof Trap) {
        extraParts.push(`TrapDmg: ${Math.round(s.damageOnTrigger)}`);
        extraParts.push(`Tick: ${s.triggerIntervalSec.toFixed(2)}s`);
      } else if (s instanceof Wall && s.type === 'Door') {
        extraParts.push(`Door: ${s.isOpen ? 'Open' : 'Closed'}`);
      }
      const extra = extraParts.length ? `  |  ${extraParts.join('  |  ')}` : '';
      stats.textContent = `HP: ${hpTxt}  |  Salvage: ${salvTxt}  |  PlayerBuilt: ${builtTxt}${extra}`;
      this.root.appendChild(stats);
      const hint = document.createElement('div');
      hint.style.marginTop = '4px';
      hint.textContent = 'Hold X to deconstruct and recover salvage.';
      this.root.appendChild(hint);
      return;
    }
    if (n) {
      const max = this.cfg.nodes[n.archetype]?.capacityMax ?? 0;
      const noise = this.cfg.nodes[n.archetype]?.noiseLevel ?? 0;
      const stats = document.createElement('div');
      stats.style.marginTop = '4px';
      stats.textContent = `Capacity: ${Math.floor(n.capacity)} / ${Math.floor(max)}  |  Noise: ${noise}`;
      this.root.appendChild(stats);
      const row = document.createElement('div');
      row.style.marginTop = '6px';
      this.root.appendChild(row);
      const btn = (label: string, key: ThrottleKey) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.marginRight = '6px';
        b.onclick = () => this.onThrottle(key);
        row.appendChild(b);
      };
      btn('Quiet', 'Quiet');
      btn('Normal', 'Normal');
      btn('Loud', 'Loud');
    }
  }
}
