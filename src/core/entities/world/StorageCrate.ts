/**
 * Responsibility: Storage crate that auto-deposits carried resources within radius.
 * Publishes: none
 * Subscribes: none
 * Config: game.storage.autoDepositRadius (tiles)
 */
export class StorageCrate {
  public x = 0;
  public y = 0;
  public sizePx: number;
  public readonly id: string;

  constructor(id: string, sizePx: number) {
    this.id = id;
    this.sizePx = sizePx;
  }
}

