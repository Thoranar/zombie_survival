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

  public attach(target: Window | Document): void {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
  }

  public detach(target: Window | Document): void {
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.key.toLowerCase());
    if (e.key.toLowerCase() === 'e') this.interactPressed = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  // Testing hook to simulate key state
  public setKeyState(key: string, down: boolean): void {
    const k = key.toLowerCase();
    if (down) this.keys.add(k);
    else this.keys.delete(k);
  }

  public getMoveDir(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    // normalize
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      x /= len; // no allocations
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

  // One-shot press for actions like toggling doors
  public consumeInteractPressed(): boolean {
    const was = this.interactPressed;
    this.interactPressed = false;
    return was;
  }
}
