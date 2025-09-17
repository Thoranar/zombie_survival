import { Zombie, ZombieStats } from './Zombie';

export class Walker extends Zombie {
  constructor(id: string, tileSize: number, stats: ZombieStats) {
    super(id, 'Walker', tileSize, stats);
  }
}

