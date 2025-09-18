import { EventBus } from '@app/EventBus';
import { ConfigService } from '../data/ConfigService';
import { Walker } from '../entities/enemies/Walker';
import type { Zombie } from '../entities/enemies/Zombie';

export type TimePhase = 'day' | 'night' | 'eclipse';

export interface ZombieDamagedEvent {
  zombieId: string;
  amount: number;
  remainingHp: number;
  killed: boolean;
  x: number;
  y: number;
}

export interface ZombieKilledEvent {
  zombieId: string;
  kind: string;
  x: number;
  y: number;
}

export class ZombieSystem {
  private readonly bus: EventBus;
  private readonly cfg: ConfigService;
  private readonly zombies: Zombie[] = [];
  private readonly detectScale: { day: number; night: number; eclipse: number };
  private worldW = 0;
  private worldH = 0;
  private clusterTimer = 0;
  private hordeMap: Map<string, { size: number; leaderId: string } > = new Map();
  private wobble: Map<string, { rand: number; freq: number; phase: number }> = new Map();
  private lastDetectRads: number[] = [];
  private effectiveHorde: Map<string, { inHorde: boolean; isLeader: boolean; size: number }> = new Map();

  constructor(bus: EventBus, cfg: ConfigService, worldW: number, worldH: number) {
    this.bus = bus;
    this.cfg = cfg;
    this.worldW = worldW;
    this.worldH = worldH;
    const globals = (this.cfg.getEnemies() as any).globals ?? {};
    this.detectScale = (globals.detectScaleByPhase ?? { day: 1, night: 1, eclipse: 1 }) as any;
  }

  public spawnWalkersCluster(count: number, cx: number, cy: number, spreadPx: number = this.cfg.getGame().tileSize * 0.5): void {
    const base = (this.cfg.getEnemies() as any).BaseZombie ?? {
      walkTiles: 2.0,
      sprintTiles: 3.5,
      hp: 50,
      detectRadiusTiles: 8,
      attackPower: 6,
      attackIntervalSec: 1.2,
      attackRangeTiles: 0.7
    };
    const tile = this.cfg.getGame().tileSize;
    for (let i = 0; i < count; i += 1) {
      const z = new Walker(`walker-${this.zombies.length}-${Date.now()}`, tile, base);
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * spreadPx;
      z.x = Math.min(Math.max(cx + Math.cos(ang) * rad, tile * 0.5), this.worldW - tile * 0.5);
      z.y = Math.min(Math.max(cy + Math.sin(ang) * rad, tile * 0.5), this.worldH - tile * 0.5);
      this.zombies.push(z);
    }
  }

  public spawnWalkers(count: number, avoid?: { x: number; y: number; rPx: number }): void {
    const base = (this.cfg.getEnemies() as any).BaseZombie ?? {
      walkTiles: 2.0,
      sprintTiles: 3.5,
      hp: 50,
      detectRadiusTiles: 8,
      attackPower: 6,
      attackIntervalSec: 1.2,
      attackRangeTiles: 0.7
    };
    const tile = this.cfg.getGame().tileSize;
    for (let i = 0; i < count; i += 1) {
      const z = new Walker(`walker-${i}-${Date.now()}`, tile, base);
      // place at random off-start location with 64 attempts
      let placed = false;
      for (let attempt = 0; attempt < 64 && !placed; attempt += 1) {
        const x = Math.random() * this.worldW;
        const y = Math.random() * this.worldH;
        if (avoid) {
          const dx = x - avoid.x;
          const dy = y - avoid.y;
          if (dx * dx + dy * dy < avoid.rPx * avoid.rPx) continue;
        }
        z.x = x; z.y = y;
        placed = true;
      }
      if (!placed) { z.x = this.worldW * 0.8; z.y = this.worldH * 0.8; }
      this.zombies.push(z);
    }
  }

  public update(
    dtSec: number,
    player: { x: number; y: number },
    phase: TimePhase,
    detectCtx: { noiseRadiusPx: number; playerRadiusPx: number; disableChase?: boolean },
    obstacles?: Array<{ x: number; y: number; hw: number; hh: number; kind?: 'wall' | 'node'; id?: string; type?: 'Wall' | 'Door' }>
  ): void {
    const scale = phase === 'eclipse' ? this.detectScale.eclipse : phase === 'night' ? this.detectScale.night : this.detectScale.day;
    const tile = this.cfg.getGame().tileSize;
    const horde = ((this.cfg.getEnemies() as any).globals?.horde ?? {}) as any;
    const sepTiles = Number(horde.separationTiles ?? 2.0);
    const sepWeight = Number(horde.separationWeight ?? 0.6);
    const sepR = sepTiles * tile;
    const speedBase = Number(horde.speedFactor ?? 0.85);
    const clusterInterval = Number(horde.clusterIntervalSec ?? 0.25);
    const formRadius = Number(horde.formationRadiusTiles ?? 1.5) * tile;
    const wob = (horde.wobble ?? { ampFrac: 0.15, randMin: 0.5, randMax: 1.5, freqMin: 0.5, freqMax: 1.5 }) as any;
    const idleModel = (((this.cfg.getEnemies() as any).globals?.idleModel) ?? {}) as any;
    const phaseKey = phase === 'eclipse' ? 'eclipse' : phase === 'night' ? 'night' : 'day';
    const idlePhaseCfg = idleModel[phaseKey] ?? { idleMinSec: 3, idleMaxSec: 7, soloMoveMinTiles: 8, soloMoveMaxTiles: 16, leaderMoveMinTiles: 40, leaderMoveMaxTiles: 60 };

    const colliders = obstacles ?? [];
    const avoidPadding = tile * 0.6;

    // Current detect radius per zombie (for overlap-based horde grouping)
    const detectRads = this.zombies.map((z: any) => (z.stats.detectRadiusTiles ?? 0) * tile * scale);
    this.lastDetectRads = detectRads;

    // Cluster recompute timer
    this.clusterTimer -= dtSec;
    if (this.clusterTimer <= 0) {
      this.clusterTimer = clusterInterval;
      this.recomputeHordes(detectRads); // groups where detect circles overlap
    }

    // Precompute separation vectors per zombie (O(n^2) small n ok)
    const sepVec: Array<{ x: number; y: number }> = this.zombies.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < this.zombies.length; i += 1) {
      const a = this.zombies[i] as any;
      for (let j = i + 1; j < this.zombies.length; j += 1) {
        const b = this.zombies[j] as any;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < sepR) {
          const push = (sepR - d) / sepR; // 0..1
          const nx = dx / d;
          const ny = dy / d;
          sepVec[i].x += nx * push;
          sepVec[i].y += ny * push;
          sepVec[j].x -= nx * push;
          sepVec[j].y -= ny * push;
        }
      }
    }
    // Scale separation by weight
    for (let i = 0; i < sepVec.length; i += 1) {
      sepVec[i].x *= sepWeight;
      sepVec[i].y *= sepWeight;
    }

    // Update with steering: approach player directly; separation will keep spacing
    this.effectiveHorde.clear();
    for (let i = 0; i < this.zombies.length; i += 1) {
      const z = this.zombies[i] as any;
      const s = z.stats as any;
      const desiredDistPx = Number(s.attackRangeTiles ?? 0.7) * tile;
      // Horde membership affects speed and follower formation
      const h = this.hordeMap.get(z.id);
      const size = h?.size ?? 0;
      const leaderId = h?.leaderId ?? '';
      const inHorde = size >= 3;
      const isLeader = inHorde && z.id === leaderId;
      // Determine if this zombie detects the player (to act individually in CHASE/ATTACK)
      const dxp = player.x - z.x;
      const dyp = player.y - z.y;
      const dPlayer = Math.hypot(dxp, dyp);
      const playerR = detectCtx.playerRadiusPx;
      const noiseR = detectCtx.noiseRadiusPx;
      const detectsPlayer = !detectCtx.disableChase && ((dPlayer <= detectRads[i] + playerR) || (noiseR > 0 && dPlayer <= detectRads[i] + noiseR));
      const inAttack = dPlayer <= desiredDistPx; // use attack range for stop
      const isChasing = detectsPlayer && !inAttack;

      // Check if follower still detects the leader; if not, it should roam (break off)
      let seesLeader = true;
      if (inHorde && !isLeader) {
        const leader = this.zombies.find((zz: any) => zz.id === leaderId) as any;
        if (leader) {
          const dxL = leader.x - z.x;
          const dyL = leader.y - z.y;
          const dL = Math.hypot(dxL, dyL);
          seesLeader = dL <= detectRads[i];
        }
      }
      const effectiveInHorde = inHorde && (isLeader || seesLeader);
      // progressive speed penalty applies only while in effective horde behavior (not chasing)
      const speedFactor = effectiveInHorde && !isChasing ? Math.max(0.4, Math.pow(speedBase, Math.max(0, size - 1))) : 1.0;
      z.setSpeedFactor(speedFactor);

      let avoidX = 0;
      let avoidY = 0;
      if (colliders.length) {
        const radius = typeof (z as any).getCollisionRadius === 'function' ? (z as any).getCollisionRadius() : tile * 0.3;
        const avoidRange = radius + avoidPadding;
        for (const ob of colliders) {
          const dxC = z.x - ob.x;
          const dyC = z.y - ob.y;
          const overlapX = (ob.hw + radius) - Math.abs(dxC);
          const overlapY = (ob.hh + radius) - Math.abs(dyC);
          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
              const dir = dxC >= 0 ? 1 : -1;
              avoidX += dir * (overlapX / Math.max(radius, 1e-3));
            } else {
              const dir = dyC >= 0 ? 1 : -1;
              avoidY += dir * (overlapY / Math.max(radius, 1e-3));
            }
            continue;
          }
          const nearestX = Math.max(ob.x - ob.hw, Math.min(z.x, ob.x + ob.hw));
          const nearestY = Math.max(ob.y - ob.hh, Math.min(z.y, ob.y + ob.hh));
          const diffX = z.x - nearestX;
          const diffY = z.y - nearestY;
          const dist = Math.hypot(diffX, diffY);
          if (dist < avoidRange && dist > 1e-5) {
            const strength = (avoidRange - dist) / avoidRange;
            avoidX += (diffX / dist) * strength;
            avoidY += (diffY / dist) * strength;
          }
        }
        const avoidMag = Math.hypot(avoidX, avoidY);
        if (avoidMag > 1.5) {
          const scale = 1.5 / avoidMag;
          avoidX *= scale;
          avoidY *= scale;
        }
      }
      let biasX = 0, biasY = 0;
      let pursueX: number | undefined;
      let pursueY: number | undefined;
      if (effectiveInHorde && !isLeader && !isChasing) {
        // Follow leader with a flexible formation target and local avoidance
        const leader = this.zombies.find((zz: any) => zz.id === leaderId) as any;
        if (leader) {
          // Leader heading toward player
          const lx = leader.x, ly = leader.y;
          const dxL = player.x - lx;
          const dyL = player.y - ly;
          const dL = Math.hypot(dxL, dyL) || 1;
          const ux = dxL / dL; // unit toward player (leader direction)
          const uy = dyL / dL;
          const px = -uy; // perpendicular (left)
          const py = ux;  // perpendicular (left)

          // Persistent follower slot around the leader
          const key = leader.id + ':' + z.id;
          const rJit = this.randRange((horde.radiusJitter?.min ?? 0.85), (horde.radiusJitter?.max ?? 1.25), key + '#r');
          const side = this.hash(key + '#s') & 1 ? 1 : -1; // left/right
          const back = this.randRange(0.3, 0.8, key + '#b'); // behind leader fraction of formation radius
          const lateral = this.randRange(0.6, 1.2, key + '#l') * side;
          const radius = formRadius * rJit;

          const targetX = lx - ux * (radius * back) + px * (radius * lateral);
          const targetY = ly - uy * (radius * back) + py * (radius * lateral);

          // Set pursuit target to the follower's slot around the leader
          // Small bias still added below for wobble
          pursueX = targetX;
          pursueY = targetY;

          // Small unsynchronized wobble along perpendicular to avoid same-path feel
          let wb = this.wobble.get(z.id);
          if (!wb) {
            const rand = this.randRange(wob.randMin ?? 0.5, wob.randMax ?? 1.5, z.id);
            const freq = this.randRange(wob.freqMin ?? 0.5, wob.freqMax ?? 1.5, z.id + '#f');
            wb = { rand, freq, phase: Math.random() * Math.PI * 2 };
            this.wobble.set(z.id, wb);
          }
          wb.phase += dtSec * wb.freq;
          const mag = (wob.ampFrac ?? 0.15) * Math.sin(wb.phase) * (wb.rand || 1);
          biasX += px * mag;
          biasY += py * mag;
        }
      }

      // record effective horde status for debug queries
      this.effectiveHorde.set(z.id, { inHorde: effectiveInHorde, isLeader: isLeader && effectiveInHorde, size });

      const forceChase = false; // in clarified design, horde members do not force chase; they act as individuals when chasing
      // Idle scheduling inputs depend on role and phase
      let idleMinSec = Number(idlePhaseCfg.idleMinSec ?? 3);
      let idleMaxSec = Number(idlePhaseCfg.idleMaxSec ?? 7);
      let moveMinTiles = Number(idlePhaseCfg.soloMoveMinTiles ?? 8);
      let moveMaxTiles = Number(idlePhaseCfg.soloMoveMaxTiles ?? 16);
      let role: 'solo' | 'leader' | 'follower' = 'solo';
      if (effectiveInHorde) {
        if (isLeader) {
          role = 'leader';
          // Leaders move further and rest less
          idleMinSec *= 0.6; idleMaxSec *= 0.8;
          moveMinTiles = Number(idlePhaseCfg.leaderMoveMinTiles ?? moveMinTiles);
          moveMaxTiles = Number(idlePhaseCfg.leaderMoveMaxTiles ?? moveMaxTiles);
        } else {
          role = 'follower';
          // Followers rest similar to solo; movement is toward leader slot
        }
      }
      z.updateAI(dtSec, player, scale, { w: this.worldW, h: this.worldH }, detectCtx, {
        sepX: sepVec[i].x,
        sepY: sepVec[i].y,
        desiredDistPx,
        biasX,
        biasY,
        avoidX,
        avoidY,
        colliders,
        pursueX,
        pursueY,
        forceChase,
        role,
        idle: { idleMinSec, idleMaxSec, moveMinTiles, moveMaxTiles }
      });
    }
  }

  private recomputeHordes(detectRads: number[]): void {
    this.hordeMap.clear();
    const n = this.zombies.length;
    const visited = new Array<boolean>(n).fill(false);
    const groups: number[][] = [];
    for (let i = 0; i < n; i += 1) {
      if (visited[i]) continue;
      // BFS/DFS to find connected zombies within clusterDistPx
      const stack = [i];
      visited[i] = true;
      const group: number[] = [];
      while (stack.length) {
        const a = stack.pop()!;
        group.push(a);
        const za = this.zombies[a] as any;
        for (let b = 0; b < n; b += 1) {
          if (visited[b]) continue;
          const zb = this.zombies[b] as any;
          const dx = za.x - zb.x;
          const dy = za.y - zb.y;
          const sumR = detectRads[a] + detectRads[b];
          if (dx * dx + dy * dy <= sumR * sumR) {
            visited[b] = true;
            stack.push(b);
          }
        }
      }
      if (group.length >= 3) groups.push(group);
    }
    for (const g of groups) {
      // Leader: highest attack power, ties by deterministic hash
      let leaderIdx = g[0];
      let bestPwr = (this.zombies[leaderIdx] as any).stats.attackPower ?? 0;
      for (let k = 1; k < g.length; k += 1) {
        const idx = g[k];
        const pwr = (this.zombies[idx] as any).stats.attackPower ?? 0;
        if (pwr > bestPwr) { bestPwr = pwr; leaderIdx = idx; }
        else if (pwr === bestPwr) {
          if (this.hash(this.zombies[idx].id) < this.hash(this.zombies[leaderIdx].id)) leaderIdx = idx;
        }
      }
      const leaderId = this.zombies[leaderIdx].id;
      for (const idx of g) this.hordeMap.set(this.zombies[idx].id, { size: g.length, leaderId });
    }
  }

  private hash(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
    return h >>> 0;
  }

  private randRange(min: number, max: number, seedKey: string): number {
    const s = (this.hash(seedKey) % 100000) / 100000;
    return min + (max - min) * s;
  }

  // hashSign removed (no orbit swirl)

  private removeZombieInstance(zombie: Zombie): void {
    const idx = this.zombies.indexOf(zombie);
    if (idx !== -1) {
      this.zombies.splice(idx, 1);
    }
    this.lastDetectRads = [];
    this.hordeMap.delete(zombie.id);
    this.wobble.delete(zombie.id);
    this.effectiveHorde.delete(zombie.id);
    this.clusterTimer = 0;
  }

  private handleZombieDeath(zombie: Zombie): void {
    this.bus.emit<ZombieKilledEvent>('ZombieKilled', {
      zombieId: zombie.id,
      kind: zombie.kind,
      x: zombie.x,
      y: zombie.y
    });
    this.removeZombieInstance(zombie);
  }

  public getZombies(): readonly Zombie[] { return this.zombies; }

  public damageZombie(id: string, amount: number): { dealt: number; killed: boolean } {
    if (amount <= 0) return { dealt: 0, killed: false };
    const zombie = this.zombies.find((z) => z.id === id);
    if (!zombie) return { dealt: 0, killed: false };
    const dealt = zombie.applyDamage(amount);
    if (dealt <= 0) return { dealt, killed: false };
    const remainingHp = zombie.getHp();
    const killed = zombie.isDead();
    this.bus.emit<ZombieDamagedEvent>('ZombieDamaged', {
      zombieId: zombie.id,
      amount: dealt,
      remainingHp,
      killed,
      x: zombie.x,
      y: zombie.y
    });
    if (killed) this.handleZombieDeath(zombie);
    return { dealt, killed };
  }

  public healZombie(id: string, amount?: number): number {
    const zombie = this.zombies.find((z) => z.id === id);
    if (!zombie) return 0;
    if (amount == null) {
      const missing = zombie.getMaxHp() - zombie.getHp();
      if (missing <= 0) return 0;
      zombie.resetHealth();
      return missing;
    }
    if (amount <= 0) return 0;
    return zombie.heal(amount);
  }

  public damageAllZombies(amount: number): { totalDealt: number; killed: number } {
    let totalDealt = 0;
    let killed = 0;
    if (amount <= 0) return { totalDealt, killed };
    for (const zombie of [...this.zombies]) {
      const dealt = zombie.applyDamage(amount);
      if (dealt <= 0) continue;
      totalDealt += dealt;
      const remainingHp = zombie.getHp();
      const killedThis = zombie.isDead();
      this.bus.emit<ZombieDamagedEvent>('ZombieDamaged', {
        zombieId: zombie.id,
        amount: dealt,
        remainingHp,
        killed: killedThis,
        x: zombie.x,
        y: zombie.y
      });
      if (killedThis) {
        this.handleZombieDeath(zombie);
        killed += 1;
      }
    }
    return { totalDealt, killed };
  }

  public healAllZombies(): void {
    for (const zombie of this.zombies) {
      zombie.resetHealth();
    }
  }

  public getHordeStatus(id: string): { inHorde: boolean; isLeader: boolean; size: number } {
    const eff = this.effectiveHorde.get(id);
    if (eff) return eff;
    const h = this.hordeMap.get(id);
    if (!h) return { inHorde: false, isLeader: false, size: 0 };
    return { inHorde: h.size >= 3, isLeader: h.leaderId === id, size: h.size };
  }

  public getHordeLeaderId(id: string): string | null {
    const h = this.hordeMap.get(id);
    if (!h || h.size < 3) return null;
    return h.leaderId;
  }

  public getFollowerTarget(id: string, player: { x: number; y: number }): { x: number; y: number } | null {
    const leaderId = this.getHordeLeaderId(id);
    if (!leaderId || leaderId === id) return null;
    const leader = (this.zombies as any).find((z: any) => z.id === leaderId);
    const follower = (this.zombies as any).find((z: any) => z.id === id);
    if (!leader || !follower) return null;
    const tile = this.cfg.getGame().tileSize;
    const horde = ((this.cfg.getEnemies() as any).globals?.horde ?? {}) as any;
    const formRadius = Number(horde.formationRadiusTiles ?? 1.5) * tile;
    // Same math as in update loop
    const lx = leader.x, ly = leader.y;
    const dxL = player.x - lx;
    const dyL = player.y - ly;
    const dL = Math.hypot(dxL, dyL) || 1;
    const ux = dxL / dL; const uy = dyL / dL;
    const px = -uy; const py = ux;
    const key = leader.id + ':' + id;
    const rJit = this.randRange((horde.radiusJitter?.min ?? 0.85), (horde.radiusJitter?.max ?? 1.25), key + '#r');
    const side = this.hash(key + '#s') & 1 ? 1 : -1;
    const back = this.randRange(0.3, 0.8, key + '#b');
    const lateral = this.randRange(0.6, 1.2, key + '#l') * side;
    const radius = formRadius * rJit;
    const targetX = lx - ux * (radius * back) + px * (radius * lateral);
    const targetY = ly - uy * (radius * back) + py * (radius * lateral);
    return { x: targetX, y: targetY };
  }
}
