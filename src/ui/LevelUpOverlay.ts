import { LevelUpCardData } from '@core/systems/ExperienceSystem';

export class LevelUpOverlay {
  private readonly root: HTMLDivElement;
  private readonly cardsWrap: HTMLDivElement;
  private onSelect?: (cardId: string) => void;

  constructor(host: HTMLElement) {
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.top = '0';
    root.style.left = '0';
    root.style.right = '0';
    root.style.bottom = '0';
    root.style.background = 'rgba(0, 0, 0, 0.7)';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.alignItems = 'center';
    root.style.justifyContent = 'center';
    root.style.gap = '24px';
    root.style.zIndex = '2500';
    root.style.visibility = 'hidden';
    root.style.pointerEvents = 'none';
    root.style.color = '#ffffff';
    root.style.font = '14px monospace';

    const title = document.createElement('div');
    title.textContent = 'LEVEL UP! Choose an upgrade';
    title.style.fontSize = '22px';
    title.style.letterSpacing = '2px';
    title.style.fontWeight = 'bold';

    const cardsWrap = document.createElement('div');
    cardsWrap.style.display = 'flex';
    cardsWrap.style.gap = '18px';

    root.appendChild(title);
    root.appendChild(cardsWrap);
    host.appendChild(root);

    this.root = root;
    this.cardsWrap = cardsWrap;
  }

  public show(cards: LevelUpCardData[], onSelect: (cardId: string) => void): void {
    this.onSelect = onSelect;
    this.cardsWrap.innerHTML = '';
    cards.forEach((card, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-card-id', card.id);
      btn.style.width = '180px';
      btn.style.minHeight = '160px';
      btn.style.background = 'rgba(0, 0, 0, 0.5)';
      btn.style.border = '2px solid rgba(255, 255, 255, 0.35)';
      btn.style.borderRadius = '10px';
      btn.style.color = '#ffeb3b';
      btn.style.cursor = 'pointer';
      btn.style.padding = '14px';
      btn.style.display = 'flex';
      btn.style.flexDirection = 'column';
      btn.style.justifyContent = 'space-between';
      btn.style.boxShadow = '0 0 18px rgba(255, 235, 59, 0.25)';
      btn.style.font = 'inherit';
      btn.onmouseenter = () => {
        btn.style.borderColor = '#ffeb3b';
        btn.style.boxShadow = '0 0 24px rgba(255, 235, 59, 0.45)';
      };
      btn.onmouseleave = () => {
        btn.style.borderColor = 'rgba(255, 255, 255, 0.35)';
        btn.style.boxShadow = '0 0 18px rgba(255, 235, 59, 0.25)';
      };
      btn.onclick = (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-card-id');
        if (id) this.handleSelect(id);
      };

      const heading = document.createElement('div');
      heading.textContent = card.title;
      heading.style.fontSize = '18px';
      heading.style.fontWeight = 'bold';

      const body = document.createElement('div');
      body.textContent = card.description;
      body.style.fontSize = '13px';
      body.style.color = '#ffffff';
      body.style.opacity = '0.85';
      body.style.marginTop = '12px';

      btn.appendChild(heading);
      btn.appendChild(body);
      this.cardsWrap.appendChild(btn);
      if (index === 0) queueMicrotask(() => btn.focus());
    });
    this.root.style.visibility = 'visible';
    this.root.style.pointerEvents = 'auto';
  }

  public hide(): void {
    this.root.style.visibility = 'hidden';
    this.root.style.pointerEvents = 'none';
    this.cardsWrap.innerHTML = '';
    this.onSelect = undefined;
  }

  private handleSelect(cardId: string): void {
    const handler = this.onSelect;
    this.hide();
    handler?.(cardId);
  }
}
