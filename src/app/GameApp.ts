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
import { ZombieSystem, ZombieDamagedEvent, ZombieKilledEvent } from '@core/systems/ZombieSystem';
import type { Zombie } from '@core/entities/enemies/Zombie';
import { ZombieInfoPanel } from '@ui/ZombieInfoPanel';
import { GameOverOverlay } from '@ui/GameOverOverlay';
import { CombatTextManager } from '@ui/CombatTextManager';
import { ExperienceSystem, PlayerExperienceChangedEvent, PlayerLevelUpEvent } from '@core/systems/ExperienceSystem';
import { ExperienceOverlay } from '@ui/ExperienceOverlay';
import { LevelUpOverlay } from '@ui/LevelUpOverlay';
import { BuildRadialMenu, BuildRadialOption } from '@ui/BuildRadialMenu';
import { StructureBuilder, StructureBlueprint } from '@core/systems/StructureBuilder';

// Zombie system removed for refactor: all references stripped

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
  private deconstruct = { active: false, progressSec: 0, wallId: null as string | null };
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
  private experienceOverlay!: ExperienceOverlay;
  private levelUpOverlay!: LevelUpOverlay;
  private experience!: ExperienceSystem;
  private levelUpQueue: PlayerLevelUpEvent[] = [];
  private showExperienceNumbers = false;
  private levelUpPaused = false;
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
  private combatText: CombatTextManager;

  private structureBuilder!: StructureBuilder;
  private buildMenu!: BuildRadialMenu;
  private buildBlueprints: StructureBlueprint[] = [];
  private buildSelectedBlueprintId: string | null = null;
  private buildSelectedIndex = 0;
  private buildMenuVisible = false;
  private buildPreviewSuppressed = false;
  private buildPreview = { active: false, blueprintId: null as string | null, centerX: 0, centerY: 0, halfSize: 0, tileX: 0, tileY: 0, valid: false };
  private buildAction = { active: false, structureId: null as string | null };
  private mouseWorld = { x: 0, y: 0 };
  private canvasEl: HTMLCanvasElement | null = null;
  private nextStructureId = 0;
  private freeBuild = false;
  private instantBuild = false;


  constructor(engine: IEngineAdapter, bus: EventBus, cfg: ConfigService, container: HTMLElement) {
    this.engine = engine;
    this.bus = bus;
    this.cfg = cfg;
    this.container = container;
    this.overlay = new DebugOverlay(container);
    this.combatText = new CombatTextManager();

  }

  public async start(): Promise<void> {
    this.engine.init(this.container);
    const base = import.meta.env.BASE_URL;
    const game = this.cfg.getGame();
    const progressionCfg = (game as any).progression ?? {};
    this.showExperienceNumbers = Boolean(progressionCfg?.debugShowNumbers);
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
    this.mouseWorld.x = this.player.x;
    this.mouseWorld.y = this.player.y;
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
    this.experience = new ExperienceSystem(this.bus, this.cfg);
    this.experienceOverlay = new ExperienceOverlay(this.container);
    this.levelUpOverlay = new LevelUpOverlay(this.container);
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
    this.structureBuilder = new StructureBuilder(this.cfg.getBuildables(), this.cfg.getGame().tileSize);
    this.loadBuildBlueprints();
    this.buildMenu = new BuildRadialMenu(this.container);
    const buildablesCfg = this.cfg.getBuildables() as any;
    const tile = this.cfg.getGame().tileSize;
    const sizeTiles = 9;
    const half = Math.floor(sizeTiles / 2);
    const centerX = Math.round(this.player.x / tile);
    const centerY = Math.round(this.player.y / tile);
    const doorSide: 'north' | 'south' | 'east' | 'west' = 'east';
    const salvagePct = Number((buildablesCfg?.globals?.salvageRefundPct ?? 50) / 100);
    const mkSalv = (cost: Record<string, number>) => {
      const o: Record<string, number> = {};
      for (const [k, v] of Object.entries(cost)) o[k] = Math.floor(v * salvagePct);
      return o;
    };
    const walls: Wall[] = [];
    const wallBlueprint = this.structureBuilder.getBlueprint('fort:Wall');
    const doorBlueprint = this.structureBuilder.getBlueprint('fort:Door');
    for (let tx = centerX - half; tx <= centerX + half; tx += 1) {
      for (let ty = centerY - half; ty <= centerY + half; ty += 1) {
        const onEdge = tx === centerX - half || tx === centerX + half || ty === centerY - half || ty === centerY + half;
        if (!onEdge) continue;
        const isDoor = doorSide === 'east' && tx === centerX + half && ty === centerY;
        const structureId = `struct-initial-${this.nextStructureId++}`;
        let wall: Wall | null = null;
        if (isDoor) {
          if (doorBlueprint) {
            wall = this.structureBuilder.createStructureInstance(doorBlueprint.id, structureId) as Wall;
          } else if (wallBlueprint) {
            wall = new Wall({
              id: structureId,
              tileSize: tile,
              hp: wallBlueprint.maxHp,
              cost: wallBlueprint.cost,
              buildTimeSec: wallBlueprint.buildTimeSec,
              noisePerSec: wallBlueprint.noisePerSec,
              footprintTiles: wallBlueprint.footprintTiles,
              type: 'Door',
              state: 'completed',
              playerBuilt: true,
              initialHp: wallBlueprint.maxHp
            });
          }
        } else if (wallBlueprint) {
          wall = this.structureBuilder.createStructureInstance(wallBlueprint.id, structureId) as Wall;
        }
        if (!wall) continue;
        wall.setGridPosition(tx, ty);
        wall.playerBuilt = true;
        wall.state = 'completed';
        wall.buildProgressSec = wall.buildTimeSec;
        wall.hp = wall.maxHp;
        wall.isOpen = false;
        walls.push(wall);
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
    this.bus.on<ZombieDamagedEvent>('ZombieDamaged', this.onZombieDamaged);
    this.bus.on<PlayerExperienceChangedEvent>('PlayerExperienceChanged', this.onExperienceChanged);
    this.bus.on<PlayerLevelUpEvent>('PlayerLevelUp', this.onPlayerLevelUp);
    this.bus.on<ZombieKilledEvent>('ZombieKilled', this.onZombieKilled);
    this.refreshExperienceOverlay();

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
    this.canvasEl = this.container.querySelector('canvas') as HTMLCanvasElement | null;
    if (this.canvasEl) {
      this.canvasEl.addEventListener('click', this.onCanvasClick);
      this.canvasEl.addEventListener('mousemove', this.onCanvasMouseMove);
      this.canvasEl.addEventListener('mousedown', this.onCanvasMouseDown);
      this.canvasEl.addEventListener('contextmenu', this.onCanvasContextMenu);
    }

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
      this.showExperienceNumbers = opts.showExperienceNumbers;
      this.freeBuild = opts.freeBuild;
      this.instantBuild = opts.instantBuild;
      this.refreshExperienceOverlay();
    });
    this.debugMenu.setShowColliders(this.showColliders);
    this.debugMenu.setShowNoSpawnRadius(this.showNoSpawnRadius);
    this.debugMenu.setShowMinSeparation(this.showMinSeparation);
    this.debugMenu.setShowNoise(this.showNoiseCircle);
    this.debugMenu.setShowZombieDetect(this.showZombieDetect);
    this.debugMenu.setShowZombieStates(this.showZombieStates);
    this.debugMenu.setShowZombieTargets(this.showZombieTargets);
    this.debugMenu.setShowZombieAggro(this.showZombieAggro);
    this.debugMenu.setShowExperienceNumbers(this.showExperienceNumbers);
    this.debugMenu.setFreeBuild(this.freeBuild);
    this.debugMenu.setInstantBuild(this.instantBuild);
    this.debugMenu.setShowHordeDebug(this.showHordeDebug);
    this.debugMenu.setDisableChase(this.disableZombieChase);
    this.debugMenu.setOnDamagePlayer(() => this.damagePlayerDebug(10));
    this.debugMenu.setOnHealPlayer(() => this.healPlayerDebug(10));
    this.debugMenu.setOnDamageStructures(() => this.damageStructuresDebug(25));
    this.debugMenu.setOnHealStructures(() => this.healStructuresDebug(25));
    this.debugMenu.setOnDamageZombies(() => this.damageZombiesDebug(15));
    this.debugMenu.setOnHealZombies(() => this.healZombiesDebug(20));
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
    if (this.gameOver || this.levelUpPaused) return;
    this.updateBuildMenu();
    this.updateBuildPreview();
    if (this.input.consumeCancelBuild()) this.cancelBuildPlacementMode();
    // Player movement & harvest handling
    const move = this.input.getMoveDir();
    const isMoving = move.x !== 0 || move.y !== 0;
    const interact = this.input.isInteractHeld();
    const deconstructHeld = this.input.isDeconstructHeld();
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

    const rangeTiles = (this.cfg.getGame() as any).player?.harvestRangeTiles ?? 1.75;
    const buildRange = rangeTiles * this.cfg.getGame().tileSize;
    const buildInteractHeld = interact && !isMoving;
    const activeStructure = this.buildAction.structureId ? this.walls.find((w) => w.id === this.buildAction.structureId) ?? null : null;
    let nearestStructure: Wall | null = null;
    let nearestStructureDistSq = Number.POSITIVE_INFINITY;
    for (const structure of this.walls) {
      if (structure.isCompleted()) continue;
      const dxBuild = structure.x - this.player.x;
      const dyBuild = structure.y - this.player.y;
      const reach = buildRange + Math.max(structure.getHalfWidth(), structure.getHalfHeight());
      const distSqBuild = dxBuild * dxBuild + dyBuild * dyBuild;
      if (distSqBuild <= reach * reach && distSqBuild < nearestStructureDistSq) {
        nearestStructure = structure;
        nearestStructureDistSq = distSqBuild;
      }
    }
    const updateBuildNoise = (structure: Wall | null, active: boolean): void => {
      if (!this.noise) return;
      if (active && structure && !this.instantBuild) {
        this.noise.setBuildActive(true);
        this.noise.setBuildNoisePerSec(structure.noisePerSec);
      } else {
        this.noise.setBuildActive(false);
        this.noise.setBuildNoisePerSec(0);
      }
    };
    const updateDeconstructNoise = (structure: Wall | null, active: boolean): void => {
      if (!this.noise) return;
      if (active && structure) {
        this.noise.setDeconstructActive(true);
        this.noise.setDeconstructNoisePerSec(structure.noisePerSec);
      } else {
        this.noise.setDeconstructActive(false);
        this.noise.setDeconstructNoisePerSec(0);
      }
    };
    if (this.instantBuild && this.buildAction.active) {
      const structure = activeStructure;
      if (structure) {
        structure.state = 'completed';
        structure.buildProgressSec = structure.buildTimeSec;
        structure.hp = structure.maxHp;
      }
      this.buildAction.active = false;
      this.buildAction.structureId = null;
    }
    if (this.buildAction.active) {
      const structure = activeStructure;
      const stillValid = structure && !structure.isCompleted();
      const withinRange =
        structure
          ? (() => {
              const dx = structure.x - this.player.x;
              const dy = structure.y - this.player.y;
              const reach = buildRange + Math.max(structure.getHalfWidth(), structure.getHalfHeight());
              return dx * dx + dy * dy <= reach * reach;
            })()
          : false;
      if (!structure || !stillValid || !buildInteractHeld || isMoving || !withinRange) {
        this.buildAction.active = false;
        this.buildAction.structureId = null;
        updateBuildNoise(null, false);
      } else {
        structure.beginConstruction();
        const completed = structure.advanceConstruction(this.stepSec);
        updateBuildNoise(structure, true);
        if (completed) {
          this.buildAction.active = false;
          this.buildAction.structureId = null;
          updateBuildNoise(null, false);
          const hintSec = Number(((this.cfg.getGame() as any).ui?.hintSec ?? 2));
          this.hud.setHint(`${structure.kind} completed`);
          this.hintTimer = hintSec;
        }
      }
    }
    if (!this.buildAction.active && buildInteractHeld && nearestStructure) {
      this.buildAction.active = true;
      this.buildAction.structureId = nearestStructure.id;
      nearestStructure.beginConstruction();
      this.harvest.active = false;
      this.harvest.progressSec = 0;
      this.harvest.nodeId = null;
      updateBuildNoise(nearestStructure, true);
    } else if (!this.buildAction.active) {
      updateBuildNoise(null, false);
    }
    const selectedWall = this.selectedWallId ? this.walls.find((w) => w.id === this.selectedWallId) ?? null : null;
    const deconstructSec = Number((this.cfg.getGame() as any).player?.deconstructActionSec ?? 2.5);
    const canReachWall = (wall: Wall | null): boolean => {
      if (!wall) return false;
      const dx = wall.x - this.player.x;
      const dy = wall.y - this.player.y;
      const reach = buildRange + Math.max(wall.getHalfWidth(), wall.getHalfHeight());
      return dx * dx + dy * dy <= reach * reach;
    };

    if (this.deconstruct.active) {
      const wall = this.walls.find((w) => w.id === this.deconstruct.wallId) ?? null;
      const withinRange = canReachWall(wall);
      if (!deconstructHeld || isMoving || !wall || !withinRange) {
        this.deconstruct.active = false;
        this.deconstruct.progressSec = 0;
        this.deconstruct.wallId = null;
        updateDeconstructNoise(null, false);
      } else {
        this.deconstruct.progressSec += this.stepSec;
        updateDeconstructNoise(wall, true);
        const duration = Math.max(0, deconstructSec);
        if (duration === 0 || this.deconstruct.progressSec >= duration) {
          this.completeDeconstruct(wall);
          this.deconstruct.active = false;
          this.deconstruct.progressSec = 0;
          this.deconstruct.wallId = null;
          updateDeconstructNoise(null, false);
        }
      }
    } else if (deconstructHeld && !isMoving && selectedWall) {
      const canStart = selectedWall.playerBuilt && selectedWall.isCompleted() && canReachWall(selectedWall);
      if (canStart) {
        this.deconstruct.active = true;
        this.deconstruct.progressSec = 0;
        this.deconstruct.wallId = selectedWall.id;
        if (this.buildAction.active) {
          this.buildAction.active = false;
          this.buildAction.structureId = null;
          updateBuildNoise(null, false);
        }
        if (this.harvest.active) {
          this.harvest.active = false;
          this.harvest.progressSec = 0;
          this.harvest.nodeId = null;
        }
        updateDeconstructNoise(selectedWall, true);
      } else if (this.hintTimer <= 0) {
        let reason = '';
        if (!selectedWall.playerBuilt) reason = 'Only player-built structures can be deconstructed';
        else if (!selectedWall.isCompleted()) reason = 'Finish construction before deconstructing';
        else if (!canReachWall(selectedWall)) reason = 'Move closer to deconstruct';
        else reason = 'Cannot deconstruct right now';
        this.hud.setHint(reason);
        this.hintTimer = Number(((this.cfg.getGame() as any).ui?.hintSec ?? 2));
      }
    } else {
      if (this.deconstruct.active) {
        this.deconstruct.active = false;
      }
      this.deconstruct.progressSec = 0;
      this.deconstruct.wallId = null;
      updateDeconstructNoise(null, false);
    }

    const actionSec = (this.cfg.getGame() as any).player?.harvestActionSec ?? 2;
    const nodes = this.resources.getNodes();
    const maxDist = rangeTiles * this.cfg.getGame().tileSize;
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

    if (!this.buildAction.active) {
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

      if (this.harvest.active) {
        const currentNode = nodes.find((n) => n.id === this.harvest.nodeId) || null;
        const stillInRange = currentNode ? bestD2 <= maxDist * maxDist && currentNode.id === (nearest?.id ?? '') : false;
        const allowedNow = currentNode ? this.isNodeHarvestAllowed(currentNode) : false;
        if (!interact || isMoving || !stillInRange || !currentNode || !allowedNow) {
          this.harvest.active = false;
          this.harvest.progressSec = 0;
          this.harvest.nodeId = null;
          if (currentNode && !allowedNow) this.showPhaseHint(currentNode);
        } else {
          this.harvest.progressSec += this.stepSec;
          if (this.harvest.progressSec >= actionSec) {
            const { harvested, type } = this.resources.harvest(currentNode, actionSec);
            if (harvested > 0) {
              this.inventory.add(type, harvested);
              this.experience.grantHarvestExperience(currentNode.archetype, harvested);
            }
            this.harvest.progressSec = 0;
          }
        }
      } else if (interact && nearest && !isMoving) {
        if (this.isNodeHarvestAllowed(nearest)) {
          this.harvest.active = true;
          this.harvest.progressSec = 0;
          this.harvest.nodeId = nearest.id;
        } else {
          this.showPhaseHint(nearest);
        }
      }
    } else if (this.harvest.active) {
      this.harvest.active = false;
      this.harvest.progressSec = 0;
      this.harvest.nodeId = null;
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
    this.experience.update(this.stepSec, { x: this.player.x, y: this.player.y });
    this.combatText.update(this.stepSec);
    this.hud.setPlayerHealth(this.player.getHp(), this.player.getMaxHp());
  }

  private render(): void {
    const game = this.cfg.getGame();
    const tileSize = game.tileSize;
    const playerRadiusTiles = (game as any).render?.playerRadiusTiles ?? 0.35;
    this.engine.setCameraCenter(this.player.x, this.player.y);
    this.engine.drawGrid(tileSize);
    this.engine.drawPlayer(this.player.x, this.player.y, tileSize * playerRadiusTiles);
    const playerMaxHp = this.player.getMaxHp();
    const playerHp = this.player.getHp();
    if (playerMaxHp > 0 && playerHp < playerMaxHp) {
      const hpRatio = Math.max(0, Math.min(1, playerHp / playerMaxHp));
      const hpWidth = Math.max(36, tileSize * this.currentZoom * 1.3);
      const hpHeight = Math.max(4, 6 * this.currentZoom);
      const hpOffset = tileSize * this.currentZoom * 0.9;
      const hpColor = hpRatio > 0.5 ? '#66bb6a' : hpRatio > 0.25 ? '#ffa726' : '#ef5350';
      this.engine.drawHorizontalBar(this.player.x, this.player.y, hpWidth, hpHeight, hpRatio, hpOffset, { fill: hpColor });
    }
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
    if (this.buildPreview.active && !this.buildMenuVisible) {
      const color = this.buildPreview.valid ? '#81c784' : '#ef5350';
      this.engine.drawAABB(this.buildPreview.centerX, this.buildPreview.centerY, this.buildPreview.halfSize, this.buildPreview.halfSize, color);
    }

    // Draw walls and door
    for (const w of this.walls) {
      const selected = this.selectedWallId === w.id;
      this.engine.drawWall(w.x, w.y, w.widthPx, w.type, selected, w.isOpen);
      if (!w.isCompleted()) {
        const ratio = w.getConstructionRatio();
        const barWidth = Math.max(18, w.widthPx * this.currentZoom * 0.9);
        const barHeight = Math.max(3, 4 * this.currentZoom * 0.6);
        const barOffset = (w.heightPx / 2) * this.currentZoom + 6;
        this.engine.drawHorizontalBar(w.x, w.y, barWidth, barHeight, ratio, barOffset, { fill: '#ffd54f', background: 'rgba(0,0,0,0.65)' });
      } else if (w.maxHp > 0 && w.hp < w.maxHp) {
        const ratio = Math.max(0, Math.min(1, w.hp / w.maxHp));
        const barWidth = Math.max(18, w.widthPx * this.currentZoom * 0.9);
        const barHeight = Math.max(3, 4 * this.currentZoom * 0.6);
        const barOffset = (w.heightPx / 2) * this.currentZoom + 6;
        const barColor = ratio > 0.66 ? '#81c784' : ratio > 0.33 ? '#ffb74d' : '#e57373';
        this.engine.drawHorizontalBar(w.x, w.y, barWidth, barHeight, ratio, barOffset, { fill: barColor });
      }
      if (this.deconstruct.active && this.deconstruct.wallId === w.id) {
        const duration = Math.max(0, Number((this.cfg.getGame() as any).player?.deconstructActionSec ?? 2.5));
        const ratioDeconstruct = duration === 0 ? 1 : Math.max(0, Math.min(1, this.deconstruct.progressSec / duration));
        const barWidth = Math.max(18, w.widthPx * this.currentZoom * 0.9);
        const barHeight = Math.max(3, 4 * this.currentZoom * 0.6);
        const barOffset = (w.heightPx / 2) * this.currentZoom + 14;
        this.engine.drawHorizontalBar(w.x, w.y, barWidth, barHeight, ratioDeconstruct, barOffset, { fill: '#ff7043', background: 'rgba(0,0,0,0.65)' });
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
    const orbs = this.experience.getOrbs();
    if (orbs.length) {
      const orbRadius = this.experience.getOrbRadiusPx();
      for (const orb of orbs) {
        this.engine.drawFilledCircle(orb.x, orb.y, orbRadius, '#fdd835');
      }
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

      const zMaxHp = typeof (z as any).getMaxHp === 'function' ? (z as any).getMaxHp() : z.stats.hp;
      const zHp = typeof (z as any).getHp === 'function' ? (z as any).getHp() : z.stats.hp;
      if (zMaxHp > 0 && zHp < zMaxHp) {
        const ratio = Math.max(0, Math.min(1, zHp / zMaxHp));
        const barWidth = this.cfg.getGame().tileSize;
        const barHeight = Math.max(3, 4 * this.currentZoom);
        const barOffset = zRadius + barHeight + 4;
        this.engine.drawHorizontalBar(z.x, z.y, barWidth, barHeight, ratio, barOffset, { fill: this.getHealthBarColor(ratio) });
      }

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
    this.combatText.render(this.engine);
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

  private getHealthBarColor(ratio: number): string {
    if (!Number.isFinite(ratio)) return '#e57373';
    return ratio > 0.66 ? '#81c784' : ratio > 0.33 ? '#ffb74d' : '#e57373';
  }

  private damagePlayerDebug(amount: number): void {
    if (amount <= 0) return;
    const dealt = this.player.applyDamage(amount);
    if (dealt <= 0) return;
    this.hud.setPlayerHealth(this.player.getHp(), this.player.getMaxHp());
    this.bus.emit<PlayerDamagedEvent>('PlayerDamaged', {
      zombieId: 'debug-tools',
      amount: dealt,
      remainingHp: this.player.getHp()
    });
    if (this.player.isDead()) {
      this.bus.emit<PlayerDiedEvent>('PlayerDied', { killerId: 'debug-tools' });
    }
  }

  private healPlayerDebug(amount: number): void {
    if (amount <= 0) return;
    const healed = this.player.heal(amount);
    if (healed <= 0) return;
    const tile = this.cfg.getGame().tileSize;
    const display = Math.max(1, Math.round(healed));
    this.hud.setPlayerHealth(this.player.getHp(), this.player.getMaxHp());
    this.combatText.spawn({
      text: `+${display}`,
      color: '#81c784',
      lifetimeSec: 1.6,
      risePx: tile * 1.2,
      spreadXPx: tile * 0.25,
      baseYOffsetPx: tile * 1.1,
      getPosition: () => ({ x: this.player.x, y: this.player.y })
    });
  }

  private damageStructuresDebug(amount: number): void {
    if (amount <= 0) return;
    const attackerId = 'debug-tools';
    for (const wall of this.walls) {
      if (!wall.playerBuilt) continue;
      if (wall.hp <= 0) continue;
      const originalHp = wall.hp;
      const newHp = Math.max(0, originalHp - amount);
      if (newHp === originalHp) continue;
      wall.hp = newHp;
      const dealt = originalHp - newHp;
      this.bus.emit<StructureDamagedEvent>('StructureDamaged', {
        structureId: wall.id,
        attackerId,
        amount: dealt,
        remainingHp: wall.hp
      });
      if (wall.hp <= 0) {
        this.bus.emit<StructureDestroyedEvent>('StructureDestroyed', { structureId: wall.id, attackerId });
      }
    }
  }

  private healStructuresDebug(amount: number): void {
    if (amount <= 0) return;
    const tile = this.cfg.getGame().tileSize;
    for (const wall of this.walls) {
      if (!wall.playerBuilt) continue;
      if (wall.hp >= wall.maxHp) continue;
      const originalHp = wall.hp;
      wall.hp = Math.min(wall.maxHp, wall.hp + amount);
      const restored = wall.hp - originalHp;
      if (restored <= 0) continue;
      if (this.selectedWallId === wall.id) {
        const salvage = this.makeWallSalvage(wall);
        this.nodePanel?.setWall(wall, salvage);
      }
      const baseOffset = (wall.heightPx / 2) + Math.max(12, tile * 0.3);
      const spread = Math.max(tile * 0.2, wall.widthPx * 0.25);
      this.combatText.spawn({
        text: `+${Math.max(1, Math.round(restored))}`,
        color: '#81c784',
        lifetimeSec: 1.4,
        risePx: tile,
        spreadXPx: spread,
        baseYOffsetPx: baseOffset,
        getPosition: () => ({ x: wall.x, y: wall.y })
      });
    }
  }

  private damageZombiesDebug(amount: number): void {
    if (amount <= 0) return;
    const result = this.zombies.damageAllZombies(amount);
    if (result.killed > 0 && this.selectedZombieId) {
      const stillExists = this.zombies.getZombies().some((z) => z.id === this.selectedZombieId);
      if (!stillExists) this.selectedZombieId = null;
    }
    this.updateZombieInfoPanel();
  }

  private healZombiesDebug(amount: number): void {
    if (amount <= 0) return;
    const tile = this.cfg.getGame().tileSize;
    for (const zombie of this.zombies.getZombies()) {
      const healed = this.zombies.healZombie(zombie.id, amount);
      if (healed <= 0) continue;
      this.combatText.spawn({
        text: `+${Math.max(1, Math.round(healed))}`,
        color: '#a5d6a7',
        lifetimeSec: 1.2,
        risePx: tile * 0.9,
        spreadXPx: tile * 0.35,
        baseYOffsetPx: tile * 0.9,
        getPosition: () => ({ x: zombie.x, y: zombie.y })
      });
    }
    this.updateZombieInfoPanel();
  }
  private onStructureDamaged = ({ structureId, amount, remainingHp }: StructureDamagedEvent): void => {
    const wall = this.walls.find((w) => w.id === structureId);
    if (!wall) return;

    wall.hp = Math.max(0, remainingHp);

    if (this.selectedWallId === structureId) {
      const salvage = this.makeWallSalvage(wall);
      this.nodePanel?.setWall(wall, salvage);
    }

    const dealt = Math.max(0, Math.floor(amount ?? 0));
    if (dealt > 0) {
      const tile = this.cfg.getGame().tileSize;
      const baseOffset = (wall.heightPx / 2) + Math.max(12, tile * 0.3);
      const spread = Math.max(tile * 0.2, wall.widthPx * 0.25);
      this.combatText.spawn({
        text: `-${dealt}`,
        color: '#ff8a65',
        lifetimeSec: 1.6,
        risePx: tile,
        spreadXPx: spread,
        baseYOffsetPx: baseOffset,
        getPosition: () => ({ x: wall.x, y: wall.y })
      });
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


  private onExperienceChanged = (state: PlayerExperienceChangedEvent): void => {
    this.experienceOverlay.update(state, this.showExperienceNumbers);
  };

  private onPlayerLevelUp = (event: PlayerLevelUpEvent): void => {
    this.levelUpQueue.push(event);
    this.processLevelUpQueue();
  };

  private processLevelUpQueue(): void {
    if (this.levelUpPaused) return;
    const next = this.levelUpQueue.shift();
    if (!next) return;
    this.levelUpPaused = true;
    this.levelUpOverlay.show(next.cards, (cardId) => {
      this.experience.applyLevelUpSelection(cardId);
      this.levelUpPaused = false;
      this.processLevelUpQueue();
    });
  }

  private onZombieKilled = ({ kind, x, y }: ZombieKilledEvent): void => {
    this.experience.spawnOrbForZombie(kind, x, y);
  };

  private refreshExperienceOverlay(): void {
    this.experienceOverlay.update(this.experience.getState(), this.showExperienceNumbers);
  }

  private onZombieDamaged = ({ zombieId, amount, x, y }: ZombieDamagedEvent): void => {
    const dealt = Math.max(0, Math.floor(amount ?? 0));
    if (dealt <= 0) return;
    const tile = this.cfg.getGame().tileSize;
    const zombie = this.zombies.getZombies().find((z) => z.id === zombieId) ?? null;
    this.combatText.spawn({
      text: `-${dealt}`,
      color: '#ef5350',
      lifetimeSec: 1.5,
      risePx: tile,
      spreadXPx: tile * 0.35,
      baseYOffsetPx: tile * 0.9,
      getPosition: zombie ? () => ({ x: zombie.x, y: zombie.y }) : undefined,
      position: zombie ? undefined : { x, y }
    });
  };





  private onPlayerDamaged = ({ amount }: PlayerDamagedEvent): void => {
    if (this.gameOver) return;
    const dealt = Math.max(0, Math.floor(amount ?? 0));
    if (dealt <= 0) return;
    const tile = this.cfg.getGame().tileSize;
    this.combatText.spawn({
      text: `-${dealt}`,
      color: '#ff6060',
      lifetimeSec: 2.0,
      risePx: tile * 1.2,
      spreadXPx: tile * 0.25,
      baseYOffsetPx: tile * 1.1,
      getPosition: () => ({ x: this.player.x, y: this.player.y })
    });
  };



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
    this.combatText.clear();
    this.gameOverOverlay.show(killerId);
  };

  private resetRun = (): void => {
    window.location.reload();
  };

  private completeDeconstruct(wall: Wall): void {
    const salvage = this.makeWallSalvage(wall);
    const tile = this.cfg.getGame().tileSize;
    const summaryParts: string[] = [];
    for (const [resource, amount] of Object.entries(salvage)) {
      const refunded = Math.max(0, Math.floor(amount ?? 0));
      if (refunded <= 0) continue;
      this.inventory.add(resource, refunded);
      summaryParts.push(`${refunded} ${resource}`);
      this.combatText.spawn({
        text: `+${refunded} ${resource}`,
        color: '#81c784',
        lifetimeSec: 1.4,
        risePx: tile,
        spreadXPx: tile * 0.3,
        baseYOffsetPx: tile,
        getPosition: () => ({ x: this.player.x, y: this.player.y })
      });
    }
    this.bus.emit<StructureDestroyedEvent>('StructureDestroyed', { structureId: wall.id, attackerId: this.player.id });
    const hintSec = Number(((this.cfg.getGame() as any).ui?.hintSec ?? 2));
    if (summaryParts.length > 0) {
      this.hud.setHint(`Recovered ${summaryParts.join(', ')}`);
      this.hintTimer = hintSec;
    } else if (hintSec > 0) {
      this.hud.setHint(`${wall.kind} dismantled`);
      this.hintTimer = hintSec;
    }
  }

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

  private loadBuildBlueprints(): void {
    if (!this.structureBuilder) {
      this.buildBlueprints = [];
      this.buildSelectedIndex = 0;
      this.buildSelectedBlueprintId = null;
      return;
    }
    const list = [...this.structureBuilder.getBlueprints()].sort((a, b) => a.label.localeCompare(b.label));
    this.buildBlueprints = list;
    if (list.length === 0) {
      this.buildSelectedIndex = 0;
      this.buildSelectedBlueprintId = null;
      return;
    }
    const currentIndex = list.findIndex((bp) => bp.id === this.buildSelectedBlueprintId);
    this.buildSelectedIndex = currentIndex >= 0 ? currentIndex : 0;
    this.buildSelectedBlueprintId = list[this.buildSelectedIndex].id;
    if (this.buildMenuVisible) {
      const options = this.getBuildMenuOptions();
      this.buildMenu.update(options, this.buildSelectedBlueprintId ?? '');
    }
  }

  private getBuildMenuOptions(): BuildRadialOption[] {
    return this.buildBlueprints.map((bp) => ({
      id: bp.id,
      label: bp.label,
      cost: bp.cost,
      buildTimeSec: bp.buildTimeSec,
      noisePerSec: bp.noisePerSec,
      affordable: this.canAffordStructure(bp.cost)
    }));
  }

  private getSelectedBlueprint(): StructureBlueprint | null {
    if (this.buildBlueprints.length === 0) return null;
    const index = Math.max(0, Math.min(this.buildBlueprints.length - 1, this.buildSelectedIndex));
    return this.buildBlueprints[index] ?? null;
  }

  private cycleBlueprint(delta: number): void {
    if (this.buildBlueprints.length === 0) return;
    const count = this.buildBlueprints.length;
    this.buildSelectedIndex = (this.buildSelectedIndex + delta + count) % count;
    this.buildSelectedBlueprintId = this.buildBlueprints[this.buildSelectedIndex].id;
    this.buildPreviewSuppressed = false;
  }

  private updateBuildMenu(): void {
    if (!this.buildMenu) return;
    const hasBlueprints = this.buildBlueprints.length > 0;
    if (!hasBlueprints) {
      if (this.buildMenuVisible) {
        this.buildMenu.hide();
        this.buildMenuVisible = false;
      }
      return;
    }

    let selectionChanged = false;
    if (this.input.consumeBuildCycleNext()) {
      this.cycleBlueprint(1);
      selectionChanged = true;
    }
    if (this.input.consumeBuildCyclePrev()) {
      this.cycleBlueprint(-1);
      selectionChanged = true;
    }

    const held = this.input.isBuildMenuHeld();
    const selected = this.getSelectedBlueprint();
    const options = this.getBuildMenuOptions();

    if (held) {
      if (!this.buildMenuVisible) {
        this.buildMenuVisible = true;
        this.buildMenu.show(options, selected?.id ?? '');
        this.buildPreviewSuppressed = false;
      } else if (selectionChanged) {
        this.buildMenu.update(options, selected?.id ?? '');
      } else {
        this.buildMenu.update(options, selected?.id ?? '');
      }
    } else if (this.buildMenuVisible) {
      this.buildMenu.hide();
      this.buildMenuVisible = false;
    }
  }

  private updateBuildPreview(): void {
    const blueprint = this.getSelectedBlueprint();
    if (!blueprint) {
      this.buildPreview.active = false;
      return;
    }
    if (this.buildMenuVisible || this.buildPreviewSuppressed) {
      this.buildPreview.active = false;
      this.buildPreview.blueprintId = blueprint.id;
      if (this.buildPreviewSuppressed) this.buildPreviewSuppressed = false;
      return;
    }
    const tileSize = this.cfg.getGame().tileSize;
    const totalTilesX = Math.max(1, Math.floor(this.worldW / tileSize));
    const totalTilesY = Math.max(1, Math.floor(this.worldH / tileSize));
    const footprint = Math.max(1, blueprint.footprintTiles);
    const clampX = Math.max(0, totalTilesX - footprint);
    const clampY = Math.max(0, totalTilesY - footprint);
    const rawTileX = Math.floor(this.mouseWorld.x / tileSize);
    const rawTileY = Math.floor(this.mouseWorld.y / tileSize);
    const tileX = Math.min(clampX, Math.max(0, rawTileX));
    const tileY = Math.min(clampY, Math.max(0, rawTileY));
    const centerX = (tileX + footprint / 2) * tileSize;
    const centerY = (tileY + footprint / 2) * tileSize;
    const halfSize = (footprint * tileSize) / 2;
    const valid = this.isPlacementValid(tileX, tileY, footprint, centerX, centerY, halfSize);
    this.buildPreview = {
      active: true,
      blueprintId: blueprint.id,
      centerX,
      centerY,
      halfSize,
      tileX,
      tileY,
      valid
    };
  }

  private isPlacementValid(tileX: number, tileY: number, footprint: number, centerX: number, centerY: number, halfSize: number): boolean {
    const tileSize = this.cfg.getGame().tileSize;
    const totalTilesX = Math.max(1, Math.floor(this.worldW / tileSize));
    const totalTilesY = Math.max(1, Math.floor(this.worldH / tileSize));
    if (tileX < 0 || tileY < 0 || tileX + footprint > totalTilesX || tileY + footprint > totalTilesY) return false;
    for (const wall of this.walls) {
      const hw = wall.widthPx / 2;
      const hh = wall.heightPx / 2;
      const overlapX = Math.abs(centerX - wall.x) < halfSize + hw;
      const overlapY = Math.abs(centerY - wall.y) < halfSize + hh;
      if (overlapX && overlapY) return false;
    }
    for (const crate of this.storageCrates) {
      const half = crate.sizePx / 2;
      const overlapX = Math.abs(centerX - crate.x) < halfSize + half;
      const overlapY = Math.abs(centerY - crate.y) < halfSize + half;
      if (overlapX && overlapY) return false;
    }
    for (const node of this.resources.getNodes()) {
      const half = node.radiusPx;
      const overlapX = Math.abs(centerX - node.x) < halfSize + half;
      const overlapY = Math.abs(centerY - node.y) < halfSize + half;
      if (overlapX && overlapY) return false;
    }
    return true;
  }

  private handleBuildPlacement(): boolean {
    const blueprint = this.getSelectedBlueprint();
    if (!blueprint) return false;
    if (!this.buildPreview.active || !this.buildPreview.valid) return false;
    if (!this.canAffordStructure(blueprint.cost)) {
      const missing = this.describeMissingResources(blueprint.cost);
      const hintSec = Number(((this.cfg.getGame() as any).ui?.hintSec ?? 2));
      this.hud.setHint(missing ? `Need ${missing}` : 'Insufficient resources');
      this.hintTimer = hintSec;
      return false;
    }
    this.spendStructureCost(blueprint.cost);
    this.queueBuildPlacement(blueprint, this.buildPreview.tileX, this.buildPreview.tileY);
    return true;
  }

  private queueBuildPlacement(blueprint: StructureBlueprint, tileX: number, tileY: number): void {
    if (!this.structureBuilder) return;
    const structureId = `struct-${this.nextStructureId++}`;
    const structure = this.structureBuilder.createStructureInstance(blueprint.id, structureId) as Wall;
    structure.setGridPosition(tileX, tileY);
    structure.playerBuilt = true;
    structure.isOpen = false;
    if (this.instantBuild) {
      structure.state = 'completed';
      structure.buildProgressSec = structure.buildTimeSec;
      structure.hp = structure.maxHp;
    } else {
      structure.beginConstruction();
    }
    this.walls.push(structure);
    this.buildPreviewSuppressed = true;
    this.buildPreview.active = false;
    const hintSec = Number(((this.cfg.getGame() as any).ui?.hintSec ?? 2));
    this.hud.setHint(`${blueprint.label} placement started`);
    this.hintTimer = hintSec;
  }

  private canAffordStructure(cost: Record<string, number>): boolean {
    if (this.freeBuild) return true;
    for (const [resource, amount] of Object.entries(cost)) {
      const need = Math.max(0, amount);
      if (need === 0) continue;
      const available = this.storedTotals[resource] ?? 0;
      if (available < need) return false;
    }
    return true;
  }

  private spendStructureCost(cost: Record<string, number>): boolean {
    if (this.freeBuild) return true;
    if (!this.canAffordStructure(cost)) return false;
    for (const [resource, amount] of Object.entries(cost)) {
      const need = Math.max(0, amount);
      if (need === 0) continue;
      const current = this.storedTotals[resource] ?? 0;
      this.storedTotals[resource] = Math.max(0, current - need);
    }
    return true;
  }

  private describeMissingResources(cost: Record<string, number>): string {
    if (this.freeBuild) return '';
    for (const [resource, amount] of Object.entries(cost)) {
      const need = Math.max(0, amount);
      if (need === 0) continue;
      const have = this.storedTotals[resource] ?? 0;
      if (have < need) {
        return `${need - have} ${resource}`;
      }
    }
    return '';
  }

  private cancelBuildPlacementMode(): void {
    this.buildPreviewSuppressed = true;
    this.buildPreview.active = false;
  }

  private onCanvasMouseMove = (e: MouseEvent): void => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = this.engine.screenToWorld(sx, sy);
    this.mouseWorld.x = world.x;
    this.mouseWorld.y = world.y;
  };

  private onCanvasMouseDown = (e: MouseEvent): void => {
    if (e.button === 2) {
      e.preventDefault();
      this.cancelBuildPlacementMode();
    }
  };

  private onCanvasContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    this.cancelBuildPlacementMode();
  };

  private onCanvasClick = (e: MouseEvent): void => {
    if (e.button !== 0 || !this.canvasEl) return;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = this.engine.screenToWorld(sx, sy);
    this.mouseWorld.x = world.x;
    this.mouseWorld.y = world.y;

    if (!this.buildMenuVisible && this.buildPreview.active && this.buildPreview.valid) {
      if (this.handleBuildPlacement()) {
        e.preventDefault();
        return;
      }
    }
    if (this.buildMenuVisible) return;

    const zs = this.zombies?.getZombies?.() ?? [];
    let pickedZombie: Zombie | null = null;
    let bestZd2 = Number.POSITIVE_INFINITY;
    for (const z of zs as any) {
      const dx = z.x - world.x;
      const dy = z.y - world.y;
      const d2 = dx * dx + dy * dy;
      const r = this.cfg.getGame().tileSize * 0.3;
      if (d2 <= r * r && d2 < bestZd2) {
        bestZd2 = d2;
        pickedZombie = z as Zombie;
      }
    }
    if (pickedZombie) {
      this.selectedZombieId = pickedZombie.id;
      this.selectedNodeId = null;
      this.selectedWallId = null;
      this.nodePanel?.setNode(null);
      this.updateZombieInfoPanel();
      return;
    }

    let wallPicked: Wall | null = null;
    for (const w of this.walls) {
      if (w.containsPoint(world.x, world.y)) {
        wallPicked = w;
        break;
      }
    }
    if (wallPicked) {
      this.selectedWallId = wallPicked.id;
      this.selectedNodeId = null;
      const buildables = this.cfg.getBuildables() as any;
      const salvagePct = Number((buildables?.globals?.salvageRefundPct ?? 50) / 100);
      const cost = wallPicked.cost ?? {};
      const salv: Record<string, number> = {};
      for (const [k, v] of Object.entries(cost)) salv[k] = Math.floor((v ?? 0) * salvagePct);
      this.nodePanel?.setWall(wallPicked, salv);
      return;
    }

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
  };
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
























