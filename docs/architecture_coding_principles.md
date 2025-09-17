# Cat & Mouse Zombie — Architecture & Coding Principles (Web)

**Version:** v0.1  
**Date:** 2025-09-15  
**Target:** Web (Desktop)  
**Language:** **TypeScript** (strict mode) + DOM/Web APIs  
**Renderer:** PixiJS **or** Phaser 3 (choose one at bootstrap; examples show engine-agnostic patterns)  
**Build Tooling:** Vite + ESLint (airbnb-ish) + Prettier + Vitest + Typedoc  
**Style:** **Object-Oriented & Modular**, **Data-Driven via JSON/JSON5**. No core gameplay constants hardcoded in classes.

---

## 1) Architectural Goals
1. **Data-Driven Tuning:** All tunables live in JSON/JSON5 under `/config`. Code reads, validates, and caches them.  
2. **Composable OOP:** Clear base classes + light mixins for shared behaviors (Damageable, NoiseEmitter, Harvestable).  
3. **Engine Agnostic Core:** Game rules, systems, and data parsing do **not** depend on rendering engine. A thin adapter layer (Pixi/Phaser) maps Entities → Sprites.  
4. **Deterministic & Testable:** Systems are pure where possible; tick-based updates with explicit inputs.  
5. **Separation of Concerns:** Core systems (Noise, AI, Resources, Buildables) are independent modules communicating via an **Event Bus**.  
6. **Async-Friendly:** Asset loading and config fetching via async loaders with schema validation.  
7. **Human + AI Friendly:** Small files, single-responsibility classes, consistent naming, and TSDoc comments everywhere.  
8. **Placeholder Art First:** Simple shapes and colors from a shared palette; assets can be swapped without touching logic.

---

## 2) Project Layout
```
/src
  /app
    GameApp.ts            # bootstraps engine adapter, systems, and main loop
    EngineAdapter.ts      # interface + concrete Pixi/Phaser adapters
    EventBus.ts           # global event system
    DIContainer.ts        # lightweight dependency injection (service locator)

  /config                 # JSON/JSON5, no code
    game.json5            # global toggles, day/night lengths, scaling
    resources.json5       # node capacities, throttle noise, spawn rules
    buildables.json5      # traps/machines stats, costs, cooldowns
    enemies.json5         # enemy archetypes, thresholds, speeds
    perks.json5           # perk pool
    loot.json5            # XP orbs, drop rates

  /core
    /data
      ConfigService.ts    # loads & validates JSON; exposes typed getters
      Schema.ts           # zod/json-schema definitions
      RNG.ts              # seedable random utilities
    /math
      Grid.ts             # grid coords, AABB utilities
      Pathing.ts          # flow-field or A* wrappers
      Geometry.ts         # circles, LOS, attenuation math
    /systems
      TimeSystem.ts       # day/night/eclipse timelines
      NoiseSystem.ts      # centralized noise propagation & queries
      SpawnSystem.ts      # zombie spawners
      CombatSystem.ts     # damage, DoT, ignite, slows
      ResourceSystem.ts   # node lifecycle (deplete/respawn), harvesting
      BuildSystem.ts      # placement rules, costs, salvaging, upgrades
      InventorySystem.ts  # carry capacity, auto-deposit
      XPSystem.ts         # orbs, level curve, card draws
      AISystem.ts         # state machines (Wander, Investigate, Search, Chase)
      SaveSystem.ts       # (optional) run persistence
    /interfaces            # pure TS types/interfaces
      IUpdatable.ts
      INoiseEmitter.ts
      IDamageable.ts
      IHarvestable.ts
      IBuildable.ts
      IAgent.ts
    /entities
      Entity.ts           # base entity (id, pos, update, tags)
      Actor.ts            # things that move (player, zombies)
      Player.ts
      enemies/
        Enemy.ts          # base enemy
        Shambler.ts
        Runner.ts
        Howler.ts
        Brute.ts
      buildables/
        Buildable.ts      # base buildable (placeable)
        TurretBase.ts     # parent class for all turrets (see §5.2)
        AutoTurret.ts
        FlameVent.ts
        TeslaCoil.ts
        SpikeFloor.ts
        BearTrap.ts
        WireSnare.ts
        OilEmitter.ts
        DecoySpeaker.ts
        CollectorDrone.ts
        RepairBot.ts
      world/
        StorageCrate.ts
        Wall.ts
        Gate.ts
        ResourceNode.ts

  /engine                  # thin render/input layers
    /pixi
      PixiEngine.ts
      PixiEntityView.ts
      PixiFactory.ts       # maps entity types → display objects
    /phaser
      PhaserEngine.ts
      PhaserEntityView.ts
      PhaserFactory.ts
    input/
      InputController.ts   # WASD, crouch, sprint, build, etc.

  /ui
    HUD.ts                 # Noise meter, timers, resources
    LevelUpModal.ts
    BuildWheel.ts
    NodePanel.ts
    DebugOverlay.ts

/tests                     # unit tests per system
/public                    # index.html, placeholder assets
```

---

## 3) Coding Principles

### 3.1 OOP + Composition
- **Base classes:** `Entity`, `Actor`, `Buildable`, `Enemy`, `TurretBase`.  
- **Interfaces:** behaviors expressed as `INoiseEmitter`, `IDamageable`, `IHarvestable`, `IBuildable`.  
- **Mixins/Traits:** optional helpers (`WithCooldown`, `WithHealth`, `WithAmmo`).  
- **Factories:** Entities created by `EntityFactory` (reads from config; never `new` scattered in code).

### 3.2 Data-Driven Everything
- All numeric values (HP, DPS, costs, cooldowns, noise, capacities, thresholds, speeds) live in JSON/JSON5.  
- Classes **read** values via `ConfigService` at construction/update.  
- **No hardcoded constants** beyond invariants (e.g., tile size).  
- Use **Zod** (or JSON Schema) to validate configs at load; fail fast with readable errors.

### 3.3 Update Loop & Determinism
- Central `GameApp.update(dt)` ticks all systems in a fixed order:  
  1) Input → 2) Time → 3) Spawns → 4) AI → 5) Resource/Build → 6) Combat → 7) Noise → 8) XP/Score → 9) Render adapter.  
- Systems operate on entity lists via **queries** (light ECS flavor, but kept OOP).  
- Keep random calls centralized in `RNG` with seed control for repeatable tests.

### 3.4 Event Bus
- Discrete domain events: `NodeDepleted`, `NoisePulse`, `EnemyStateChanged`, `TrapTriggered`, `StructureDamaged`, `LevelGained`, `HordeSpawned`.  
- Systems subscribe/publish; loose coupling between modules.  
- Bus is synchronous per frame to preserve determinism.

### 3.5 Rendering Adapter
- **Engine adapter** exposes: `createView(entity)`, `destroyView(entity)`, `updateView(entity)`.  
- Placeholder art: rectangles, circles, lines; color tokens from a palette map.  
- Swapping Pixi ↔ Phaser requires only adapter changes.

### 3.6 Documentation & Style
- **TSDoc** for all public classes/methods.  
- ESLint + Prettier enforce consistency.  
- 1 class per file, ≤ 200–250 LOC guideline; SRP (single responsibility).  
- Unit tests for math/system logic; smoke tests for event flow.

---

## 4) Config Files (JSON5) — Schemas & Examples

### 4.1 `game.json5`
```json5
{
  "tileSize": 32,
  "dayNight": { "daySec": 120, "nightSec": 90, "eclipseSec": 180, "eclipseEvery": 3 },
  "scaling": {
    "night": { "spawnRatePctPerDay": 10, "hpPctPerDay": 4, "speedPctPerDay": 2 },
    "day": { "densityPctPerDay": 5 }
  },
  "player": {
    "hp": 100,
    "walkSpeed": 3.6,
    "crouchSpeed": 2.0,
    "sprintSpeed": 5.0,
    "pushCooldownSec": 5,
    "carryCap": 40
  },
  "storage": { "autoDepositRadius": 2 },
  "horde": { "noiseThreshold": 70, "sustainSec": 4, "cooldownSec": 30 }
}
```

### 4.2 `resources.json5`
```json5
{
  "nodes": {
    "ScrapHeap": { "capacityMin": 80, "capacityMax": 140, "respawnSecMin": 60, "respawnSecMax": 90, "threatWeight": 1.0 },
    "LumberStack": { "capacityMin": 80, "capacityMax": 140, "respawnSecMin": 60, "respawnSecMax": 90, "threatWeight": 1.0 },
    "ChemDrum":   { "capacityMin": 60, "capacityMax": 110, "respawnSecMin": 70, "respawnSecMax": 100, "threatWeight": 1.2 },
    "CrystalVein":{ "capacityMin": 40, "capacityMax": 80, "respawnSecMin": 90, "respawnSecMax": 120, "threatWeight": 1.6, "nightOnly": true }
  },
  "throttles": {
    "Quiet":  { "ratePerSec": 0.5, "noisePerSec": 0.15 },
    "Normal": { "ratePerSec": 1.0, "noisePerSec": 0.4 },
    "Loud":   { "ratePerSec": 1.6, "noisePerSec": 0.9, "clankChancePer5s": 0.1, "clankNoisePulse": 1.5, "clankCapacityPenalty": 10 }
  },
  "weights": { "Scrap": 1, "Wood": 1, "Chem": 1, "Crystal": 3 }
}
```

### 4.3 `buildables.json5`
```json5
{
  "globals": { "salvageRefundPct": 50 },
  "traps": {
    "SpikeFloor": { "cost": { "Scrap": 6, "Wood": 4 }, "dps": 6, "noise": 0 },
    "BearTrap":   { "cost": { "Scrap": 6, "Chem": 2 }, "rootSec": 2, "rearmCost": { "Scrap": 2 }, "noise": 0 },
    "WireSnare":  { "cost": { "Scrap": 4 }, "slowPct": 60, "slowSec": 2, "noise": 0 },
    "OilEmitter": { "cost": { "Wood": 4, "Chem": 6 }, "radius": 2, "slowPct": 40, "igniteTag": "Fire", "noise": 0.1 }
  },
  "machines": {
    "FlameVent": { "cost": { "Scrap": 8, "Chem": 12 }, "coneDeg": 45, "burstSec": 1, "dps": 20, "igniteDotDps": 6, "igniteDotSec": 3, "cooldownSec": 2.5, "noisePerBurst": 1.5 },
    "TeslaCoil": { "cost": { "Scrap": 10, "Crystal": 4 }, "radius": 2, "tickSec": 0.5, "dpsPerTick": 4, "slowPct": 25, "noisePerTick": 0.3 },
    "AutoTurret":{ "cost": { "Scrap": 12, "Wood": 4 }, "rangeTiles": 4, "shotsPerSec": 3, "ammoPerScrap": 12, "burstNoise": 1.2 }
  },
  "utility": {
    "DecoySpeaker": { "cost": { "Scrap": 8, "Chem": 2 }, "pulseNoise": 2.0, "pulseSec": 4 },
    "CollectorDrone": { "cost": { "Crystal": 6, "Scrap": 6 }, "radiusTiles": 6, "noisePerSweep": 0.1, "maxActive": 1 },
    "RepairBot": { "cost": { "Scrap": 8, "Crystal": 4 }, "radiusTiles": 6, "hpPerTick": 3, "tickSec": 0.25, "noisePerTick": 0.05 }
  },
  "fort": {
    "Wall": { "cost": { "Wood": 4 }, "hp": 200 },
    "ReinforcedWall": { "cost": { "Wood": 4, "Scrap": 4 }, "hp": 350 },
    "Gate": { "cost": { "Wood": 4 }, "hp": 200, "playerOnly": true }
  }
}
```

### 4.4 `enemies.json5`
```json5
{
  "Shambler": { "hp": 40, "speed": 1.6, "hearingThresholdDay": 0.25, "hearingThresholdNight": 0.20, "investigatePatienceSec": 6 },
  "Runner":   { "hp": 70, "speed": 3.2, "hearingThresholdDay": 0.20, "hearingThresholdNight": 0.15, "investigatePatienceSec": 3 },
  "Howler":   { "hp": 80, "speed": 2.6, "hearingThresholdDay": 0.18, "hearingThresholdNight": 0.14, "pingAggroTiles": 8, "pingSec": 4 },
  "Brute":    { "hp": 250, "speed": 1.8, "structureDamageBonusPct": 50, "slowResistPct": 25 }
}
```

### 4.5 `perks.json5`
```json5
{
  "perks": [
    { "id": "QuietHands", "effect": { "harvestNoisePct": -30 } },
    { "id": "SoftSteps", "effect": { "walkNoisePct": -25, "sprintNoisePct": -25 } },
    { "id": "MagnetHands", "effect": { "pickupRadiusTiles": +2 } },
    { "id": "PackMule", "effect": { "carryCap": +10 } },
    { "id": "FieldTech", "effect": { "buildSpeedPct": +25, "repairSpeedPct": +25 } },
    { "id": "DecoySpecialist", "effect": { "decoyLurePct": +30, "decoyCooldownPct": -20 } }
  ]
}
```

---

## 5) Core Class Sketches (TypeScript)

### 5.1 Base Entity & Services
```ts
// Entity.ts
export abstract class Entity {
  constructor(public readonly id: string) {}
  x = 0; y = 0; rotation = 0;
  tags: Set<string> = new Set();
  abstract update(dt: number): void;
}
```

```ts
// ConfigService.ts
export class ConfigService {
  private cache = new Map<string, unknown>();
  async loadAll() { /* fetch, validate with zod, fill cache */ }
  getGame() { /* typed return */ }
  getBuildables() { /* typed return */ }
  // etc.
}
```

### 5.2 Turret Inheritance (Parent → Variants)
```ts
// buildables/TurretBase.ts
export abstract class TurretBase extends Entity {
  protected rangeTiles!: number;
  protected shotsPerSec!: number;
  protected ammoPerScrap!: number;
  protected burstNoise!: number;

  protected ammo: number = 0;
  protected cooldown: number = 0;

  constructor(id: string, protected bus: EventBus, protected cfg: ConfigService) {
    super(id);
    const data = cfg.getBuildables().machines.AutoTurret; // parent default; child can override key
    this.rangeTiles = data.rangeTiles;
    this.shotsPerSec = data.shotsPerSec;
    this.ammoPerScrap = data.ammoPerScrap;
    this.burstNoise = data.burstNoise;
  }

  loadAmmo(scrapUnits: number) { this.ammo += scrapUnits * this.ammoPerScrap; }

  protected acquireTarget(): Enemy | null { /* query AISystem for closest in range */ return null; }

  protected fire(dt: number) {
    if (this.cooldown > 0 || this.ammo <= 0) return;
    const t = this.acquireTarget();
    if (!t) return;
    // spawn projectile or instant hit per engine adapter
    this.ammo--;
    this.cooldown = 1 / this.shotsPerSec;
    this.bus.emit('NoisePulse', { source: this, amount: this.burstNoise });
    this.bus.emit('Hit', { target: t, source: this, damage: this.getDamage() });
  }

  protected abstract getDamage(): number;

  update(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.fire(dt);
  }
}
```

```ts
// buildables/AutoTurret.ts
export class AutoTurret extends TurretBase {
  protected getDamage(): number {
    return 5; // read from config if different variant; or override data key in ctor
  }
}
```

```ts
// buildables/FlameVent.ts (non-turret sample, still data-driven)
export class FlameVent extends Entity {
  private cd = 0;
  constructor(id: string, private bus: EventBus, private cfg: ConfigService) {
    super(id);
  }
  update(dt: number) {
    const data = this.cfg.getBuildables().machines.FlameVent;
    this.cd = Math.max(0, this.cd - dt);
    if (this.cd === 0) {
      // cone damage & ignite
      this.bus.emit('NoisePulse', { source: this, amount: data.noisePerBurst });
      this.cd = data.cooldownSec;
    }
  }
}
```

### 5.3 Resource Nodes & Throttles
```ts
// world/ResourceNode.ts
export class ResourceNode extends Entity {
  constructor(id: string, public type: string, private cfg: ConfigService, private bus: EventBus) {
    super(id);
    const { capacityMin, capacityMax } = cfg.getResources().nodes[type];
    this.capacity = RNG.range(capacityMin, capacityMax);
  }
  capacity: number;
  harvest(throttle: 'Quiet'|'Normal'|'Loud', dt: number): number {
    const t = this.cfg.getResources().throttles[throttle];
    const take = Math.min(this.capacity, t.ratePerSec * dt);
    this.capacity -= take;
    this.bus.emit('NoisePulse', { source: this, amount: t.noisePerSec * dt });
    if (this.capacity <= 0) this.bus.emit('NodeDepleted', { node: this });
    return take;
  }
  update(): void {}
}
```

### 5.4 Noise Attenuation (Centralized)
```ts
// systems/NoiseSystem.ts
export class NoiseSystem implements IUpdatable {
  private pulses: Array<{x:number;y:number;amount:number}> = [];
  constructor(private bus: EventBus) {
    bus.on('NoisePulse', ({ source, amount }) => {
      this.pulses.push({ x: source.x, y: source.y, amount });
    });
  }
  queryAt(x:number,y:number): number {
    // sum attenuated contributions
    return this.pulses.reduce((acc,p)=>{
      const d2 = (p.x-x)**2 + (p.y-y)**2;
      return acc + p.amount / (1 + d2 / 9);
    },0);
  }
  update(): void { this.pulses.length = 0; } // clear each frame
}
```

### 5.5 AI State Machine
```ts
// enemies/Enemy.ts
export abstract class Enemy extends Actor {
  state: 'Wander'|'Investigate'|'Search'|'Chase' = 'Wander';
  investigateTarget?: {x:number;y:number};
  update(dt: number) {
    const heard = this.senseNoise();
    if (this.canSeePlayer()) this.toChase();
    else if (heard >= this.threshold()) this.toInvestigate(heard);
    // move per state
  }
  protected abstract threshold(): number;
  protected senseNoise(): number { /* query NoiseSystem.queryAt(this.x,this.y) */ return 0; }
  protected canSeePlayer(): boolean { /* LOS checks */ return false; }
  protected toChase(){ this.state='Chase'; }
  protected toInvestigate(h:number){ this.state='Investigate'; }
}
```

---

## 6) Input & Build Flow
- `InputController` maps keyboard/mouse → **Commands** (`BeginHarvest`, `PlaceBuildable`, `Rotate`, `Salvage`, `Push`, `Crouch`, `Sprint`).  
- `BuildSystem` validates placement: grid snap, footprint, collisions, cost from config; updates Inventory on success; emits `BuildPlaced`.  
- `Salvage` refunds % from `buildables.globals.salvageRefundPct`.

---

## 7) Testing Strategy
- **Unit:** Math (attenuation, cone hits), NoiseSystem, ResourceNode depletion/respawn, Turret cooldown/ammo, AI transitions.  
- **Contract Tests:** Config validation with zod schemas and example JSON; fail on missing keys.  
- **Sim Tests:** Headless tick loop for 60s verifying no exceptions and reasonable event counts (e.g., first horde by T≈N).

---

## 8) Placeholder Art & Assets
- **Shapes:** rectangles (walls/turrets), triangles (flame cones), circles (nodes/zombies), lines (LOS).  
- **Color Tokens:** in `/config/theme.json5` mapping roles → hex (Player, Zombies, Traps, Nodes, NoisePulse).  
- **Swap Layer:** Only `engine/*` and `ui/*` should reference textures; logic never imports images directly.

---

## 9) Performance Notes (Web)
- Use single render layer for ground + batches for entities.  
- Object pools for enemies, orbs, projectiles.  
- Avoid per-entity allocation in `update`; reuse vectors.  
- Cap horde size; prefer crowd control over raw counts.  
- Use `requestAnimationFrame` with fixed-step accumulator for game logic.

---

## 10) Documentation Conventions
- File header block with: responsibility, collaborators, events published/subscribed, config keys used.  
- TSDoc for public API; examples for any nontrivial method.  
- Keep README per folder summarizing roles and key classes.  
- Auto-generate API docs via **Typedoc** to `/docs` on CI.

---

## 11) Security & Robustness
- Validate all config loads; default to safe values and log errors.  
- Guard against NaN/Infinity in physics and math.  
- Never trust user input coordinates; clamp to world.  
- Feature flags in `game.json5` for experimental content.

---

## 12) Minimal Bootstrap (Pseudo-code)
```ts
const app = new GameApp({
  engine: new PixiEngine(document.getElementById('game')!),
  cfg: new ConfigService(),
  bus: new EventBus()
});

await app.cfg.loadAll();
app.initSystems();  // registers systems with DI and event bus
app.loadScene('run01'); // spawners, storage, player
app.start();       // RAF loop with fixed-step ticks
```

---

## 13) Replacement Strategy (From Placeholder to Final)
1. Keep entity IDs and config keys **stable**.  
2. Replace shapes with sprites in the adapter factory; maintain anchor, footprint, and origin contracts.  
3. Gradually migrate collision masks if art changes sizes; update `Grid` tile size in `game.json5` only.

---

## 14) Ownership Map (Human vs AI-friendly)
- Humans: systems architecture, tuning goals, visual/feel polish.  
- AI: boilerplate entities, config migrations, docstrings, unit tests, data tables.  
- Pairing: create small, well-scoped issues per class or system; attach config keys to the ticket.

---

**End of Architecture & Coding Principles**
