export class GameOverOverlay {
  private readonly root: HTMLDivElement;
  private readonly messageEl: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly onReset: () => void;

  constructor(host: HTMLElement, onReset: () => void) {
    this.onReset = onReset;
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.top = '0';
    root.style.left = '0';
    root.style.right = '0';
    root.style.bottom = '0';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.alignItems = 'center';
    root.style.justifyContent = 'center';
    root.style.background = 'rgba(0, 0, 0, 0.78)';
    root.style.color = '#ffffff';
    root.style.font = '16px monospace';
    root.style.gap = '12px';
    root.style.zIndex = '2000';
    root.style.visibility = 'hidden';
    root.style.pointerEvents = 'none';

    const title = document.createElement('div');
    title.textContent = 'GAME OVER';
    title.style.fontSize = '24px';
    title.style.fontWeight = 'bold';
    title.style.letterSpacing = '2px';

    const message = document.createElement('div');
    message.textContent = 'The survivor has fallen.';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Reset Run';
    button.style.padding = '8px 18px';
    button.style.fontFamily = 'inherit';
    button.style.fontSize = '14px';
    button.style.cursor = 'pointer';
    button.addEventListener('click', (e) => {
      e.preventDefault();
      this.onReset();
    });

    root.appendChild(title);
    root.appendChild(message);
    root.appendChild(button);
    host.appendChild(root);

    this.root = root;
    this.messageEl = message;
    this.button = button;
  }

  public show(killerId?: string): void {
    if (killerId) {
      this.messageEl.textContent = `The survivor was slain by ${killerId}. Press reset to try again.`;
    } else {
      this.messageEl.textContent = 'The survivor has fallen. Press reset to try again.';
    }
    this.root.style.visibility = 'visible';
    this.root.style.pointerEvents = 'auto';
    queueMicrotask(() => this.button.focus());
  }

  public hide(): void {
    this.root.style.visibility = 'hidden';
    this.root.style.pointerEvents = 'none';
  }
}
