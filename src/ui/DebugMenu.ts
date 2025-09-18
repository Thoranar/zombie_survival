/**
 * Responsibility: Minimal debug menu with toggles (e.g., show colliders).
 * Publishes: none
 * Subscribes: DOM click input
 * Config: none
 */
export class DebugMenu {
  private readonly root: HTMLDivElement;
  private collidersCb!: HTMLInputElement;
  private noSpawnCb!: HTMLInputElement;
  private minSepCb!: HTMLInputElement;
  private xpNumbersCb!: HTMLInputElement;
  private onChange?: (opts: {
    showColliders: boolean;
    showNoSpawnRadius: boolean;
    showMinSeparation: boolean;
    showNoise: boolean;
    showZombieDetect: boolean;
    showZombieStates: boolean;
    showHordeDebug: boolean;
    disableChase: boolean;
    showZombieTargets: boolean;
    showZombieAggro: boolean;
    showExperienceNumbers: boolean;
  }) => void;
  private spawnHordeBtn!: HTMLButtonElement;
  private damagePlayerBtn!: HTMLButtonElement;
  private healPlayerBtn!: HTMLButtonElement;
  private damageStructuresBtn!: HTMLButtonElement;
  private healStructuresBtn!: HTMLButtonElement;
  private damageZombiesBtn!: HTMLButtonElement;
  private healZombiesBtn!: HTMLButtonElement;
  private onSpawnHorde?: () => void;
  private onDamagePlayer?: () => void;
  private onHealPlayer?: () => void;
  private onDamageStructures?: () => void;
  private onHealStructures?: () => void;
  private onDamageZombies?: () => void;
  private onHealZombies?: () => void;

  constructor(host: HTMLElement) {
    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.right = '8px';
    root.style.bottom = '8px';
    root.style.padding = '8px 10px';
    root.style.background = 'rgba(0,0,0,0.5)';
    root.style.border = '1px solid rgba(255,255,255,0.6)';
    root.style.borderRadius = '4px';
    root.style.color = '#fff';
    root.style.font = '12px monospace';
    root.style.pointerEvents = 'auto';

    const title = document.createElement('div');
    title.textContent = 'Debug Tools';
    title.style.marginBottom = '6px';
    title.style.fontWeight = 'bold';

    const makeRow = (labelText: string, assign: (cb: HTMLInputElement) => void) => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '6px';
      row.style.marginTop = '4px';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.onchange = () => this.emitChange();
      assign(cb);
      const text = document.createElement('span');
      text.textContent = labelText;
      row.appendChild(cb);
      row.appendChild(text);
      return row;
    };

    const row1 = makeRow('Show Colliders', (cb) => (this.collidersCb = cb));
    const row2 = makeRow('Show No-Spawn Radius', (cb) => (this.noSpawnCb = cb));
    const row3 = makeRow('Show Min-Separation', (cb) => (this.minSepCb = cb));
    const row4 = makeRow('Show Noise Circle', (cb) => ((this as any).noiseCb = cb));
    const row5 = makeRow('Show Zombie Detect Ring', (cb) => ((this as any).zDetectCb = cb));
    const row6 = makeRow('Show Zombie State Labels', (cb) => ((this as any).zStateCb = cb));
    const row7 = makeRow('Show Horde Debug', (cb) => ((this as any).hordeDbgCb = cb));
    const row8 = makeRow('Disable Zombie Chase', (cb) => ((this as any).disableChaseCb = cb));
    const row9 = makeRow('Show Zombie Targets', (cb) => ((this as any).zTargetCb = cb));
    const row10 = makeRow('Show Zombie Aggro Info', (cb) => ((this as any).zAggroCb = cb));
    const row11 = makeRow('Show XP Numbers', (cb) => (this.xpNumbersCb = cb));

    const sep = document.createElement('div');
    sep.style.margin = '6px 0';
    sep.style.borderTop = '1px solid rgba(255,255,255,0.2)';
    sep.style.height = '1px';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.flexDirection = 'column';
    actions.style.gap = '6px';

    const makeActionButton = (label: string, handler: () => void): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cursor = 'pointer';
      btn.style.font = '12px monospace';
      btn.onclick = handler;
      return btn;
    };

    const spawnBtn = makeActionButton('Spawn Horde (3)', () => this.onSpawnHorde?.());
    const damagePlayerBtn = makeActionButton('Damage Player', () => this.onDamagePlayer?.());
    const healPlayerBtn = makeActionButton('Heal Player', () => this.onHealPlayer?.());
    const damageStructuresBtn = makeActionButton('Damage Structures', () => this.onDamageStructures?.());
    const healStructuresBtn = makeActionButton('Repair Structures', () => this.onHealStructures?.());
    const damageZombiesBtn = makeActionButton('Damage Zombies', () => this.onDamageZombies?.());
    const healZombiesBtn = makeActionButton('Heal Zombies', () => this.onHealZombies?.());

    actions.appendChild(spawnBtn);
    actions.appendChild(damagePlayerBtn);
    actions.appendChild(healPlayerBtn);
    actions.appendChild(damageStructuresBtn);
    actions.appendChild(healStructuresBtn);
    actions.appendChild(damageZombiesBtn);
    actions.appendChild(healZombiesBtn);

    this.spawnHordeBtn = spawnBtn;
    this.damagePlayerBtn = damagePlayerBtn;
    this.healPlayerBtn = healPlayerBtn;
    this.damageStructuresBtn = damageStructuresBtn;
    this.healStructuresBtn = healStructuresBtn;
    this.damageZombiesBtn = damageZombiesBtn;
    this.healZombiesBtn = healZombiesBtn;

    root.appendChild(title);
    root.appendChild(row1);
    root.appendChild(row2);
    root.appendChild(row3);
    root.appendChild(row4);
    root.appendChild(row5);
    root.appendChild(row6);
    root.appendChild(row7);
    root.appendChild(row8);
    root.appendChild(row9);
    root.appendChild(row10);
    root.appendChild(row11);
    root.appendChild(sep);
    root.appendChild(actions);
    host.appendChild(root);
    this.root = root;
  }

  private emitChange(): void {
    const noiseCb: HTMLInputElement | undefined = (this as any).noiseCb;
    const zDetectCb: HTMLInputElement | undefined = (this as any).zDetectCb;
    const zStateCb: HTMLInputElement | undefined = (this as any).zStateCb;
    const hordeDbgCb: HTMLInputElement | undefined = (this as any).hordeDbgCb;
    const disableChaseCb: HTMLInputElement | undefined = (this as any).disableChaseCb;
    const zTargetCb: HTMLInputElement | undefined = (this as any).zTargetCb;
    const zAggroCb: HTMLInputElement | undefined = (this as any).zAggroCb;
    this.onChange?.({
      showColliders: !!this.collidersCb?.checked,
      showNoSpawnRadius: !!this.noSpawnCb?.checked,
      showMinSeparation: !!this.minSepCb?.checked,
      showNoise: !!noiseCb?.checked,
      showZombieDetect: !!zDetectCb?.checked,
      showZombieStates: !!zStateCb?.checked,
      showHordeDebug: !!hordeDbgCb?.checked,
      disableChase: !!disableChaseCb?.checked,
      showZombieTargets: !!zTargetCb?.checked,
      showZombieAggro: !!zAggroCb?.checked,
      showExperienceNumbers: !!this.xpNumbersCb?.checked
    });
  }

  public setOnChange(handler: (opts: {
    showColliders: boolean;
    showNoSpawnRadius: boolean;
    showMinSeparation: boolean;
    showNoise: boolean;
    showZombieDetect: boolean;
    showZombieStates: boolean;
    showHordeDebug: boolean;
    disableChase: boolean;
    showZombieTargets: boolean;
    showZombieAggro: boolean;
    showExperienceNumbers: boolean;
  }) => void): void {
    this.onChange = handler;
  }

  public setShowColliders(value: boolean): void { if (this.collidersCb) this.collidersCb.checked = value; }
  public setShowNoSpawnRadius(value: boolean): void { if (this.noSpawnCb) this.noSpawnCb.checked = value; }
  public setShowMinSeparation(value: boolean): void { if (this.minSepCb) this.minSepCb.checked = value; }
  public setShowNoise(value: boolean): void { const n: HTMLInputElement | undefined = (this as any).noiseCb; if (n) n.checked = value; }
  public setShowZombieDetect(value: boolean): void { const n: HTMLInputElement | undefined = (this as any).zDetectCb; if (n) n.checked = value; }
  public setShowZombieStates(value: boolean): void { const n: HTMLInputElement | undefined = (this as any).zStateCb; if (n) n.checked = value; }
  public setShowZombieTargets(value: boolean): void { const n: HTMLInputElement | undefined = (this as any).zTargetCb; if (n) n.checked = value; }
  public setShowZombieAggro(value: boolean): void { const n: HTMLInputElement | undefined = (this as any).zAggroCb; if (n) n.checked = value; }
  public setShowExperienceNumbers(value: boolean): void { if (this.xpNumbersCb) this.xpNumbersCb.checked = value; }

  public setOnSpawnHorde(handler: () => void): void { this.onSpawnHorde = handler; }
  public setShowHordeDebug(value: boolean): void { const n: HTMLInputElement | undefined = (this as any).hordeDbgCb; if (n) n.checked = value; }
  public setDisableChase(value: boolean): void { const n: HTMLInputElement | undefined = (this as any).disableChaseCb; if (n) n.checked = value; }
  public setOnDamagePlayer(handler: () => void): void { this.onDamagePlayer = handler; }
  public setOnHealPlayer(handler: () => void): void { this.onHealPlayer = handler; }
  public setOnDamageStructures(handler: () => void): void { this.onDamageStructures = handler; }
  public setOnHealStructures(handler: () => void): void { this.onHealStructures = handler; }
  public setOnDamageZombies(handler: () => void): void { this.onDamageZombies = handler; }
  public setOnHealZombies(handler: () => void): void { this.onHealZombies = handler; }
}

