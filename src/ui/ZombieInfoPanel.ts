export interface ZombieInfoData {
  id: string;
  kind: string;
  hp: number;
  walkTiles: number;
  sprintTiles: number;
  detectRadiusTiles: number;
  attackPower: number;
  attackIntervalSec: number;
  attackRangeTiles: number;
  state: string;
}

export class ZombieInfoPanel {
  private readonly root: HTMLDivElement;
  private readonly content: HTMLPreElement;

  constructor(host: HTMLElement) {
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.left = '8px';
    root.style.bottom = '8px';
    root.style.padding = '8px 10px';
    root.style.background = 'rgba(0,0,0,0.55)';
    root.style.border = '1px solid rgba(255,255,255,0.6)';
    root.style.borderRadius = '4px';
    root.style.color = '#fff';
    root.style.font = '12px monospace';
    root.style.pointerEvents = 'none';
    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.whiteSpace = 'pre-wrap';
    root.appendChild(pre);
    host.appendChild(root);
    this.root = root;
    this.content = pre;
    this.setZombie(null);
  }

  public setZombie(data: ZombieInfoData | null): void {
    if (!data) {
      this.root.style.display = 'none';
      this.content.textContent = '';
      return;
    }
    this.root.style.display = 'block';
    const lines = [
      `Zombie: ${data.kind} (${data.id})`,
      `State: ${data.state}`,
      `HP: ${data.hp}`,
      `Speed: walk ${data.walkTiles} t/s, sprint ${data.sprintTiles} t/s`,
      `Detect: ${data.detectRadiusTiles} tiles`,
      `Attack: ${data.attackPower} dmg @ ${data.attackIntervalSec}s, range ${data.attackRangeTiles}t`
    ];
    this.content.textContent = lines.join('\n');
  }
}

