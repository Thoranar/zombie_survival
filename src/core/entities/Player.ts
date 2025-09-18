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
  private readonly maxHp: number;
  private hp: number;
  private input: InputController;

  constructor(id: string, cfg: ConfigService, input: InputController) {
    super(id, cfg.getGame().tileSize);
    const g = cfg.getGame();
    const baseHp = Number(g.player?.hp ?? 100);
    const safeHp = Number.isFinite(baseHp) && baseHp > 0 ? Math.floor(baseHp) : 100;
    this.maxHp = safeHp;
    this.hp = this.maxHp;
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

  public getHp(): number {
    return this.hp;
  }

  public getMaxHp(): number {
    return this.maxHp;
  }

  public applyDamage(amount: number): number {
    if (amount <= 0 || this.hp <= 0) return 0;
    const dmg = Math.max(0, amount);
    const before = this.hp;
    this.hp = Math.max(0, this.hp - dmg);
    return before - this.hp;
  }
  public heal(amount: number): number {
    if (amount <= 0 || this.hp >= this.maxHp) return 0;
    const healAmt = Math.max(0, amount);
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + healAmt);
    return this.hp - before;
  }


  public isDead(): boolean {
    return this.hp <= 0;
  }

  public resetHealth(): void {
    this.hp = this.maxHp;
  }
}

