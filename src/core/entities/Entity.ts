/**
 * Responsibility: Base entity with id and position in world pixels.
 * Publishes: none
 * Subscribes: none
 * Config: none
 */
export class Entity {
  public readonly id: string;
  public x = 0;
  public y = 0;

  constructor(id: string) {
    this.id = id;
  }
}

