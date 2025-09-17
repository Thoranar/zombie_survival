/**
 * Responsibility: Simple DOM-based debug overlay for runtime diagnostics.
 * Publishes: none
 * Subscribes: none
 * Config: none
 * Notes: Shows fixed-step info (steps per frame, dt). Toggleable later.
 */
export class DebugOverlay {
  private readonly el: HTMLDivElement;

  constructor(host: HTMLElement) {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.left = '8px';
    el.style.top = '8px';
    el.style.padding = '4px 6px';
    el.style.background = 'rgba(0,0,0,0.5)';
    el.style.color = '#fff';
    el.style.font = '12px monospace';
    el.style.pointerEvents = 'none';
    host.style.position = 'relative';
    host.appendChild(el);
    this.el = el;
  }

  public setText(text: string): void {
    this.el.textContent = text;
  }
}

