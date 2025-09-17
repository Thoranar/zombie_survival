# Cat & Mouse Zombie — Game Design Document (GDD)

**Version:** v0.1  
**Date:** 2025-09-15  
**Genre:** Top-down 2D, survival, indirect-combat, stealth-lure  
**Platform:** Web (Desktop, Chrome/Edge/Safari/Firefox)  
**Engine:** Phaser 3 or PixiJS + custom systems  

---

## 1) High-Level Pitch
A cat-and-mouse zombie survival where you **can’t directly damage enemies**. You outsmart and outmaneuver: **harvest noisy resource nodes**, build **silent traps** and **loud-but-risky machines**, and **kite** the horde through your kill corridors. Each cycle escalates with a **Day/Night** rhythm and an **Eclipse** every third day. The objective: **survive as many days as possible**.

---

## 2) Design Pillars
1. **Cat & Mouse, Not Bullet Heaven** — Information and positioning beat raw DPS. The threat is attracted to your mistakes (noise) more than your location.
2. **Indirect Combat Only** — Traps, machines, and environment do the killing. Player pushes, lures, and routes.
3. **Continuous Nodes & Push-Your-Luck** — Harvest is a channel that creates tension; faster gain = louder noise = higher risk.
4. **Readable Systems** — Minimal resource types, short tooltips, clear noise signals, distinct enemy roles.
5. **Portable Maze** — Small set of placeables (walls, snares, spikes, decoys) create emergent funnels and ambushes.

---

## 3) Player Fantasy & Objectives
- **Fantasy:** A clever scavenger-engineer who turns junk into clever death machines and outsmarts the dead.
- **Objective:** Survive the longest; build a safe(ish) base; optimize routes between **nodes → storage → traps**.
- **Fail State:** Player HP hits 0 or storage destroyed during Eclipse (optional variant; defaults to player death only).

---

## 4) Core Loop (Per Day/Night Cycle)
**Day (120s):**
1. **Scout & Plan:** Find active nodes; mark a quiet route.  
2. **Harvest (Quiet/Normal/Loud):** Hold to gather; throttle modifies yield vs noise.  
3. **Place Silent Traps/Shape Lanes:** Spikes, snares, walls.  
4. **Deposit & Reset:** Auto-store near the crate; light repairs.

**Night (90s):**
1. **High-Value Nodes:** Fewer but richer (Crystal, military crates).  
2. **Aggressive AI:** Runners/Howlers, larger hearing; use decoys to steer.  
3. **Trigger Killboxes:** Oil → Flame, Tesla auras, or turret bursts (noisy but decisive).  
4. **Kite & Deposit:** Vacuum loot safely; consider salvage/relocation.

**Every 3rd Cycle = Eclipse Night (180s):**  
No day prep. Night rules, boosted spawns & hearing. Survive or relocate.

---

## 5) Systems Overview
(…content continues with full detail…)
