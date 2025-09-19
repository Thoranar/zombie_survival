import { Actor } from '../../entities/Actor';
import { segmentIntersectsAABB } from '../../math/Geometry';



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



interface ZombieCollider {

  x: number;

  y: number;

  hw: number;

  hh: number;

  kind?: 'wall' | 'node';

  id?: string;

  type?: 'Wall' | 'Door';

  playerBuilt?: boolean;

  structureKind?: 'door' | 'wall' | 'offense';

}



interface AttackStructureTarget {

  id: string;

  type: 'Wall' | 'Door';

  x: number;

  y: number;

  hw: number;

  hh: number;

}

interface ZombieDebugInfo {
  wantsAggro: boolean;
  hasLineOfSight: boolean;
  targetKind: 'player' | 'door' | 'wall' | 'offense' | 'none';
  targetId: string | null;
  focusDistPx: number;
  playerDistPx: number;
  playerIntercepts: boolean;
  noiseIntercepts: boolean;
  structurePriority: number | null;
}

export class Zombie extends Actor {

  public readonly kind: string;

  public state: ZombieState = 'roam';

  public readonly stats: Required<Omit<ZombieStats, 'attackRangeTiles'>> & { attackRangeTiles: number };

  private readonly maxHp: number;
  private hp: number;

  private roamTarget: { x: number; y: number } | null = null;

  private roamTimer = 0;

  private idleSecLeft = 0;

  private readonly collisionRadiusPx: number;

  private attackStructure: AttackStructureTarget | null = null;
  private debugInfo: ZombieDebugInfo = { wantsAggro: false, hasLineOfSight: true, targetKind: 'none', targetId: null, focusDistPx: 0, playerDistPx: 0, playerIntercepts: false, noiseIntercepts: false, structurePriority: null };



  constructor(id: string, kind: string, tileSize: number, stats: ZombieStats) {

    super(id, tileSize);

    this.kind = kind;

    // default attack range if omitted

    const attackRangeTiles = typeof stats.attackRangeTiles === 'number' ? stats.attackRangeTiles : 0.7;

    const safeHp = Math.max(1, Math.floor(stats.hp));

    this.stats = {

      hp: safeHp,

      walkTiles: stats.walkTiles,

      sprintTiles: stats.sprintTiles,

      detectRadiusTiles: stats.detectRadiusTiles,

      attackPower: stats.attackPower,

      attackIntervalSec: stats.attackIntervalSec,

      attackRangeTiles

    };

    this.maxHp = safeHp;
    this.hp = safeHp;

    this.setSpeedsTiles(stats.walkTiles, stats.walkTiles, stats.sprintTiles);

    this.collisionRadiusPx = this.tileSize * 0.3;

  }



  public getCollisionRadius(): number { return this.collisionRadiusPx; }



  public setRoamTarget(x: number, y: number): void {

    this.roamTarget = { x, y };

  }



  public clearRoamTarget(): void { this.roamTarget = null; }

  public getAttackStructure(): AttackStructureTarget | null {
    return this.attackStructure;
  }

  public clearAttackStructure(): void {
    this.attackStructure = null;
  }

  public getDebugInfo(): ZombieDebugInfo {
    return this.debugInfo;
  }

  private setAttackStructure(target: AttackStructureTarget | null): void {
    this.attackStructure = target;
  }



  public updateAI(
    dtSec: number,
    player: { x: number; y: number },
    phaseScale: number,
    bounds: { w: number; h: number },
    detectCtx: { noiseRadiusPx: number; playerRadiusPx: number; disableChase?: boolean },
    steer?: { 
      sepX: number; sepY: number; desiredDistPx: number;
      biasX?: number; biasY?: number; pursueX?: number; pursueY?: number; forceChase?: boolean;
      avoidX?: number; avoidY?: number;
      colliders?: ZombieCollider[];
      role?: 'solo' | 'leader' | 'follower';
      idle?: { idleMinSec: number; idleMaxSec: number; moveMinTiles: number; moveMaxTiles: number };
    }
  ): void {
    const detectR = this.stats.detectRadiusTiles * this.tileSize * phaseScale;
    const dxpP = player.x - this.x;
    const dypP = player.y - this.y;
    const dPlayer = Math.hypot(dxpP, dypP);
    const attackRangePx = this.stats.attackRangeTiles * this.tileSize;

    const colliders = steer?.colliders ?? [];
    const wallCollidersAll = colliders.filter((c) => c.kind === 'wall');
    const wallColliders = wallCollidersAll.filter((c) => c.playerBuilt);

    let structureTarget = this.attackStructure;
    let selectedPriority: number | null = null;

    const playerR = Math.max(0, detectCtx.playerRadiusPx || 0);
    const noiseR = Math.max(0, detectCtx.noiseRadiusPx || 0);
    const playerIntercepts = dPlayer <= detectR + playerR;
    const noiseIntercepts = noiseR > 0 && dPlayer <= detectR + noiseR;

    const role = steer?.role ?? 'solo';
    const detectedNow = !detectCtx?.disableChase && (playerIntercepts || noiseIntercepts || (steer?.forceChase ?? false));
    const wantsAggro = detectedNow;

    const hasLineOfSight = (
      wallCollidersAll.length === 0 ||
      !wallCollidersAll.some((wall) => segmentIntersectsAABB(this.x, this.y, player.x, player.y, wall.x, wall.y, wall.hw, wall.hh))
    );

    if (!wantsAggro) {
      if (structureTarget) {
        this.clearAttackStructure();
        structureTarget = null;
        selectedPriority = null;
      }
    } else {
      if (structureTarget) {
        const current = wallColliders.find((c) => c.id === structureTarget!.id);
        if (!current || !segmentIntersectsAABB(this.x, this.y, player.x, player.y, current.x, current.y, current.hw, current.hh)) {
          this.clearAttackStructure();
          structureTarget = null;
          selectedPriority = null;
        } else {
          const refreshed: AttackStructureTarget = {
            id: current.id!,
            type: (current.type as 'Wall' | 'Door') ?? 'Wall',
            x: current.x,
            y: current.y,
            hw: current.hw,
            hh: current.hh
          };
          this.setAttackStructure(refreshed);
          structureTarget = refreshed;
          selectedPriority = refreshed.type === 'Door' ? 3 : 4;
        }
      }
      if (!structureTarget && !hasLineOfSight) {
        let best: AttackStructureTarget | null = null;
        let bestPriority = Number.POSITIVE_INFINITY;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const wall of wallColliders) {
          if (!wall.id) continue;
          if (!segmentIntersectsAABB(this.x, this.y, player.x, player.y, wall.x, wall.y, wall.hw, wall.hh)) continue;
          const structurePriority = wall.structureKind === 'offense' ? 2 : wall.structureKind === 'door' ? 3 : 4;
          if (structurePriority > bestPriority) continue;
          const dist = Math.hypot(wall.x - this.x, wall.y - this.y);
          if (structurePriority < bestPriority || dist < bestDist) {
            bestPriority = structurePriority;
            bestDist = dist;
            best = {
              id: wall.id,
              type: (wall.type as 'Wall' | 'Door') ?? 'Wall',
              x: wall.x,
              y: wall.y,
              hw: wall.hw,
              hh: wall.hh
            };
          }
        }
        if (best) {
          this.setAttackStructure(best);
          structureTarget = best;
          selectedPriority = bestPriority;
        }
      }
      if (structureTarget && hasLineOfSight) {
        this.clearAttackStructure();
        structureTarget = null;
        selectedPriority = null;
      }
    }

    const focusPoint = structureTarget ? this.nearestPointOnStructure(structureTarget) : { x: player.x, y: player.y };
    if (structureTarget && selectedPriority === null) {
      selectedPriority = structureTarget.type === 'Door' ? 3 : 4;
    }
    const focusDx = focusPoint.x - this.x;
    const focusDy = focusPoint.y - this.y;
    const focusDist = Math.hypot(focusDx, focusDy);

    const targetKind: 'player' | 'door' | 'wall' | 'offense' | 'none' = structureTarget
      ? (selectedPriority === 2 ? 'offense' : structureTarget.type === 'Door' ? 'door' : 'wall')
      : wantsAggro ? 'player' : 'none';

    this.debugInfo = {
      wantsAggro,
      hasLineOfSight,
      targetKind,
      targetId: structureTarget ? structureTarget.id : null,
      focusDistPx: focusDist,
      playerDistPx: dPlayer,
      playerIntercepts,
      noiseIntercepts,
      structurePriority: structureTarget ? selectedPriority : null
    };

    if (structureTarget) {
      this.state = focusDist <= attackRangePx ? 'attack' : 'chase';
    } else if (dPlayer <= attackRangePx) {
      this.state = 'attack';
    } else if (wantsAggro) {
      this.state = 'chase';
    } else {
      if (role !== 'solo') {
        this.state = 'roam';
        this.idleSecLeft = 0;
      } else if (this.idleSecLeft > 0) {
        this.state = 'idle';
      } else if (this.state !== 'roam' && this.state !== 'idle') {
        this.state = 'idle';
      }
    }

    if (this.state === 'attack') {
      if (steer) {
        const sepX = steer.sepX;
        const sepY = steer.sepY;
        const nx = focusDx / (focusDist || 1);
        const ny = focusDy / (focusDist || 1);
        const dot = sepX * nx + sepY * ny;
        const tx = sepX - dot * nx;
        const ty = sepY - dot * ny;
        const len = Math.hypot(tx, ty);
        if (len > 0.0001) {
          const speed = this.getSpeedPxPerSec('walk') * 0.5;
          const step = speed * dtSec;
          this.moveWithObstacles((tx / len) * step, (ty / len) * step, bounds, colliders);
        }
      }
      return;
    }

    if (this.state === 'chase') {
      let vx = 0;
      let vy = 0;
      let chaseX: number;
      let chaseY: number;
      if (structureTarget) {
        chaseX = focusPoint.x;
        chaseY = focusPoint.y;
      } else {
        chaseX = (steer && typeof steer.pursueX === 'number') ? steer.pursueX : player.x;
        chaseY = (steer && typeof steer.pursueY === 'number') ? steer.pursueY : player.y;
      }
      const dxt = chaseX - this.x;
      const dyt = chaseY - this.y;
      const dtg = Math.hypot(dxt, dyt) || 1;
      const nx = dxt / dtg;
      const ny = dyt / dtg;
      vx += nx;
      vy += ny;
      if (steer) {
        vx += steer.sepX;
        vy += steer.sepY;
        if (typeof steer.biasX === 'number') vx += steer.biasX;
        if (typeof steer.biasY === 'number') vy += steer.biasY;
        if (typeof steer.avoidX === 'number') vx += steer.avoidX;
        if (typeof steer.avoidY === 'number') vy += steer.avoidY;
      }
      const len = Math.hypot(vx, vy);
      if (len > 0.0001) {
        const speedMode: 'walk' | 'sprint' = structureTarget ? 'walk' : 'sprint';
        const speed = this.getSpeedPxPerSec(speedMode) * (structureTarget ? 1 : phaseScale);
        const step = speed * dtSec;
        this.moveWithObstacles((vx / len) * step, (vy / len) * step, bounds, colliders);
      }
      return;
    }

    const tile = this.tileSize;
    const idleCfg = steer?.idle ?? { idleMinSec: 3, idleMaxSec: 7, moveMinTiles: 8, moveMaxTiles: 16 };

    if (this.state === 'idle') {
      if (role !== 'solo') {
        this.state = 'roam';
        this.idleSecLeft = 0;
      } else {
        this.idleSecLeft -= dtSec;
        if (this.idleSecLeft <= 0) {
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

    this.roamTimer -= dtSec;
    if ((this.roamTimer <= 0 || !this.roamTarget) && this.state !== 'idle') {
      if (role === 'leader') {
        const minT = Math.max(1, Math.floor(idleCfg.moveMinTiles));
        const maxT = Math.max(minT, Math.floor(idleCfg.moveMaxTiles));
        const distTiles = minT + Math.random() * (maxT - minT);
        const dist = distTiles * tile;
        const ang2 = Math.random() * Math.PI * 2;
        this.roamTarget = { x: this.x + Math.cos(ang2) * dist, y: this.y + Math.sin(ang2) * dist };
        this.roamTimer = 2 + Math.random() * 2;
      } else if (role !== 'follower') {
        const roamR = 4 * tile;
        const ang2 = Math.random() * Math.PI * 2;
        const rad2 = Math.random() * roamR;
        this.roamTarget = { x: this.x + Math.cos(ang2) * rad2, y: this.y + Math.sin(ang2) * rad2 };
        this.roamTimer = 1 + Math.random() * 1.5;
      }
    }

    let vx = 0;
    let vy = 0;
    if (this.roamTarget && this.state !== 'idle') {
      const dx = this.roamTarget.x - this.x;
      const dy = this.roamTarget.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) {
        this.roamTarget = null;
        if (role === 'solo') {
          const iMin = Math.max(0, idleCfg.idleMinSec);
          const iMax = Math.max(iMin, idleCfg.idleMaxSec);
          this.idleSecLeft = iMin + Math.random() * (iMax - iMin);
          this.state = 'idle';
        } else {
          this.state = 'roam';
          this.roamTimer = 0;
        }
      } else {
        vx += dx / d;
        vy += dy / d;
      }
    }

    if (steer && typeof steer.pursueX === 'number' && typeof steer.pursueY === 'number' && this.state !== 'idle') {
      const dx = steer.pursueX - this.x;
      const dy = steer.pursueY - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-3) {
        const nx = dx / d;
        const ny = dy / d;
        vx += nx;
        vy += ny;
      }
    }

    if (steer) {
      vx += steer.sepX;
      vy += steer.sepY;
      if (typeof steer.biasX === 'number') vx += steer.biasX;
      if (typeof steer.biasY === 'number') vy += steer.biasY;
      if (typeof steer.avoidX === 'number') vx += steer.avoidX;
      if (typeof steer.avoidY === 'number') vy += steer.avoidY;
    }

    const len = Math.hypot(vx, vy);
    if (len > 0.0001) {
      const speed = this.getSpeedPxPerSec('walk');
      const step = speed * dtSec;
      this.moveWithObstacles((vx / len) * step, (vy / len) * step, bounds, colliders);
    }

    const r = this.collisionRadiusPx;
    this.x = Math.min(Math.max(this.x, r), bounds.w - r);
    this.y = Math.min(Math.max(this.y, r), bounds.h - r);
    if (colliders.length) this.resolvePenetration(colliders, bounds);
  }
  private nearestPointOnStructure(target: AttackStructureTarget): { x: number; y: number } {

    const px = Math.max(target.x - target.hw, Math.min(this.x, target.x + target.hw));

    const py = Math.max(target.y - target.hh, Math.min(this.y, target.y + target.hh));

    return { x: px, y: py };

  }



  private moveWithObstacles(

    dx: number,

    dy: number,

    bounds: { w: number; h: number },

    colliders?: ZombieCollider[]

  ): boolean {

    if (dx === 0 && dy === 0) return false;

    const r = this.collisionRadiusPx;

    const minX = r;

    const maxX = Math.max(r, bounds.w - r);

    const minY = r;

    const maxY = Math.max(r, bounds.h - r);

    const list = colliders ?? [];

    const tryMove = (nx: number, ny: number): boolean => {

      const clampedX = Math.min(Math.max(nx, minX), maxX);

      const clampedY = Math.min(Math.max(ny, minY), maxY);

      for (const c of list) {

        const nearestX = Math.max(c.x - c.hw, Math.min(clampedX, c.x + c.hw));

        const nearestY = Math.max(c.y - c.hh, Math.min(clampedY, c.y + c.hh));

        const diffX = clampedX - nearestX;

        const diffY = clampedY - nearestY;

        if (diffX * diffX + diffY * diffY < r * r) return false;

      }

      this.x = clampedX;

      this.y = clampedY;

      return true;

    };

    const originX = this.x;

    const originY = this.y;

    if (tryMove(originX + dx, originY + dy)) return true;

    if (dx !== 0 && tryMove(originX + dx, originY)) return true;

    if (dy !== 0 && tryMove(originX, originY + dy)) return true;

    if (dx !== 0 && dy !== 0) {

      if (tryMove(originX + dx, originY + dy * 0.25)) return true;

      if (tryMove(originX + dx * 0.25, originY + dy)) return true;

    }

    this.x = Math.min(Math.max(originX, minX), maxX);

    this.y = Math.min(Math.max(originY, minY), maxY);

    if (list.length) this.resolvePenetration(list, bounds);

    return false;

  }



  private resolvePenetration(

    colliders: ZombieCollider[],

    bounds: { w: number; h: number }

  ): void {

    if (!colliders.length) return;

    const r = this.collisionRadiusPx;

    let cx = this.x;

    let cy = this.y;

    let adjusted = false;

    for (const c of colliders) {

      const dxC = cx - c.x;

      const dyC = cy - c.y;

      const overlapX = (c.hw + r) - Math.abs(dxC);

      const overlapY = (c.hh + r) - Math.abs(dyC);

      if (overlapX > 0 && overlapY > 0) {

        if (overlapX < overlapY) {

          const dir = dxC >= 0 ? 1 : -1;

          cx += dir * (overlapX + 0.1);

        } else {

          const dir = dyC >= 0 ? 1 : -1;

          cy += dir * (overlapY + 0.1);

        }

        adjusted = true;

      }

    }

    if (adjusted) {

      const minX = r;

      const maxX = Math.max(r, bounds.w - r);

      const minY = r;

      const maxY = Math.max(r, bounds.h - r);

      this.x = Math.min(Math.max(cx, minX), maxX);

      this.y = Math.min(Math.max(cy, minY), maxY);

    }

  }




  public getHp(): number { return this.hp; }

  public getMaxHp(): number { return this.maxHp; }

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

  public resetHealth(): void {
    this.hp = this.maxHp;
  }

  public isDead(): boolean {
    return this.hp <= 0;
  }

  public getIdleSecLeft(): number { return Math.max(0, this.idleSecLeft); }

}





























