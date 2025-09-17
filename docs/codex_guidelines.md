# Codex-Friendly Development Guidelines

**Version:** v0.1  
**Date:** 2025-09-15  

This document provides **guidelines for structuring and coding the Cat & Mouse Zombie game** so that both **human developers** and **AI models (specifically Codex)** can contribute effectively.

---

## 1. File & Class Design
- Keep files **short (≤200 LOC)** and responsibilities focused.  
- Favor **interfaces + small classes** over deep inheritance chains.  
- Place **one behavior per file** (e.g., NoiseMath vs NoiseSystem).  
- Avoid cyclical dependencies; use `/core/queries` for read-only helpers.

---

## 2. TypeScript Practices
- Avoid advanced TypeScript tricks (conditional/variadic types).  
- Add **explicit return types** for all public functions.  
- Export minimal surfaces (interfaces and types only).  
- Prefer **composition and injection** over deep subclassing.

---

## 3. Config-Driven Development
- All numbers/settings live in `*.json5` configs.  
- Use **one key per behavior** (e.g., `noisePerBurst`, `noisePerTick`).  
- Add **inline comments with units** inside JSON5.  
- Provide `/config/examples/` with alternative balance sets.

---

## 4. Testing Requirements
- Write **golden tests** for math (attenuation, XP curve).  
- Add **contract tests** to validate JSON config schemas.  
- Include **snapshot tests** for event sequences.  
- Tests help Codex replicate logic correctly.

---

## 5. Repo Conventions for AI Tasks
Add an **`/ai_tasks/`** folder with task templates:
```
/ai_tasks/
  001-noise-attenuation.md
  002-build-placement-collisions.md
/templates/
  task.md
  test_case.md
  pr_description.md
```

Each task includes:
- Goal (one sentence)  
- Files to edit (max 2–3)  
- Config keys touched  
- Acceptance tests  
- Out-of-scope notes

---

## 6. Coding Style & Documentation
- Keep ESLint rules simple; include a `.eslintrc.ci.json` for CI-friendly checks.  
- Every file starts with a docstring block:

```ts
/**
 * Responsibility: <one line>
 * Publishes: EventNameA, EventNameB
 * Subscribes: EventNameC
 * Config: buildables.machines.FlameVent.*
 * Notes: units in tiles/second; no per-frame config reads
 */
```

---

## 7. Example: Turret Inheritance
```ts
abstract class TurretBase extends Entity {
  protected abstract get dataKey(): `machines.${string}`;
  protected stats!: TurretStats;
  constructor(id: string, bus: EventBus, cfg: ConfigService) {
    super(id);
    this.stats = cfg.getBuildables().getByPath(this.dataKey);
  }
}
export class AutoTurret extends TurretBase {
  protected get dataKey() { return "machines.AutoTurret"; }
}
```

Children only override **`dataKey`**, minimizing AI editing errors.

---

## 8. System Boundaries
- Introduce interfaces like `IEntityQuery.findEnemiesInCircle(x,y,r)`.  
- Codex edits the **interface consumer**, not the implementation.  
- Rendering is isolated under `/engine/`, mapping `Entity → View`.

---

## 9. Milestone Adjustments for Codex
- Add **Milestone 0.5: CI & Tests** before systems.  
- Split complex features (e.g., Machines v1 → Oil only, then Flame).  
- Add a **"Run tests" checkbox** to each milestone.

---

## 10. Checklists in PRs
Every AI patch must confirm:
- [ ] Added/updated unit tests  
- [ ] No hardcoded numbers (all from config)  
- [ ] Updated file header docstrings  
- [ ] Passed `npm run lint && npm run test`  

---

## 11. Debugging & Logging
- Use bounded logging keys (e.g., `logNoisePulse(x,y,amount)`).  
- Provide a `logger.ts` helper; Codex reuses consistently.

---

## 12. RNG & Determinism
- Centralize RNG in `RNG.ts` with a seed from config.  
- Codex must use `RNG.random()` instead of `Math.random()`.  
- Ensures reproducibility for tests and debugging.

---

## 13. JSON5 Example
```json5
"FlameVent": {
  // degrees; used in cone hit test
  "coneDeg": 45,
  // seconds the flame is active
  "burstSec": 1,
  // damage per second while active
  "dps": 20,
}
```

---

## 14. Example Prompt for AI
**Good:**  
> Implement cone hit test in `Geometry.ts`. Inputs: origin(x,y), angleRad, halfAngleRad, target(x,y). Return boolean. Use radians; no allocations. Add tests with ±0.01 rad tolerance.

**Bad:**  
> Make cones work like a real game.

---

## 15. Folder Additions
```
/core/queries/   # pure read-only queries
/core/utils/     # math + helpers (ObjectPool, Stopwatch)
```

---

## TL;DR for Codex
- Keep code small, explicit, and modular.  
- Push all numbers into JSON5 configs with comments.  
- Always propose tests first.  
- Use docstrings + checklists to reduce errors.  
- Provide narrow, well-scoped AI tasks.

