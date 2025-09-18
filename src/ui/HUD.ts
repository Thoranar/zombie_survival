/**
 * Responsibility: Simple HUD showing Day #, phase, countdown, and noise stub.
 * Publishes: none
 * Subscribes: none
 * Config: formatting is static; values come from TimeSystem and future NoiseSystem
 */
export class HUD {
  private readonly root: HTMLDivElement;
  private readonly dayEl: HTMLSpanElement;
  private readonly phaseEl: HTMLSpanElement;
  private readonly timeEl: HTMLSpanElement;
  private readonly healthEl: HTMLSpanElement;
  private readonly noiseEl: HTMLSpanElement;
  private readonly carriedEl: HTMLDivElement;
  private readonly storedEl: HTMLDivElement;
  private readonly hintEl: HTMLDivElement;

  constructor(host: HTMLElement) {
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.right = '8px';
    root.style.top = '8px';
    root.style.padding = '6px 8px';
    root.style.background = 'rgba(0,0,0,0.5)';
    root.style.color = '#fff';
    root.style.font = '12px monospace';
    host.appendChild(root);

    const line = (label: string): [HTMLDivElement, HTMLSpanElement] => {
      const row = document.createElement('div');
      const span = document.createElement('span');
      row.textContent = label + ' ';
      row.appendChild(span);
      root.appendChild(row);
      return [row, span];
    };

    [, this.dayEl] = line('Day:');
    [, this.phaseEl] = line('Phase:');
    [, this.timeEl] = line('Time:');
    [, this.healthEl] = line('Health:');
    [, this.noiseEl] = line('Noise:');
    const carriedRow = document.createElement('div');
    carriedRow.style.marginTop = '6px';
    carriedRow.textContent = 'Carried:';
    const carried = document.createElement('div');
    carried.style.marginTop = '2px';
    carried.style.whiteSpace = 'pre';

    const storedRow = document.createElement('div');
    storedRow.style.marginTop = '6px';
    storedRow.textContent = 'Stored:';
    const stored = document.createElement('div');
    stored.style.marginTop = '2px';
    stored.style.whiteSpace = 'pre';

    root.appendChild(carriedRow);
    root.appendChild(carried);
    root.appendChild(storedRow);
    root.appendChild(stored);
    this.carriedEl = carried;
    this.storedEl = stored;
    const hint = document.createElement('div');
    hint.style.marginTop = '6px';
    hint.style.color = '#ff6b6b';
    this.root = root;
    this.hintEl = hint;
    this.root.appendChild(hint);
  }

  public setDay(day: number): void {
    this.dayEl.textContent = String(day);
  }

  public setPhase(phase: string): void {
    this.phaseEl.textContent = phase;
  }

  public setTimeLeft(sec: number): void {
    const s = Math.max(0, Math.floor(sec % 60));
    const m = Math.max(0, Math.floor(sec / 60));
    this.timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }

  public setPlayerHealth(current: number, max: number): void {
    const cur = Math.max(0, Math.floor(current));
    const cap = Math.max(0, Math.floor(max));
    this.healthEl.textContent = `${cur}/${cap}`;
  }

  public setNoiseStub(value: number): void {
    this.noiseEl.textContent = value.toFixed(2);
  }

  public setCarriedTotals(totals: Record<string, number>, order: string[]): void {
    const parts: string[] = [];
    for (const k of order) {
      const v = totals[k] ?? 0;
      parts.push(`${k}: ${Math.floor(v)}`);
    }
    this.carriedEl.textContent = parts.join('\n');
  }

  public setStoredTotals(totals: Record<string, number>, order: string[]): void {
    const parts: string[] = [];
    for (const k of order) {
      const v = totals[k] ?? 0;
      parts.push(`${k}: ${Math.floor(v)}`);
    }
    this.storedEl.textContent = parts.join('\n');
  }

  public setHint(text: string): void {
    this.hintEl.textContent = text;
  }
}
