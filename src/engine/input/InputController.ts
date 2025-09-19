/**
 * Responsibility: Capture WASD/Ctrl/Shift input and expose a movement intent.
 * Publishes: none
 * Subscribes: DOM keyboard events
 * Config: none (behavioral speeds live in game.json5 via Player)
 * Notes: Engine-agnostic; tests can set key state without DOM.
 */
export class InputController {
  private keys = new Set<string>();
  private interactPressed = false;
  private buildCycleNext = false;
  private buildCyclePrev = false;
  private cancelBuildPressed = false;

  public attach(target: Window | Document): void {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
  }

  public detach(target: Window | Document): void {
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent;
    const key = e.key.toLowerCase();
    this.keys.add(key);
    if (key === 'e') this.interactPressed = true;
    if (!e.repeat) {
      if (key === 'd' || key === 'arrowright') this.buildCycleNext = true;
      if (key === 'a' || key === 'arrowleft') this.buildCyclePrev = true;
      if (key === 'escape') this.cancelBuildPressed = true;
    }
  };

  private onKeyUp = (event: Event): void => {
    const e = event as KeyboardEvent;
    this.keys.delete(e.key.toLowerCase());
  };

  // Testing hook to simulate key state
  public setKeyState(key: string, down: boolean): void {
    const k = key.toLowerCase();
    if (down) {
      const firstPress = !this.keys.has(k);
      this.keys.add(k);
      if (k === 'e') this.interactPressed = true;
      if (firstPress) {
        if (k === 'd' || k === 'arrowright') this.buildCycleNext = true;
        if (k === 'a' || k === 'arrowleft') this.buildCyclePrev = true;
        if (k === 'escape') this.cancelBuildPressed = true;
      }
    } else {
      this.keys.delete(k);
    }
  }

  public getMoveDir(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  public isCrouching(): boolean {
    return this.keys.has('control') || this.keys.has('ctrl');
  }

  public isSprinting(): boolean {
    return this.keys.has('shift');
  }

  public isInteractHeld(): boolean {
    return this.keys.has('e');
  }

  public isBuildMenuHeld(): boolean {
    return this.keys.has('b');
  }

  public isDeconstructHeld(): boolean {
    return this.keys.has('x');
  }

  public consumeBuildCycleNext(): boolean {
    const was = this.buildCycleNext;
    this.buildCycleNext = false;
    return was;
  }

  public consumeBuildCyclePrev(): boolean {
    const was = this.buildCyclePrev;
    this.buildCyclePrev = false;
    return was;
  }

  public consumeCancelBuild(): boolean {
    const was = this.cancelBuildPressed;
    this.cancelBuildPressed = false;
    return was;
  }

  // One-shot press for actions like toggling doors
  public consumeInteractPressed(): boolean {
    const was = this.interactPressed;
    this.interactPressed = false;
    return was;
  }
}

