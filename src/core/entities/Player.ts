import { Actor } from './Actor';
import { ConfigService } from '../data/ConfigService';
import { InputController } from '../../engine/input/InputController';

/**
 * Responsibility: Player movement driven by InputController and config speeds.
 * Publishes: none
 * Subscribes: none
 * Config: game.player.walkSpeed, crouchSpeed, sprintSpeed (tiles/sec), game.tileSize
 */
export class Player extends Actor {
  private input: InputController;

  constructor(id: string, cfg: ConfigService, input: InputController) {
    super(id, cfg.getGame().tileSize);
    const g = cfg.getGame();
    this.setSpeedsTiles(g.player.walkSpeed, g.player.crouchSpeed, g.player.sprintSpeed);
    this.input = input;
  }

  public getCurrentMode(): 'walk' | 'crouch' | 'sprint' {
    if (this.input.isCrouching()) return 'crouch';
    if (this.input.isSprinting()) return 'sprint';
    return 'walk';
  }

  public update(dtSec: number): void {
    const dir = this.input.getMoveDir();
    if (dir.x === 0 && dir.y === 0) return;
    const mode = this.getCurrentMode();
    const speed = this.getSpeedPxPerSec(mode);
    this.x += dir.x * speed * dtSec;
    this.y += dir.y * speed * dtSec;
  }
}

