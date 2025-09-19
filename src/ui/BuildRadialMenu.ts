export interface BuildRadialOption {
  id: string;
  label: string;
  cost: Record<string, number>;
  buildTimeSec: number;
  noisePerSec: number;
  affordable: boolean;
}

/**
 * Responsibility: Display radial build menu while player holds build key.
 */
export class BuildRadialMenu {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly items: HTMLDivElement;
  private options: BuildRadialOption[] = [];
  private visible = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.position = 'absolute';
    this.root.style.left = '50%';
    this.root.style.top = '50%';
    this.root.style.transform = 'translate(-50%, -50%)';
    this.root.style.pointerEvents = 'none';
    this.root.style.display = 'none';
    this.root.style.zIndex = '1400';
    this.root.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';

    const backdrop = document.createElement('div');
    backdrop.style.position = 'absolute';
    backdrop.style.left = '50%';
    backdrop.style.top = '50%';
    backdrop.style.transform = 'translate(-50%, -50%)';
    backdrop.style.width = '220px';
    backdrop.style.height = '220px';
    backdrop.style.borderRadius = '50%';
    backdrop.style.background = 'rgba(18, 24, 34, 0.78)';
    backdrop.style.boxShadow = '0 0 24px rgba(0, 0, 0, 0.4)';
    this.root.appendChild(backdrop);

    this.title = document.createElement('div');
    this.title.style.position = 'absolute';
    this.title.style.left = '50%';
    this.title.style.top = '50%';
    this.title.style.transform = 'translate(-50%, -50%)';
    this.title.style.color = '#f5f5f5';
    this.title.style.fontSize = '15px';
    this.title.style.textAlign = 'center';
    this.title.style.whiteSpace = 'pre';
    this.root.appendChild(this.title);

    this.items = document.createElement('div');
    this.items.style.position = 'relative';
    this.items.style.width = '220px';
    this.items.style.height = '220px';
    this.root.appendChild(this.items);

    parent.appendChild(this.root);
  }

  public show(options: BuildRadialOption[], selectedId: string): void {
    this.visible = true;
    this.root.style.display = 'block';
    this.options = options;
    this.render(selectedId);
  }

  public hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.root.style.display = 'none';
    this.items.innerHTML = '';
  }

  public update(options: BuildRadialOption[], selectedId: string): void {
    if (!this.visible) return;
    this.options = options;
    this.render(selectedId);
  }

  private render(selectedId: string): void {
    this.items.innerHTML = '';
    if (this.options.length === 0) {
      this.title.textContent = 'No structures\nunlocked yet';
      return;
    }
    this.title.textContent = 'Hold B to build\nA/D to cycle';
    const radius = 90;
    const step = (Math.PI * 2) / this.options.length;
    this.options.forEach((opt, idx) => {
      const angle = -Math.PI / 2 + idx * step;
      const offsetX = Math.cos(angle) * radius;
      const offsetY = Math.sin(angle) * radius;
      const item = document.createElement('div');
      item.style.position = 'absolute';
      item.style.left = '50%';
      item.style.top = '50%';
      item.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`;
      item.style.padding = '10px 14px';
      item.style.minWidth = '110px';
      item.style.borderRadius = '12px';
      item.style.textAlign = 'center';
      item.style.pointerEvents = 'none';
      const active = opt.id === selectedId;
      item.style.background = active ? 'rgba(255, 213, 79, 0.9)' : 'rgba(32, 45, 58, 0.85)';
      item.style.color = active ? '#1f1f1f' : '#eceff1';
      item.style.border = active ? '1px solid rgba(255,255,255,0.8)' : '1px solid rgba(255,255,255,0.25)';
      item.style.boxShadow = active ? '0 0 18px rgba(255, 213, 79, 0.45)' : '0 0 14px rgba(0, 0, 0, 0.4)';

      const name = document.createElement('div');
      name.textContent = opt.label;
      name.style.fontSize = '15px';
      name.style.fontWeight = '600';
      name.style.marginBottom = '4px';
      item.appendChild(name);

      const cost = document.createElement('div');
      cost.style.fontSize = '12px';
      cost.style.opacity = opt.affordable ? '0.9' : '0.55';
      const costParts = Object.entries(opt.cost).map(([ctype, amt]) => `${amt} ${ctype}`);
      cost.textContent = costParts.length > 0 ? costParts.join(' | ') : 'Free';
      item.appendChild(cost);

      const meta = document.createElement('div');
      meta.style.fontSize = '11px';
      meta.style.opacity = '0.75';
      meta.textContent = `${opt.buildTimeSec.toFixed(1)}s, noise ${opt.noisePerSec.toFixed(1)}`;
      item.appendChild(meta);

      if (!opt.affordable) {
        const warn = document.createElement('div');
        warn.textContent = 'Insufficient';
        warn.style.marginTop = '4px';
        warn.style.fontSize = '11px';
        warn.style.fontWeight = '600';
        warn.style.color = '#ff8a80';
        item.appendChild(warn);
      }

      this.items.appendChild(item);
    });
  }
}
