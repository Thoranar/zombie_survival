import { Actor } from '../../entities/Actor';

export type ZombieState = 'idle' | 'roam' | 'chase' | 'attack';

export interface ZombieStats {
  hp: number;
  walkTiles: number;
  sprintTiles: number;
  detectRadiusTiles: number;
  attackPower: number;
  attackIntervalSec: number;
  attackRangeTiles?: number;
}

export interface PhaseScales {
  day: number;
  night: number;
  eclipse: number;
}

export class Zombie extends Actor {
  public readonly kind: string;
  public state: ZombieState = 'roam';
  public readonly stats: Required<Omit<ZombieStats, 'attackRangeTiles'>> & { attackRangeTiles: number };
  private roamTarget: { x: number; y: number } | null = null;
  private roamTimer = 0;
  private idleSecLeft = 0;

  constructor(id: string, kind: string, tileSize: number, stats: ZombieStats) {
    super(id, tileSize);
    this.kind = kind;
    // default attack range if omitted
    const attackRangeTiles = typeof stats.attackRangeTiles === 'number' ? stats.attackRangeTiles : 0.7;
    this.stats = {
      hp: stats.hp,
      walkTiles: stats.walkTiles,
      sprintTiles: stats.sprintTiles,
      detectRadiusTiles: stats.detectRadiusTiles,
      attackPower: stats.attackPower,
      attackIntervalSec: stats.attackIntervalSec,
      attackRangeTiles
    };
    this.setSpeedsTiles(stats.walkTiles, stats.walkTiles, stats.sprintTiles);
  }

  public setRoamTarget(x: number, y: number): void {
    this.roamTarget = { x, y };
  }

  public clearRoamTarget(): void { this.roamTarget = null; }

  public updateAI(
    dtSec: number,
    player: { x: number; y: number },
    phaseScale: number,
    bounds: { w: number; h: number },
    detectCtx: { noiseRadiusPx: number; playerRadiusPx: number; disableChase?: boolean },
    steer?: { 
      sepX: number; sepY: number; desiredDistPx: number;
      biasX?: number; biasY?: number; pursueX?: number; pursueY?: number; forceChase?: boolean;
      role?: 'solo' | 'leader' | 'follower';
      idle?: { idleMinSec: number; idleMaxSec: number; moveMinTiles: number; moveMaxTiles: number };
    }
  ): void {
    const detectR = this.stats.detectRadiusTiles * this.tileSize * phaseScale;
    // Distances relative to player for attack/detection purposes
    const dxpP = player.x - this.x;
    const dypP = player.y - this.y;
    const dPlayer = Math.hypot(dxpP, dypP);
    const attackRangePx = this.stats.attackRangeTiles * this.tileSize;

    // Interception checks (player icon and noise ring)
    const playerR = Math.max(0, detectCtx.playerRadiusPx || 0);
    const noiseR = Math.max(0, detectCtx.noiseRadiusPx || 0);
    const playerIntercepts = dPlayer <= detectR + playerR;
    const noiseIntercepts = noiseR > 0 && dPlayer <= detectR + noiseR;

    const role = steer?.role ?? 'solo';
    // State transitions (attack/chase override idle/roam)
    if (dPlayer <= attackRangePx) {
      this.state = 'attack';
    } else if (!detectCtx?.disableChase && (playerIntercepts || noiseIntercepts || (steer?.forceChase ?? false))) {
      this.state = 'chase';
    } else {
      if (role !== 'solo') {
        // When acting as horde leader/follower, do not enter idle; remain roaming
        this.state = 'roam';
        this.idleSecLeft = 0;
      } else if (this.idleSecLeft > 0) {
        this.state = 'idle';
      } else if (this.state !== 'roam' && this.state !== 'idle') {
        this.state = 'idle';
      }
    }

    // Steering integration
    if (this.state === 'attack') {
      // Stay put in attack range, but allow slight tangential separation to resolve overlap
      if (steer) {
        const sepX = steer.sepX;
        const sepY = steer.sepY;
        // project separation onto tangential by removing radial component
        const nx = dxpP / (dPlayer || 1);
        const ny = dypP / (dPlayer || 1);
        const dot = sepX * nx + sepY * ny;
        const tx = sepX - dot * nx;
        const ty = sepY - dot * ny;
        const len = Math.hypot(tx, ty);
        if (len > 0.0001) {
          const speed = this.getSpeedPxPerSec('walk') * 0.5; // slow drift only
          this.x += (tx / len) * speed * dtSec;
          this.y += (ty / len) * speed * dtSec;
        }
      }
    } else if (this.state === 'chase') {
      // Blend radial pursuit, ring positioning, and separation
      let vx = 0;
      let vy = 0;
      // Choose pursuit target (player by default; follower slot when provided)
      const tx = (steer && typeof steer.pursueX === 'number') ? steer.pursueX : player.x;
      const ty = (steer && typeof steer.pursueY === 'number') ? steer.pursueY : player.y;
      const dxt = tx - this.x;
      const dyt = ty - this.y;
      const dtg = Math.hypot(dxt, dyt) || 1;
      const nx = dxt / dtg;
      const ny = dyt / dtg;
      // primary pursuit towards target
      vx += nx;
      vy += ny;
      // add separation (both radial and tangential) to avoid long overlaps while moving
      if (steer) { vx += steer.sepX; vy += steer.sepY; if (steer.biasX) vx += steer.biasX; if (steer.biasY) vy += steer.biasY; }
      const len = Math.hypot(vx, vy);
      if (len > 0.0001) {
        const speed = this.getSpeedPxPerSec('sprint') * phaseScale;
        this.x += (vx / len) * speed * dtSec;
        this.y += (vy / len) * speed * dtSec;
      }
    } else {
      // Idle/Roam scheduling with phase/role-driven behavior
      const tile = this.tileSize;
      const idleCfg = steer?.idle ?? { idleMinSec: 3, idleMaxSec: 7, moveMinTiles: 8, moveMaxTiles: 16 };

      // Decrement idle timer if idling
      if (this.state === 'idle') {
        if (role !== 'solo') {
          // In horde roles, cancel idle immediately
          this.state = 'roam';
          this.idleSecLeft = 0;
        } else {
          this.idleSecLeft -= dtSec;
          if (this.idleSecLeft <= 0) {
            // time to move: pick a roam target for non-followers (solo only here)
            const minT = Math.max(1, Math.floor(idleCfg.moveMinTiles));
            const maxT = Math.max(minT, Math.floor(idleCfg.moveMaxTiles));
            const distTiles = minT + Math.random() * (maxT - minT);
            const dist = distTiles * tile;
            const ang = Math.random() * Math.PI * 2;
            this.roamTarget = { x: this.x + Math.cos(ang) * dist, y: this.y + Math.sin(ang) * dist };
            this.state = 'roam';
          }
        }
      }

      // Plan target occasionally when roaming (leaders choose longer targets; followers do not choose their own)
      this.roamTimer -= dtSec;
      if ((this.roamTimer <= 0 || !this.roamTarget) && this.state !== 'idle') {
        if (role === 'leader') {
          // Leaders pick farther targets using configured move tiles
          const minT = Math.max(1, Math.floor(idleCfg.moveMinTiles));
          const maxT = Math.max(minT, Math.floor(idleCfg.moveMaxTiles));
          const distTiles = minT + Math.random() * (maxT - minT);
          const dist = distTiles * tile;
          const ang2 = Math.random() * Math.PI * 2;
          this.roamTarget = { x: this.x + Math.cos(ang2) * dist, y: this.y + Math.sin(ang2) * dist };
          this.roamTimer = 2 + Math.random() * 2; // longer cadence
        } else if (role !== 'follower') {
          // Solo or non-follower small drift
          const roamR = 4 * tile;
          const ang2 = Math.random() * Math.PI * 2;
          const rad2 = Math.random() * roamR;
          this.roamTarget = { x: this.x + Math.cos(ang2) * rad2, y: this.y + Math.sin(ang2) * rad2 };
          this.roamTimer = 1 + Math.random() * 1.5;
        }
      }

      let vx = 0; let vy = 0;
      if (this.roamTarget && this.state !== 'idle') {
        const dx = this.roamTarget.x - this.x;
        const dy = this.roamTarget.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 8) {
          this.roamTarget = null;
          if (role === 'solo') {
            // on arrival, start an idle period
            const iMin = Math.max(0, idleCfg.idleMinSec);
            const iMax = Math.max(iMin, idleCfg.idleMaxSec);
            this.idleSecLeft = iMin + Math.random() * (iMax - iMin);
            this.state = 'idle';
          } else {
            // leaders/followers do not enter idle; keep roaming
            this.state = 'roam';
            this.roamTimer = 0; // pick a new target soon if needed
          }
        } else {
          vx += dx / d;
          vy += dy / d;
        }
      }
      // Cohesion toward follower slot if provided and not idling
      if (steer && typeof steer.pursueX === 'number' && typeof steer.pursueY === 'number' && this.state !== 'idle') {
        const dx = steer.pursueX - this.x;
        const dy = steer.pursueY - this.y;
        const d = Math.hypot(dx, dy);
        if (d > 1e-3) {
          const nx = dx / d;
          const ny = dy / d;
          vx += nx * 1.0;
          vy += ny * 1.0;
        }
      }

      if (steer) { vx += steer.sepX; vy += steer.sepY; if (steer.biasX) vx += steer.biasX; if (steer.biasY) vy += steer.biasY; }
      const len = Math.hypot(vx, vy);
      if (len > 0.0001) {
        const speed = this.getSpeedPxPerSec('walk');
        this.x += (vx / len) * speed * dtSec;
        this.y += (vy / len) * speed * dtSec;
      }
    }

    // Clamp to world bounds with small margin
    const pr = this.tileSize * 0.3;
    this.x = Math.min(Math.max(this.x, pr), bounds.w - pr);
    this.y = Math.min(Math.max(this.y, pr), bounds.h - pr);
  }

  public getIdleSecLeft(): number { return Math.max(0, this.idleSecLeft); }
}
