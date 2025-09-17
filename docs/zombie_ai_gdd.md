# Zombie AI & Behavior – GDD

## 1. Spawning & Population
- **Initial Spawn:** A set number of zombies appear at game start.  
- **Daily Spawns:** New zombies spawn outside the player’s camera view each day.  
- **Escalation:** The number of spawns increases as days progress.  
- **Spawn Rules:** Minimum distance from players, preference for off-screen/occluded areas.  
- **Caps:** Optional daily and global population limits.  

## 2. States & Transitions
- **States:** Roaming → Pursuing → Attacking.  
- **Roaming:** Wanders aimlessly until a target is detected.  
- **Pursuing:** Moves toward the player, avoiding overlap with other zombies.  
- **Attacking:** Stops immediately at attack range and performs attacks based on attack speed and damage.  
- **Transitions:** Triggered by detection radius, attack range, leash distance, or lost-target timers.  

## 3. Phase-Based Behavior
- **Phases:** Day, Night, Eclipse.  
- **Detection Radius:** Smallest in Day, larger at Night, largest during Eclipse.  
- **Movement Speed:** Slowest in Day, faster at Night, fastest during Eclipse.  

## 4. Pursuit & Positioning
- **Soft Collision:** Zombies avoid standing directly on top of each other, maintaining separation.  
- **Player Interaction:** Zombies swarm around players but allow players to move through them.  
- **Attack Range:** Zombies stop instantly when in range and begin attacking without slowing down first.  
- **Swarming:** Multiple zombies cluster around players in a ring formation, with pressure from outer zombies.  

## 5. Combat
- **Attack Speed:** Defines attack cadence.  
- **Attack Damage:** Defines per-hit damage.  
- **Concurrency Limits:** Configurable number of zombies that can attack simultaneously; extras hover nearby.  
- **Optional Stagger:** Brief pauses after hits to emphasize impact.  

## 6. Hordes
- **Formation:** Three or more zombies near each other form a horde.  
- **Speed Penalty:** Hordes move slower than individuals; larger hordes are progressively slower.  
- **Leader Selection:** Zombie with the highest attack power becomes the leader (ties resolved randomly).  
- **Leader-Follower Movement:** Leader drives direction; followers maintain spacing with staggered, unsynchronized motion.  
- **Mixed Composition:** Hordes can include different zombie types and bosses.  

## 7. Zombie Types
- **Walkers:** Slow, weak, common enemies.  
- **Sprinters:** Fast, low-health threats, especially at night.  
- **Brutes:** Tough, heavy-damage enemies with slower speed.  
- **Screechers:** Weak in combat but able to call other zombies.  
- **Elites:** Enhanced versions of core types with extra traits.  

## 8. Boss Zombies
- **Definition:** Unique, powerful zombies with special abilities and higher stats.  
- **Spawn Criteria:** Triggered by day count, phase (night/eclipse), horde size, or biome/location.  
- **Abilities:** Each boss has 1–2 signature powers (e.g., slam, summon, invisibility).  
- **Telegraphing:** Audio/visual cues warn players of boss spawns.  
- **Rewards:** Defeating bosses grants rare loot or survival bonuses.  
- **Integration:** Bosses often lead hordes and may reduce horde penalties to keep groups mobile.  

## 9. Designer-Tunable Variables
- **Spawning:** Initial count, daily growth, caps, spawn distance, off-screen buffer.  
- **Phase Scaling:** Detection radius and speed multipliers per phase.  
- **Movement:** Walk/sprint speeds, random wandering behavior, separation radius.  
- **Combat:** Attack range, attack speed, attack damage, concurrency limits, stagger.  
- **Hordes:** Minimum size, slowdown scaling, leader rules.  
- **Types & Traits:** Stat profiles, resistances, special modifiers (armor, summon, enrage).  
- **Boss Criteria:** Minimum days, allowed phases, spawn chance, abilities, rewards.  
- **Spawn Tables:** Weighted distributions by day range and biome.  
