# Cat & Mouse Zombie — Implementation Plan (MVP)

**Version:** v0.2 (with checkboxes)  
**Date:** 2025-09-15  

Each milestone includes **checkboxes** for both humans and AIs to mark progress.  
Run locally with `npm run dev` → open `http://localhost:5173`.

---

## Milestone 0 — Repo Bootstrap (Hello Grid)
- [x] Initialize repo with Vite + TypeScript template, ESLint, Prettier, Vitest, Typedoc  
- [x] Implement `GameApp`, `EngineAdapter`, fixed-step loop  
- [x] Draw grid background + player pawn (circle)  
- [x] Load `game.json5` (day/night) via `ConfigService`  

**Verify:**  
- [x] Grid + circle visible on localhost  
- [x] Debug overlay shows tick delta  

---

## Milestone 1 — Input & Camera (Move, Crouch, Sprint)
- [x] Add `InputController` for WASD/Ctrl/Shift  
- [x] Implement `Actor` + `Player` speeds from config  
- [x] Camera follow + clamped world bounds  

**Verify:**  
- [x] Walk/crouch/sprint speeds visible  
- [x] Config changes update speeds live  

---

## Milestone 2 — Time System (Day/Night/Eclipse UI)
- [x] Implement `TimeSystem` with cycle durations  
- [x] HUD: Day #, timer, noise meter (stub)  
- [x] Color tint for night  

**Verify:**  
- [x] Timer counts down; Eclipse every 3rd cycle  
- [x] Tint updates between day/night  

---

## Milestone 3 — Continuous Resource Nodes (Harvest)
- [x] Implement `ResourceSystem` + `ResourceNode`  
- [x] Load `resources.json5` (capacities, throttles)  
- [x] Node panel UI (toggle throttle)  
- [x] Capacity bar + `NodeDepleted` event  

**Verify:**  
- [x] Harvest works with Quiet/Normal/Loud  
- [x] Node despawns on depletion  

---

## Milestone 4 — Noise System & Investigate AI
- [ ] Implement `NoiseSystem` attenuation  
- [ ] Add `Enemy` + `Shambler` AI states  
- [ ] Harvest emits noise pulses  
- [ ] Visualize noise rings  

**Verify:**  
- [ ] Zombies investigate noise rings  
- [ ] JSON thresholds drive behavior  

---

## Milestone 5 — Build Placement v1 (Walls, Spikes)
- [ ] Implement `BuildSystem` (placement, cost, salvage)  
- [ ] Add Wall + Spike Floor placeholders  
- [ ] Add `StorageCrate` (auto deposit)  

**Verify:**  
- [ ] Build via wheel (Q), salvage (X)  
- [ ] Auto-deposit works within radius  

---

## Milestone 6 — Basic Combat (Spike, Player Health)
- [ ] Add `CombatSystem` ticks  
- [ ] Player takes contact damage  
- [ ] Spikes damage enemies → death + XP orbs  

**Verify:**  
- [ ] Zombies die on spikes  
- [ ] Player dies when HP=0  

---

## Milestone 7 — Runners, Howlers & Horde
- [ ] Implement `Runner` + `Howler` from JSON  
- [ ] Howler ping pulses aggro radius  
- [ ] Horde trigger on sustained noise  

**Verify:**  
- [ ] Horde spawns after threshold noise  
- [ ] Howler pulse affects zombies nearby  

---

## Milestone 8 — Machines v1 (Oil + Flame)
- [ ] Add Oil Emitter (slow) + Flame Vent (cone burst)  
- [ ] Implement Ignite combo (Oil+Fire)  
- [ ] Add noise pulses for Flame  

**Verify:**  
- [ ] Oil slows, Flame ignites → DoT  
- [ ] Noise spikes with Flame use  

---

## Milestone 9 — Auto Turret & Ammo
- [ ] Add `TurretBase` parent class  
- [ ] Add `AutoTurret` variant  
- [ ] Ammo loading from Scrap via UI  

**Verify:**  
- [ ] 1 Scrap = 12 shots from JSON  
- [ ] Loud bursts trigger hordes if abused  

---

## Milestone 10 — Decoy Speaker & Kiting
- [ ] Add Decoy Speaker with periodic pulses  
- [ ] Minimap shows pulse markers  
- [ ] Tutorial toast for decoy use  

**Verify:**  
- [ ] Zombies follow decoy pulses  
- [ ] Player can steer into killboxes  

---

## Milestone 11 — XP, Level-Up Cards, Perks
- [ ] Add `XPSystem` + orb drops  
- [ ] Level-up modal with card draws  
- [ ] Apply chosen perk modifiers live  

**Verify:**  
- [ ] Perks update stats (e.g., harvest noise)  
- [ ] All perks driven from `perks.json5`  

---

## Milestone 12 — Crystal Nodes & Storage Upgrades
- [ ] Spawn Crystal nodes (night only)  
- [ ] Add storage upgrade (radius buff)  
- [ ] Upgrade costs in Crystals  

**Verify:**  
- [ ] Crystal nodes appear at night  
- [ ] Storage radius expands after upgrade  

---

## Milestone 13 — Eclipse & Difficulty Scaling
- [ ] Implement Eclipse night (dark tint, buffs)  
- [ ] Spawn multipliers + hearing radius buffs  
- [ ] End recap screen (day survived, kills)  

**Verify:**  
- [ ] Eclipse every 3rd cycle works  
- [ ] Scaling from JSON reflects in-game  

---

## Milestone 14 — Debug & Sandbox
- [ ] Add DebugOverlay (~ toggle)  
- [ ] Sandbox panel (spawn, toggle, reroll)  
- [ ] Add SFX stubs (harvest, flame, turret)  

**Verify:**  
- [ ] Can spawn enemies + toggle states  
- [ ] Debug overlay logs noise/events  

---

## Milestone 15 — Packaging & Docs
- [ ] Generate API docs with Typedoc  
- [ ] Add project `README.md` + CI build/test  
- [ ] Bundle build → Netlify/Vercel preview  

**Verify:**  
- [ ] `npm run preview` runs built game  
- [ ] Docs explain configs & folder layout  



