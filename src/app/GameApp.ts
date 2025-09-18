import { IEngineAdapter } from './EngineAdapter';
import { EventBus } from './EventBus';
import { FixedStepLoop } from './FixedStepLoop';
import { ConfigService } from '@core/data/ConfigService';
import { DebugOverlay } from '@ui/DebugOverlay';
import { InputController } from '@engine/input/InputController';
import { Player } from '@core/entities/Player';
import { TimeSystem } from '@core/systems/TimeSystem';
import { HUD } from '@ui/HUD';
import { DebugMenu } from '@ui/DebugMenu';
import { NodePanel } from '@ui/NodePanel';
import { ResourceSystem } from '@core/systems/ResourceSystem';
import { CombatSystem, PlayerDamagedEvent, PlayerDiedEvent, StructureDamagedEvent, StructureDestroyedEvent } from '@core/systems/CombatSystem';
import { ResourceNode } from '@core/entities/ResourceNode';
import { InventorySystem } from '@core/systems/InventorySystem';
import { SpawnSystem } from '@core/systems/SpawnSystem';
import { StorageCrate } from '@core/entities/world/StorageCrate';
import { Wall } from '@core/entities/world/Wall';
import { NoiseSystem } from '@core/systems/NoiseSystem';
import { ZombieSystem } from '@core/systems/ZombieSystem';
import type { Zombie } from '@core/entities/enemies/Zombie';
import { ZombieInfoPanel } from '@ui/ZombieInfoPanel';
import { GameOverOverlay } from '@ui/GameOverOverlay';
// Zombie system removed for refactor: all references stripped

type DamageIndicator = {
  id: number;
  amount: number;
  age: number;
  lifetime: number;
  risePx: number;
  offsetXPx: number;
};

/**
 * Responsibility: Bootstrap engine, load config, and run fixed-step loop.
 * Publishes: none (future: Tick, FrameRendered)
 * Subscribes: none
 * Config: game.tileSize, game.loop.tickHz, game.render.playerRadiusTiles
 * Notes: Core loop is engine-agnostic; adapter handles drawing.
 */
export class GameApp {
  private readonly engine: IEngineAdapter;
  private readonly bus: EventBus;
  private readonly cfg: ConfigService;
  private readonly container: HTMLElement;
  private readonly overlay: DebugOverlay;
  private loop?: FixedStepLoop;
  private stepSec = 1 / 60;
  private input = new InputController();
  private inputAttached = false;
  private player!: Player;
  private time!: TimeSystem;
  private hud!: HUD;
  private resources!: ResourceSystem;
  private spawner!: SpawnSystem;
  private selectedNodeId: string | null = null;
  private nodePanel?: NodePanel;
  private inventory!: InventorySystem;
  private harvest = { active: false, progressSec: 0, nodeId: null as string | null };
  private uiNoise = 0;
  private worldW = 0;
  private worldH = 0;
  private lastPhase: ReturnType<TimeSystem['getPhase']> | null = null;
  private lastSpawnDay: number | null = null;
  private hintTimer = 0;
  private storageCrates: StorageCrate[] = [];
  private storedTotals: Record<string, number> = {};
  private walls: import('@core/entities/world/Wall').Wall[] = [];
  private selectedWallId: string | null = null;
  private showColliders = false;
  private showNoSpawnRadius = false;
  private showMinSeparation = false;
  private showNoiseCircle = false;
  private showZombieDetect = false;
  private showZombieStates = true;
  private showFlockingVectors = false;
  private showHordeDebug = false;
  private disableZombieChase = false;
  private showSeparation = false;
  private showZombieTargets = false;
  private showZombieAggro = false;
  private debugMenu!: DebugMenu;
  private startX = 0;
  private startY = 0;
  private currentZoom = 1;
  private noise!: NoiseSystem;
  private zombies!: ZombieSystem;
  private selectedZombieId: string | null = null;
  private zombieInfo!: ZombieInfoPanel;
  private combat!: CombatSystem;
  private gameOverOverlay!: GameOverOverlay;
  private gameOver = false;
  private damageIndicators: DamageIndicator[] = [];
  private damageIdSeq = 0;

  constructor(engine: IEngineAdapter, bus: EventBus, cfg: ConfigService, container: HTMLElement) {
    this.engine = engine;
    this.bus = bus;
    this.cfg = cfg;
    this.container = container;
    this.overlay = new DebugOverlay(container);
  }

  public async start(): Promise<void> {
    this.engine.init(this.container);
    const base = import.meta.env.BASE_URL;
    const game = this.cfg.getGame();
    const tickHz = (game as any).loop?.tickHz ?? 60;
    this.stepSec = 1 / tickHz;
    this.loop = new FixedStepLoop(this.stepSec, () => this.update());
    // center player
    const rect = this.container.getBoundingClientRect();
    const tileSize = game.tileSize;
    // world size from config or fallback to viewport size
    const worldTilesW = (game as any).world?.widthTiles ?? Math.floor(rect.width / tileSize);
    const worldTilesH = (game as any).world?.heightTiles ?? Math.floor(rect.height / tileSize);
    const worldW = worldTilesW * tileSize;
    const worldH = worldTilesH * tileSize;
    this.worldW = worldW; this.worldH = worldH;
    this.player = new Player('player', this.cfg, this.input);
    this.player.x = worldW / 2;
    this.player.y = worldH / 2;
    this.startX = this.player.x;
    this.startY = this.player.y;
    this.engine.setWorldSize(worldW, worldH);
    // Set camera zoom from config
    const zoom = Number(((this.cfg.getGame() as any).render?.zoom ?? 1));
    this.currentZoom = Math.min(2.0, Math.max(1.0, isNaN(zoom) ? 1 : zoom));
    if ('setZoom' in this.engine) (this.engine as any).setZoom(this.currentZoom);
    this.input.attach(window);
    this.inputAttached = true;
    window.addEventListener('keydown', this.onZoomKey);
    // Initialize NoiseSystem
    {
      const ncfg = (this.cfg.getGame() as any).noise ?? {};
      const movement = ncfg.movement ?? { walkTiles: 4, crouchTiles: 2, sprintTiles: 7 };
      const rampTilesPerSec = Number(ncfg.rampTilesPerSec ?? 6);
      const decayTilesPerSec = Number(ncfg.decayTilesPerSec ?? 5);
      const harvestTilesPerNoise = Number(ncfg.harvestTilesPerNoise ?? 8);
      const harvestScalePerSec = Number(ncfg.harvestScalePerSec ?? 0.15);
      const tileSizeInit = this.cfg.getGame().tileSize;
      this.noise = new NoiseSystem({
        walkTiles: Number(movement.walkTiles ?? 4),
        crouchTiles: Number(movement.crouchTiles ?? 2),
        sprintTiles: Number(movement.sprintTiles ?? 7),
        rampTilesPerSec,
        decayTilesPerSec,
        harvestTilesPerNoise,
        harvestScalePerSec,
        tileSize: tileSizeInit
      });
    }
    // Resources, Spawns, Enemies
    await this.cfg.loadResourcesConfigBrowser(`${base}config/resources.json5`);
    await this.cfg.loadSpawnConfigBrowser(`${base}config/spawn.json5`);
    await this.cfg.loadEnemiesConfigBrowser(`${base}config/enemies.json5`);
    this.resources = new ResourceSystem(this.bus, this.cfg);
    this.spawner = new SpawnSystem(this.bus, this.cfg);
    this.spawner.setConfig(this.cfg.getSpawn());
    // Spawn storage crates near center/player
    const storageCount = this.spawner.getStorageCount();
    for (let i = 0; i < storageCount; i += 1) {
      const crate = new StorageCrate(`storage-${i}`, this.cfg.getGame().tileSize);
      // place centered on tiles near player center
      const tile = this.cfg.getGame().tileSize;
      const cx = Math.round(this.player.x / tile);
      const cy = Math.round(this.player.y / tile);
      crate.x = (cx + i) * tile + tile * 0.5;
      crate.y = cy * tile + tile * 0.5;
      this.storageCrates.push(crate);
    }
    // initialize stored totals keys
    for (const k of Object.keys(this.cfg.getResources().weights)) this.storedTotals[k] = 0;

    // Load buildables and spawn a 9x9 perimeter of walls with one door
    await this.cfg.loadBuildablesConfigBrowser(`${base}config/buildables.json5`);
    const fort = (this.cfg.getBuildables() as any).fort;
    const tile = this.cfg.getGame().tileSize;
    const sizeTiles = 9;
    const half = Math.floor(sizeTiles / 2);
    const centerX = Math.round(this.player.x / tile);
    const centerY = Math.round(this.player.y / tile);
    const doorSide: 'north' | 'south' | 'east' | 'west' = 'east';
    const salvagePct = Number(((this.cfg.getBuildables() as any).globals?.salvageRefundPct ?? 50) / 100);
    const mkSalv = (cost: Record<string, number>) => {
      const o: Record<string, number> = {};
      for (const [k, v] of Object.entries(cost)) o[k] = Math.floor(v * salvagePct);
      return o;
    };
    const walls: Wall[] = [];
    for (let tx = centerX - half; tx <= centerX + half; tx += 1) {
      for (let ty = centerY - half; ty <= centerY + half; ty += 1) {
        const onEdge = tx === centerX - half || tx === centerX + half || ty === centerY - half || ty === centerY + half;
        if (!onEdge) continue;
        // Door placement on east edge middle
        const isDoor = doorSide === 'east' && tx === centerX + half && ty === centerY;
        const def = isDoor ? fort.Door : fort.Wall;
        const w = new Wall(`w-${tx}-${ty}`, isDoor ? 'Door' : 'Wall', tile, def.hp, def.cost);
        w.x = (tx + 0.5) * tile;
        w.y = (ty + 0.5) * tile;
        w.playerBuilt = true;
        walls.push(w);
      }
    }
    this.walls = walls;
    // Zombies: spawn initial walkers
    this.zombies = new ZombieSystem(this.bus, this.cfg, this.worldW, this.worldH);
    const avoidStart = Number((this.cfg.getSpawn() as any).noSpawnRadiusTilesAroundStart ?? 0) * this.cfg.getGame().tileSize;
    const initialWalkers = Number(((this.cfg.getEnemies() as any).Walker?.initialCount ?? 8));
    this.zombies.spawnWalkers(initialWalkers, { x: this.player.x, y: this.player.y, rPx: avoidStart });
    this.combat = new CombatSystem(this.bus, this.cfg.getGame().tileSize);
    this.bus.on<PlayerDamagedEvent>('PlayerDamaged', this.onPlayerDamaged);
    this.bus.on<PlayerDiedEvent>('PlayerDied', this.onPlayerDied);
    this.bus.on<StructureDamagedEvent>('StructureDamaged', this.onStructureDamaged);
    this.bus.on<StructureDestroyedEvent>('StructureDestroyed', this.onStructureDestroyed);
    // Initial spawn on Day 1 across full world (after structures exist), with constraints
    const initialPlanned = this.spawner.planCountsAll();
    const colls: Array<{ x: number; y: number; hw: number; hh: number }> = [];
    for (const w of this.walls) colls.push({ x: w.x, y: w.y, hw: w.widthPx / 2, hh: w.heightPx / 2 });
    for (const s of this.storageCrates) colls.push({ x: s.x, y: s.y, hw: s.sizePx / 2, hh: s.sizePx / 2 });
    const avoid = {
      x: this.player.x,
      y: this.player.y,
      radiusPx: Number((this.cfg.getSpawn() as any).noSpawnRadiusTilesAroundStart ?? 0) * this.cfg.getGame().tileSize
    };
    const minSepPx = Number((this.cfg.getSpawn() as any).minSeparationTiles ?? 0) * this.cfg.getGame().tileSize;
    const initialNodes = this.spawner.buildFromCountsWithConstraints(initialPlanned, this.worldW, this.worldH, {
      colliders: colls,
      avoid,
      minSeparationPx: minSepPx
    });
    for (const n of initialNodes) this.resources.addNode(n);
    this.lastSpawnDay = 1;
    // mouse selection
    const canvasEl = this.container.querySelector('canvas') as HTMLCanvasElement | null;
    canvasEl?.addEventListener('click', (e) => {
      const rect2 = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = e.clientX - rect2.left;
      const sy = e.clientY - rect2.top;
      const world = this.engine.screenToWorld(sx, sy);
      // Check zombies first
      const zs = this.zombies?.getZombies?.() ?? [];
      let pickedZ: Zombie | null = null;
      let bestZd2 = Number.POSITIVE_INFINITY;
      for (const z of zs as any) {
        const dx = z.x - world.x;
        const dy = z.y - world.y;
        const d2 = dx * dx + dy * dy;
        const r = this.cfg.getGame().tileSize * 0.3; // selection radius ~ 0.3 tiles
        if (d2 <= r * r && d2 < bestZd2) { bestZd2 = d2; pickedZ = z as Zombie; }
      }
      if (pickedZ) {
        this.selectedZombieId = (pickedZ as any).id;
        this.selectedNodeId = null;
        this.selectedWallId = null;
        this.nodePanel?.setNode(null);
        this.updateZombieInfoPanel();
        return;
      }
      // Check walls first
      let wallPicked: import('@core/entities/world/Wall').Wall | null = null;
      for (const w of this.walls) {
        if (w.containsPoint(world.x, world.y)) { wallPicked = w; break; }
      }
      if (wallPicked) {
        this.selectedWallId = wallPicked.id;
        this.selectedNodeId = null;
        const b = this.cfg.getBuildables() as any;
        const salvagePct = Number((b.globals?.salvageRefundPct ?? 50) / 100);
        const cost = wallPicked.cost;
        const salv: Record<string, number> = {};
        for (const [k, v] of Object.entries(cost)) salv[k] = Math.floor(v * salvagePct);
        this.nodePanel?.setWall(wallPicked, salv);
        return;
      }
      // then nodes
      const nodes = this.resources.getNodes();
      let picked: ResourceNode | null = null;
      let bestD2 = Number.POSITIVE_INFINITY;
      for (const n of nodes) {
        const dx = n.x - world.x;
        const dy = n.y - world.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          picked = n;
        }
      }
      if (picked && bestD2 <= picked.radiusPx * picked.radiusPx) {
        this.selectedNodeId = picked.id;
        this.selectedWallId = null;
        this.nodePanel?.setNode(picked);
      }
    });
    // Clear selection when node is depleted and removed
    this.bus.on<{ id: string }>('NodeDepleted', ({ id }) => {
      if (this.selectedNodeId === id) {
        this.selectedNodeId = null;
        this.nodePanel?.setNode(null);
      }
    });
    // Time system
    this.time = new TimeSystem({
      daySec: game.dayNight.daySec,
      nightSec: game.dayNight.nightSec,
      eclipseSec: game.dayNight.eclipseSec,
      eclipseEvery: game.dayNight.eclipseEvery
    });
    this.hud = new HUD(this.container);
    this.gameOverOverlay = new GameOverOverlay(this.container, this.resetRun);
    this.hud.setPlayerHealth(this.player.getHp(), this.player.getMaxHp());
    this.debugMenu = new DebugMenu(this.container);
    this.debugMenu.setOnChange((opts) => {
      this.showColliders = opts.showColliders;
      this.showNoSpawnRadius = opts.showNoSpawnRadius;
      this.showMinSeparation = opts.showMinSeparation;
      this.showNoiseCircle = opts.showNoise;
      this.showZombieDetect = opts.showZombieDetect;
      this.showZombieStates = opts.showZombieStates;
      this.showHordeDebug = opts.showHordeDebug;
      this.disableZombieChase = opts.disableChase;
      this.showZombieTargets = opts.showZombieTargets;
      this.showZombieAggro = opts.showZombieAggro;
    });
    this.debugMenu.setShowColliders(this.showColliders);
    this.debugMenu.setShowNoSpawnRadius(this.showNoSpawnRadius);
    this.debugMenu.setShowMinSeparation(this.showMinSeparation);
    this.debugMenu.setShowNoise(this.showNoiseCircle);
    this.debugMenu.setShowZombieDetect(this.showZombieDetect);
    this.debugMenu.setShowZombieStates(this.showZombieStates);
    this.debugMenu.setShowZombieTargets(this.showZombieTargets);
    this.debugMenu.setShowZombieAggro(this.showZombieAggro);
    this.debugMenu.setShowHordeDebug(this.showHordeDebug);
    this.debugMenu.setDisableChase(this.disableZombieChase);
    this.debugMenu.setOnSpawnHorde(() => {
      const tile = this.cfg.getGame().tileSize;
      const cx = this.player.x + tile * 4;
      const cy = this.player.y;
      this.zombies.spawnWalkersCluster(3, cx, cy, tile * 0.6);
      this.hud.setHint('Spawned horde (3) near player');
      this.hintTimer = 2.0;
    });
    this.zombieInfo = new ZombieInfoPanel(this.container);
    // Inventory
    this.inventory = new InventorySystem(this.cfg.getResources().weights, this.cfg.getGame().player.carryCap);
    this.nodePanel = new NodePanel(this.container, this.cfg.getResources(), (t) => {
      if (!this.selectedNodeId) return;
      const node = this.resources.getNodes().find((n) => n.id === this.selectedNodeId);
      if (node) node.throttle = t;
    });
    const startNow = performance.now() / 1000;
    this.loop.start(startNow);
    const frame = () => {
      const now = performance.now() / 1000;
      const steps = this.loop!.tick(now);
      this.render();
      const mode = this.player.getCurrentMode();
      const speedTiles =
        mode === 'crouch'
          ? (this.cfg.getGame().player.crouchSpeed as number)
          : mode === 'sprint'
          ? (this.cfg.getGame().player.sprintSpeed as number)
          : (this.cfg.getGame().player.walkSpeed as number);
      const over = this.inventory.isOverCapacity();
      const capMax = this.cfg.getGame().player.carryCap;
      const capTxt = ` | capMax: ${Math.floor(capMax)}`;
      const spawnCfg: any = this.cfg.getSpawn();
      const minSep = Number(spawnCfg?.minSeparationTiles ?? 0);
      const noSpawn = Number(spawnCfg?.noSpawnRadiusTilesAroundStart ?? 0);
      const noiseTiles = this.noise ? this.noise.getRadiusTiles() : 0;
      this.overlay.setText(
        `steps: ${steps}, dt: ${this.stepSec.toFixed(3)}s | mode: ${mode} @ ${speedTiles.toFixed(2)} tiles/s | over:${
          over ? 'Y' : 'N'
        }${capTxt} | noise:${noiseTiles.toFixed(2)}t | spawn[minSep:${minSep}, noSpawn:${noSpawn}]`
      );
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private update(): void {
    if (this.gameOver) return;
    // Player movement & harvest handling
    const move = this.input.getMoveDir();
    const isMoving = move.x !== 0 || move.y !== 0;
    const interact = this.input.isInteractHeld();
    // apply movement with potential speed penalty
    const oc = this.inventory.isOverCapacity();
    const speedFactor = oc ? (this.cfg.getGame() as any).player?.overCapacitySpeedFactor ?? 1 : 1;
    this.player.setSpeedFactor(Number(speedFactor));
    // Collision-aware movement: attempt X then Y separately
    const mode = this.player.getCurrentMode();
    const speedPx = this.player.getSpeedPxPerSec(mode);
    const dx = move.x * speedPx * this.stepSec;
    const dy = move.y * speedPx * this.stepSec;
    const pr = this.cfg.getGame().tileSize * ((this.cfg.getGame() as any).render?.playerRadiusTiles ?? 0.35);
    const attempt = (nx: number, ny: number): boolean => {
      // Build colliders: closed walls/doors and resource nodes
      const colliders: Array<{ x: number; y: number; hw: number; hh: number }> = [];
      for (const w of this.walls) {
        if (w.type === 'Door' && w.isOpen) continue;
        colliders.push({ x: w.x, y: w.y, hw: w.widthPx / 2, hh: w.heightPx / 2 });
      }
      for (const n of this.resources.getNodes()) {
        colliders.push({ x: n.x, y: n.y, hw: n.radiusPx, hh: n.radiusPx });
      }
      //
      // Inline AABB check to avoid require in ESM
      const intersects = (ax: number, ay: number, ahw: number, ahh: number, bx: number, by: number, bhw: number, bhh: number) =>
        Math.abs(ax - bx) <= ahw + bhw && Math.abs(ay - by) <= ahh + bhh;
      // Clamp to world bounds so player cannot leave the map
      const clampedX = Math.min(Math.max(nx, pr), this.worldW - pr);
      const clampedY = Math.min(Math.max(ny, pr), this.worldH - pr);
      for (const c of colliders) {
        if (intersects(clampedX, clampedY, pr, pr, c.x, c.y, c.hw, c.hh)) return false;
      }
      this.player.x = clampedX;
      this.player.y = clampedY;
      return true;
    };
    // attempt move on X axis
    if (dx !== 0) {
      attempt(this.player.x + dx, this.player.y);
    }
    // attempt move on Y axis
    if (dy !== 0) {
      attempt(this.player.x, this.player.y + dy);
    }

    // Door toggle on interact press (takes precedence over harvest)
    const interactPressed = this.input.consumeInteractPressed();
    if (interactPressed) {
      const rangeTiles = (this.cfg.getGame() as any).player?.harvestRangeTiles ?? 1.75;
      const maxDist = rangeTiles * this.cfg.getGame().tileSize;
      let nearestDoor: Wall | null = null;
      let bestD2Door = Number.POSITIVE_INFINITY;
      for (const w of this.walls) {
        if (w.type !== 'Door') continue;
        const dx = w.x - this.player.x;
        const dy = w.y - this.player.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= maxDist * maxDist && d2 < bestD2Door) {
          bestD2Door = d2;
          nearestDoor = w;
        }
      }
      if (nearestDoor) {
        const wasOpen = nearestDoor.isOpen;
        nearestDoor.toggleOpen();
        if (this.noise) {
          const ncfg: any = (this.cfg.getGame() as any).noise ?? {};
          if (!wasOpen && nearestDoor.isOpen) {
            const openTiles = Number(ncfg.doorOpenTiles ?? 1);
            this.noise.addPulseTiles(openTiles);
          } else if (wasOpen && !nearestDoor.isOpen) {
            const closeTiles = Number(ncfg.doorCloseTiles ?? 1);
            this.noise.addPulseTiles(closeTiles);
          }
        }
      }
    }

    // Harvest action
    const rangeTiles = (this.cfg.getGame() as any).player?.harvestRangeTiles ?? 1.75;
    const actionSec = (this.cfg.getGame() as any).player?.harvestActionSec ?? 2;
    // Find nearest node within range (harvest target does not require selection)
    const nodes = this.resources.getNodes();
    const maxDist = rangeTiles * this.cfg.getGame().tileSize;
    let nearest: ResourceNode | null = null;
    let bestD2 = Number.POSITIVE_INFINITY;
    for (const n of nodes) {
      const dx = n.x - this.player.x;
      const dy = n.y - this.player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= maxDist * maxDist && d2 < bestD2) {
        bestD2 = d2;
        nearest = n;
      }
    }
    // Auto-deposit near storage crates
    const depositRadiusTiles = Number((this.cfg.getGame() as any).storage?.autoDepositRadius ?? 2);
    const depositR = depositRadiusTiles * this.cfg.getGame().tileSize;
    for (const s of this.storageCrates) {
      const dx = s.x - this.player.x;
      const dy = s.y - this.player.y;
      if (dx * dx + dy * dy <= depositR * depositR) {
        const payload = this.inventory.takeAll();
        for (const [k, v] of Object.entries(payload)) this.storedTotals[k] = (this.storedTotals[k] ?? 0) + v;
        break;
      }
    }

    if (this.harvest.active) {
      const currentNode = nodes.find((n) => n.id === this.harvest.nodeId) || null;
      const stillInRange = currentNode ? bestD2 <= maxDist * maxDist && currentNode.id === (nearest?.id ?? '') : false;
      // Phase gating: cancel if node no longer allowed
      const allowedNow = currentNode ? this.isNodeHarvestAllowed(currentNode) : false;
      if (!interact || isMoving || !stillInRange || !currentNode || !allowedNow) {
        // cancel
        this.harvest.active = false;
        this.harvest.progressSec = 0;
        this.harvest.nodeId = null;
        if (currentNode && !allowedNow) this.showPhaseHint(currentNode);
      } else {
        this.harvest.progressSec += this.stepSec;
        if (this.harvest.progressSec >= actionSec) {
          // complete a single harvest action
          const { harvested, type } = this.resources.harvest(currentNode, actionSec);
          if (harvested > 0) this.inventory.add(type, harvested);
          this.harvest.progressSec = 0;
        }
      }
    } else if (interact && nearest && !isMoving) {
      // Check phase gating before starting
      if (this.isNodeHarvestAllowed(nearest)) {
        this.harvest.active = true;
        this.harvest.progressSec = 0;
        this.harvest.nodeId = nearest.id;
      } else {
        this.showPhaseHint(nearest);
      }
    }
    // Resources: interactive only, no passive ticking
    // Time system
    this.time.tick(this.stepSec);
    // Day-based respawn cadence
    const day = this.time.getDayNumber();
    const respawnEvery = Number(((this.cfg.getSpawn() as any)?.respawnEveryDays ?? 3));
    if (this.lastSpawnDay === null) this.lastSpawnDay = day; // initial anchor
    const shouldRespawn = day !== this.lastSpawnDay && ((day - 1) % respawnEvery === 0);
    if (shouldRespawn) {
      this.lastSpawnDay = day;
      // Keep on-screen nodes; despawn only nodes outside viewport
      const view = this.engine.getViewportWorldAABB();
      const kept: ResourceNode[] = [];
      const existing = this.resources.getNodes();
      for (const n of existing) {
        const inX = n.x + n.radiusPx > view.x && n.x - n.radiusPx < view.x + view.width;
        const inY = n.y + n.radiusPx > view.y && n.y - n.radiusPx < view.y + view.height;
        if (inX && inY) kept.push(n);
      }
      // Plan counts for all types regardless of current phase
      const planned = this.spawner.planCountsAll();
      // Subtract what we already have visible
      const have: Record<string, number> = {};
      for (const n of kept) have[n.archetype] = (have[n.archetype] ?? 0) + 1;
      const need: Record<string, number> = {};
      for (const [type, cnt] of Object.entries(planned)) {
        const missing = Math.max(0, cnt - (have[type] ?? 0));
        if (missing > 0) need[type] = missing;
      }
      // Rebuild: kept + needed across full world area with constraints
      this.resources.clear();
      for (const n of kept) this.resources.addNode(n);
      const colls2: Array<{ x: number; y: number; hw: number; hh: number }> = [];
      for (const w of this.walls) colls2.push({ x: w.x, y: w.y, hw: w.widthPx / 2, hh: w.heightPx / 2 });
      for (const s of this.storageCrates) colls2.push({ x: s.x, y: s.y, hw: s.sizePx / 2, hh: s.sizePx / 2 });
      for (const n of kept) {
        const rcfg: any = (this.cfg.getResources().nodes as any)[n.archetype] ?? {};
        const area = Math.max(1, Math.floor(rcfg.tileAreaTiles ?? 1));
        const span = Math.max(1, Math.floor(Math.sqrt(area)));
        const half = (span * this.cfg.getGame().tileSize) / 2;
        colls2.push({ x: n.x, y: n.y, hw: half, hh: half });
      }
      const adds = this.spawner.buildFromCountsWithConstraints(need, this.worldW, this.worldH, {
        colliders: colls2,
        avoid: {
          x: this.player.x,
          y: this.player.y,
          radiusPx: Number((this.cfg.getSpawn() as any).noSpawnRadiusTilesAroundStart ?? 0) * this.cfg.getGame().tileSize
        },
        minSeparationPx: Number((this.cfg.getSpawn() as any).minSeparationTiles ?? 0) * this.cfg.getGame().tileSize
      });
      for (const n of adds) this.resources.addNode(n);
    }
    this.hud.setDay(this.time.getDayNumber());
    this.hud.setPhase(this.time.getPhase());
    this.hud.setTimeLeft(this.time.getTimeLeftSec());
    // UI noise level: set to node type's noise while harvesting; decay otherwise
    const activeNode = this.resources.getNodes().find((n) => n.id === this.harvest.nodeId) || null;
    if (this.harvest.active && activeNode) {
      const nCfg: any = (this.cfg.getResources().nodes as any)[activeNode.archetype] ?? {};
      this.uiNoise = Number(nCfg.noiseLevel ?? 0);
    } else {
      const decay = Number(((this.cfg.getGame() as any).noise?.uiDecayPerSec ?? 5) * this.stepSec);
      this.uiNoise = Math.max(0, this.uiNoise - decay);
    }
    this.hud.setNoiseStub(this.uiNoise);
    // Zombie system removed: no update
    // Noise system
    const moving = isMoving;
    const moveMode = this.player.getCurrentMode();
    // noise system targets
    // Movement target
    this.noise.setByMovement((moving ? moveMode : 'idle') as any);
    // Harvest contribution + continuous scaling
    this.noise.setHarvestActive(this.harvest.active);
    if (this.harvest.active) {
      const node = this.resources.getNodes().find((n) => n.id === this.harvest.nodeId) || null;
      if (node) {
        const th = (this.cfg.getResources().throttles as any)[node.throttle] ?? {};
        const noisePerSec = Number(th.noisePerSec ?? 0);
        this.noise.setHarvestNoisePerSec(noisePerSec);
      }
    } else {
      this.noise.setHarvestNoisePerSec(0);
    }
    this.noise.tick(this.stepSec, moving);
    // Resource totals in HUD
    const order = Object.keys(this.cfg.getResources().weights);
    this.hud.setCarriedTotals(this.inventory.getTotals(), order);
    this.hud.setStoredTotals(this.storedTotals, order);
    // Keep node panel stats refreshed for selected node
    if (this.selectedNodeId) {
      const selNode = this.resources.getNodes().find((n) => n.id === this.selectedNodeId) || null;
      this.nodePanel?.setNode(selNode);
    }
    // Hint timer upkeep
    if (this.hintTimer > 0) {
      this.hintTimer -= this.stepSec;
      if (this.hintTimer <= 0) this.hud.setHint('');
    }
    // Update zombies, considering player icon and noise ring interception
    const phase = this.time.getPhase();
    const playerRadiusPx = this.cfg.getGame().tileSize * ((this.cfg.getGame() as any).render?.playerRadiusTiles ?? 0.35);
    const noiseRadiusPx = this.noise ? this.noise.getRadiusPx() : 0;
    const zombieObstacles: Array<{ x: number; y: number; hw: number; hh: number; kind: 'wall' | 'node'; id?: string; type?: 'Wall' | 'Door'; playerBuilt?: boolean; structureKind?: 'door' | 'wall' | 'offense' }> = [];
    for (const w of this.walls) {
      if (w.type === 'Door' && w.isOpen) continue;
      zombieObstacles.push({ x: w.x, y: w.y, hw: w.widthPx / 2, hh: w.heightPx / 2, kind: 'wall', id: w.id, type: w.type, playerBuilt: w.playerBuilt, structureKind: w.type === 'Door' ? 'door' : 'wall' });
    }
    for (const n of this.resources.getNodes()) {
      zombieObstacles.push({ x: n.x, y: n.y, hw: n.radiusPx, hh: n.radiusPx, kind: 'node' });
    }
    this.zombies.update(
      this.stepSec,
      { x: this.player.x, y: this.player.y },
      phase,
      { noiseRadiusPx, playerRadiusPx, disableChase: this.disableZombieChase },
      zombieObstacles
    );
    this.combat.update(this.stepSec, this.zombies.getZombies(), this.player, this.walls);
    this.updateDamageIndicators(this.stepSec);
    this.hud.setPlayerHealth(this.player.getHp(), this.player.getMaxHp());
  }

  private render(): void {
    const game = this.cfg.getGame();
    const tileSize = game.tileSize;
    const playerRadiusTiles = (game as any).render?.playerRadiusTiles ?? 0.35;
    this.engine.setCameraCenter(this.player.x, this.player.y);
    this.engine.drawGrid(tileSize);
    this.engine.drawPlayer(this.player.x, this.player.y, tileSize * playerRadiusTiles);
    const hpRatio = this.player.getMaxHp() > 0 ? Math.max(0, Math.min(1, this.player.getHp() / this.player.getMaxHp())) : 0;
    const hpWidth = Math.max(36, tileSize * this.currentZoom * 1.3);
    const hpHeight = Math.max(4, 6 * this.currentZoom);
    const hpOffset = tileSize * this.currentZoom * 0.9;
    const hpColor = hpRatio > 0.5 ? '#66bb6a' : hpRatio > 0.25 ? '#ffa726' : '#ef5350';
    this.engine.drawHorizontalBar(this.player.x, this.player.y, hpWidth, hpHeight, hpRatio, hpOffset, { fill: hpColor });
    this.renderDamageIndicators(tileSize);
    // Harvest progress (draw above the active node, above its capacity bar)
    if (this.harvest.active) {
      const progress01 = Math.max(
        0,
        Math.min(1, this.harvest.progressSec / ((this.cfg.getGame() as any).player?.harvestActionSec ?? 2))
      );
      const activeNode = this.resources.getNodes().find((n) => n.id === this.harvest.nodeId) || null;
      if (activeNode) {
        const above = activeNode.radiusPx + 16; // a bit above capacity bar
        this.engine.drawVerticalProgress(activeNode.x, activeNode.y, 10, 24, progress01, above);
      }
    }
    // Draw storage crates
    for (const s of this.storageCrates) {
      this.engine.drawStorageCrate(s.x, s.y, s.sizePx);
    }
    // Draw walls and door
    for (const w of this.walls) {
      const selected = this.selectedWallId === w.id;
      this.engine.drawWall(w.x, w.y, w.widthPx, w.type, selected, w.isOpen);
      if (w.maxHp > 0) {
        const ratio = Math.max(0, Math.min(1, w.hp / w.maxHp));
        const barWidth = Math.max(18, w.widthPx * this.currentZoom * 0.9);
        const barHeight = Math.max(3, 4 * this.currentZoom * 0.6);
        const barOffset = (w.heightPx / 2) * this.currentZoom + 6;
        const barColor = ratio > 0.66 ? '#81c784' : ratio > 0.33 ? '#ffb74d' : '#e57373';
        this.engine.drawHorizontalBar(w.x, w.y, barWidth, barHeight, ratio, barOffset, { fill: barColor });
      }
    }
    // Debug: colliders
    if (this.showColliders) {
      const pr = this.cfg.getGame().tileSize * ((this.cfg.getGame() as any).render?.playerRadiusTiles ?? 0.35);
      this.engine.drawAABB(this.player.x, this.player.y, pr, pr, '#ff5252');
      for (const w of this.walls) {
        if (w.type === 'Door' && w.isOpen) continue;
        this.engine.drawAABB(w.x, w.y, w.widthPx / 2, w.heightPx / 2, '#ff5252');
        const debugLabel = w.playerBuilt ? 'PLAYER BUILT' : 'NOT PLAYER BUILT';
        const labelOffset = (w.heightPx / 2) + 12;
        this.engine.drawTextWorld(w.x, w.y - labelOffset, debugLabel, '#ffffff');
      }
      for (const n of this.resources.getNodes()) {
        const rcfg: any = (this.cfg.getResources().nodes as any)[n.archetype] ?? {};
        const area = Math.max(1, Math.floor(rcfg.tileAreaTiles ?? 1));
        const span = Math.max(1, Math.floor(Math.sqrt(area)));
        const half = (span * this.cfg.getGame().tileSize) / 2;
        this.engine.drawAABB(n.x, n.y, half, half, '#ff5252');
      }
    }
    // Debug: no-spawn radius
    if (this.showNoSpawnRadius) {
      const tiles = Number((this.cfg.getSpawn() as any).noSpawnRadiusTilesAroundStart ?? 0);
      const r = tiles * this.cfg.getGame().tileSize;
      if (r > 0) this.engine.drawCircleOutline(this.startX, this.startY, r, '#ff5252');
    }
    if (this.showMinSeparation) {
      const tiles = Number((this.cfg.getSpawn() as any).minSeparationTiles ?? 0);
      const r = tiles * this.cfg.getGame().tileSize;
      if (r > 0) this.engine.drawCircleOutline(this.player.x, this.player.y, r, '#ff5252');
    }
    if (this.showNoiseCircle && this.noise) {
      const nr = this.noise.getRadiusPx();
      if (nr > 0) {
        this.engine.drawCircleOutline(this.player.x, this.player.y, nr, '#ffd54f');
        // label to the right of player in world units (offset by ~0.3 tiles)
        const off = this.cfg.getGame().tileSize * 0.3;
        const label = `${this.noise.getRadiusTiles().toFixed(2)}t`;
        this.engine.drawTextWorld(this.player.x + off, this.player.y - off, label, '#ffd54f');
      }
    }
    // Draw resources
    const nodes = this.resources.getNodes();
    for (const n of nodes) {
      const baseColor = String(((this.cfg.getResources().nodes as any)[n.archetype]?.color) ?? '#888888');
      const color = this.selectedNodeId === n.id ? '#d4af37' : baseColor;
      const pct = n.capacity / this.cfg.getResources().nodes[n.archetype].capacityMax;
      (this.engine as any).drawResourceNode(n.x, n.y, n.radiusPx, color, pct);
    }
    // Night/Eclipse tint
    const phase = this.time.getPhase();
    const renderCfg = (game as any).render ?? {};
    const nightCfg = renderCfg.nightTint ?? { color: '#001020', alpha: 0.35 };
    const eclipseCfg = renderCfg.eclipseTint ?? { color: '#200010', alpha: 0.5 };
    const tintCfg = phase === 'eclipse' ? eclipseCfg : phase === 'night' ? nightCfg : null;
    if (tintCfg) {
      this.engine.drawTintOverlay(String(tintCfg.color), Number(tintCfg.alpha));
    }
    // Draw zombies
    const zColor = '#e53935';
    const zRadius = this.cfg.getGame().tileSize * 0.3;
    const detectScale = (this.cfg.getEnemies() as any).globals?.detectScaleByPhase ?? { day: 1, night: 1.1, eclipse: 1.25 };
    const phaseScale = phase === 'eclipse' ? detectScale.eclipse : phase === 'night' ? detectScale.night : detectScale.day;
    for (const z of this.zombies.getZombies()) {
      (this.engine as any).drawFilledCircle(z.x, z.y, zRadius, z.id === this.selectedZombieId ? '#ff6e6e' : zColor);
      if (this.showZombieDetect) {
        const r = (z as any).stats.detectRadiusTiles * this.cfg.getGame().tileSize * phaseScale;
        this.engine.drawCircleOutline(z.x, z.y, r, '#e57373');
      }
      const labelOffset = this.cfg.getGame().tileSize * 0.35;
      const lineStep = this.cfg.getGame().tileSize * 0.18;
      let nextLine = 0;
      if (this.showZombieStates) {
        const txt = (z as any).state.toUpperCase();
        this.engine.drawTextWorld(z.x + labelOffset, z.y - labelOffset, txt, '#ffffff');
        nextLine = 1;
        const hs = this.zombies.getHordeStatus((z as any).id);
        if (hs.inHorde) {
          const role = hs.isLeader ? 'LEADER' : 'FOLLOWER';
          const htxt = `IN HORDE - ${role}`;
          this.engine.drawTextWorld(z.x + labelOffset, z.y - labelOffset + lineStep * nextLine, htxt, '#ffffff');
          nextLine += 1;
        }
        const idleLeft = (z as any).getIdleSecLeft ? (z as any).getIdleSecLeft() : 0;
        if ((z as any).state === 'idle' && idleLeft > 0) {
          const itxt = `IDLE ${idleLeft.toFixed(1)}s`;
          this.engine.drawTextWorld(z.x + labelOffset, z.y - labelOffset + lineStep * nextLine, itxt, '#ffd54f');
          nextLine += 1;
        }
      }
      if (this.showZombieTargets || this.showZombieAggro) {
        const dbg = (z as any).getDebugInfo ? (z as any).getDebugInfo() : null;
        if (dbg) {
          const baseY = z.y - labelOffset + lineStep * nextLine;
          let extraLine = 0;
          if (this.showZombieTargets) {
            const targetLabel = dbg.targetKind === 'player' ? 'TARGET: PLAYER' : dbg.targetKind === 'none' ? 'TARGET: NONE' : `TARGET: ${dbg.targetKind.toUpperCase()} (${dbg.targetId ?? '?'})`;
            const distTiles = (dbg.focusDistPx / this.cfg.getGame().tileSize).toFixed(2);
            const targetText = `${targetLabel} @ ${distTiles}t`;
            this.engine.drawTextWorld(z.x + labelOffset, baseY + lineStep * extraLine, targetText, '#ffd54f');
            extraLine += 1;
          }
          if (this.showZombieAggro) {
            const aggroText = `AGGRO: ${dbg.wantsAggro ? 'YES' : 'NO'} | LoS: ${dbg.hasLineOfSight ? 'CLR' : 'BLOCK'} | Det[P:${dbg.playerIntercepts ? 'Y' : 'N'} N:${dbg.noiseIntercepts ? 'Y' : 'N'}]`;
            this.engine.drawTextWorld(z.x + labelOffset, baseY + lineStep * extraLine, aggroText, '#81d4fa');
            extraLine += 1;
          }
          nextLine += extraLine;
        }
      }
      if (this.showZombieTargets) {
        const target = (z as any).getAttackStructure ? (z as any).getAttackStructure() : null;
        if (target) {
          this.engine.drawVector(z.x, z.y, target.x - z.x, target.y - z.y, '#ff9800');
        }
      }
      if (this.showHordeDebug) {
        const hs = this.zombies.getHordeStatus((z as any).id);
        if (hs.inHorde) {
          if (hs.isLeader) {
            this.engine.drawCircleOutline(z.x, z.y, zRadius * 1.4, '#d4af37');
          } else {
            const t = this.zombies.getFollowerTarget((z as any).id, { x: this.player.x, y: this.player.y });
            if (t) this.engine.drawCircleOutline(t.x, t.y, this.cfg.getGame().tileSize * 0.25, '#64b5f6');
          }
        }
      }
    }
    // Refresh info panel for selected zombie
    this.updateZombieInfoPanel();
  }

  private updateZombieInfoPanel(): void {
    if (!this.selectedZombieId) { this.zombieInfo.setZombie(null); return; }
    const z = (this.zombies.getZombies() as any).find((zz: any) => zz.id === this.selectedZombieId);
    if (!z) { this.zombieInfo.setZombie(null); return; }
    const s = z.stats;
    this.zombieInfo.setZombie({
      id: z.id,
      kind: z.kind,
      hp: s.hp,
      walkTiles: s.walkTiles,
      sprintTiles: s.sprintTiles,
      detectRadiusTiles: s.detectRadiusTiles,
      attackPower: s.attackPower,
      attackIntervalSec: s.attackIntervalSec,
      attackRangeTiles: s.attackRangeTiles,
      state: String(z.state)
    });
  }

  private isNodeHarvestAllowed(node: ResourceNode): boolean {
    const phase = this.time.getPhase();
    const rcfg: any = (this.cfg.getResources().nodes as any)[node.archetype] ?? {};
    const rule: string = rcfg.phase ?? (rcfg.nightOnly ? 'night' : 'any');
    if (rule === 'any') return true;
    if (rule === 'day') return phase === 'day';
    if (rule === 'night') return phase === 'night' || phase === 'eclipse';
    if (rule === 'eclipse') return phase === 'eclipse';
    return true;
  }

  private onStructureDamaged = ({ structureId, remainingHp }: StructureDamagedEvent): void => {

    const wall = this.walls.find((w) => w.id === structureId);

    if (!wall) return;

    wall.hp = Math.max(0, remainingHp);

    if (this.selectedWallId === structureId) {

      const salvage = this.makeWallSalvage(wall);

      this.nodePanel?.setWall(wall, salvage);

    }

  };



  private onStructureDestroyed = ({ structureId, attackerId }: StructureDestroyedEvent): void => {

    const idx = this.walls.findIndex((w) => w.id === structureId);

    if (idx === -1) return;

    this.walls.splice(idx, 1);

    if (this.selectedWallId === structureId) {

      this.selectedWallId = null;

      this.nodePanel?.setWall(null, null);

    }

    for (const z of this.zombies.getZombies()) {

      const target = z.getAttackStructure();

      if (target && target.id === structureId) z.clearAttackStructure();

    }

    if (!this.gameOver && (this.cfg.getGame() as any).ui?.hintSec) {

      this.hud.setHint(`Structure destroyed by ${attackerId}`);

      this.hintTimer = Number((this.cfg.getGame() as any).ui?.hintSec ?? 2);

    }

  };



  private onPlayerDamaged = ({ amount }: PlayerDamagedEvent): void => {
    if (this.gameOver) return;
    const dealt = Math.max(0, Math.floor(amount ?? 0));
    if (dealt <= 0) return;
    const tile = this.cfg.getGame().tileSize;
    const lifetime = 2.0;
    const risePx = tile * 1.2;
    const spread = tile * 0.25;
    const indicator: DamageIndicator = {
      id: this.damageIdSeq += 1,
      amount: dealt,
      age: 0,
      lifetime,
      risePx,
      offsetXPx: (Math.random() * 2 - 1) * spread
    };
    this.damageIndicators.push(indicator);
  };

  private updateDamageIndicators(dtSec: number): void {
    if (!this.damageIndicators.length) return;
    this.damageIndicators = this.damageIndicators.filter((d) => {
      d.age += dtSec;
      return d.age < d.lifetime;
    });
  }

  private renderDamageIndicators(tileSize: number): void {
    if (!this.damageIndicators.length) return;
    const baseOffset = tileSize * 1.1;
    for (const d of this.damageIndicators) {
      const progress = Math.min(1, Math.max(0, d.age / d.lifetime));
      const rise = d.risePx * progress;
      const alpha = Math.max(0, 1 - progress);
      const color = `rgba(255, 96, 96, ${alpha.toFixed(2)})`;
      const x = this.player.x + d.offsetXPx;
      const y = this.player.y - baseOffset - rise;
      this.engine.drawTextWorld(x, y, `-${d.amount}`, color);
    }
  }

  private onPlayerDied = ({ killerId }: PlayerDiedEvent): void => {
    if (this.gameOver) return;
    this.gameOver = true;
    if (this.loop) this.loop.stop();
    if (this.inputAttached) {
      this.input.detach(window);
      this.inputAttached = false;
    }
    window.removeEventListener('keydown', this.onZoomKey);
    this.hintTimer = 0;
    this.hud.setHint('');
    this.damageIndicators.length = 0;
    this.gameOverOverlay.show(killerId);
  };

  private resetRun = (): void => {
    window.location.reload();
  };

  private makeWallSalvage(wall: Wall): Record<string, number> {
    const buildables: any = this.cfg.getBuildables();
    const salvagePct = Number((buildables?.globals?.salvageRefundPct ?? 50) / 100);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(wall.cost)) out[k] = Math.floor(v * salvagePct);
    return out;
  }

  private showPhaseHint(node: ResourceNode): void {
    const rcfg: any = (this.cfg.getResources().nodes as any)[node.archetype] ?? {};
    const rule: string = rcfg.phase ?? (rcfg.nightOnly ? 'night' : 'any');
    if (rule === 'any') return;
    const phaseLabel = rule.charAt(0).toUpperCase() + rule.slice(1);
    this.hud.setHint(`${node.archetype} can only be harvested at ${phaseLabel}`);
    const hintSec = Number(((this.cfg.getGame() as any).ui?.hintSec ?? 2));
    this.hintTimer = hintSec;
  }

  private onZoomKey = (e: KeyboardEvent): void => {
    let dz = 0;
    if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') dz = 0.1;
    else if (e.key === '-' || e.code === 'NumpadSubtract') dz = -0.1;
    if (dz !== 0) {
      e.preventDefault();
      this.currentZoom = Math.min(2.0, Math.max(1.0, this.currentZoom + dz));
      if ('setZoom' in this.engine) (this.engine as any).setZoom(this.currentZoom);
    }
  };

  // Zombies removed: no spawning helpers
}








