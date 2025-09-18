import { ExperienceState } from '@core/systems/ExperienceSystem';

export class ExperienceOverlay {
  private readonly root: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly levelEl: HTMLSpanElement;
  private readonly debugEl: HTMLDivElement;

  constructor(host: HTMLElement) {
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.top = '12px';
    root.style.left = '50%';
    root.style.transform = 'translateX(-50%)';
    root.style.width = '320px';
    root.style.padding = '6px 10px';
    root.style.background = 'rgba(0, 0, 0, 0.55)';
    root.style.border = '1px solid rgba(255, 255, 255, 0.35)';
    root.style.borderRadius = '6px';
    root.style.font = '12px monospace';
    root.style.color = '#ffffff';
    root.style.zIndex = '1500';
    root.style.pointerEvents = 'none';

    const levelRow = document.createElement('div');
    levelRow.style.display = 'flex';
    levelRow.style.alignItems = 'center';
    levelRow.style.justifyContent = 'space-between';

    const label = document.createElement('span');
    label.textContent = 'LEVEL';
    label.style.letterSpacing = '2px';
    label.style.fontSize = '11px';

    const levelValue = document.createElement('span');
    levelValue.style.fontWeight = 'bold';
    levelValue.style.fontSize = '16px';
    levelValue.textContent = '1';

    levelRow.appendChild(label);
    levelRow.appendChild(levelValue);

    const bar = document.createElement('div');
    bar.style.position = 'relative';
    bar.style.marginTop = '6px';
    bar.style.width = '100%';
    bar.style.height = '12px';
    bar.style.background = 'rgba(255, 255, 255, 0.12)';
    bar.style.borderRadius = '6px';
    bar.style.overflow = 'hidden';

    const fill = document.createElement('div');
    fill.style.position = 'absolute';
    fill.style.left = '0';
    fill.style.top = '0';
    fill.style.bottom = '0';
    fill.style.width = '0%';
    fill.style.background = 'linear-gradient(90deg, #fdd835, #ffeb3b)';

    bar.appendChild(fill);

    const debug = document.createElement('div');
    debug.style.marginTop = '6px';
    debug.style.fontSize = '11px';
    debug.style.opacity = '0.85';
    debug.style.display = 'none';

    root.appendChild(levelRow);
    root.appendChild(bar);
    root.appendChild(debug);
    host.appendChild(root);

    this.root = root;
    this.fill = fill;
    this.levelEl = levelValue;
    this.debugEl = debug;
  }

  public update(state: ExperienceState, showNumbers: boolean): void {
    const ratio = !Number.isFinite(state.requiredXp) || state.requiredXp <= 0
      ? 1
      : Math.max(0, Math.min(1, state.currentXp / state.requiredXp));
    this.fill.style.width = `${(ratio * 100).toFixed(2)}%`;
    this.levelEl.textContent = String(state.level);
    if (showNumbers) {
      const current = Math.floor(state.currentXp);
      const needed = Number.isFinite(state.requiredXp) ? Math.floor(state.requiredXp) : 'MAX';
      this.debugEl.textContent = `XP ${current} / ${needed}`;
      this.debugEl.style.display = 'block';
    } else {
      this.debugEl.style.display = 'none';
    }
  }
}
