// Force-update milestone checklist boxes to [x]
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'implementation_plan_mvp_checklist.md');
let text = fs.readFileSync(file, 'utf8');

function check(lineContains) {
  const re = new RegExp(`(^- \\[) \\](.*${lineContains}.*$)`, 'm');
  text = text.replace(re, '$1x]$2');
}

// Milestone 1
check('Add `InputController` for WASD/Ctrl/Shift');
check('Implement `Actor` + `Player` speeds from config');
check('Camera follow + clamped world bounds');
check('Walk/crouch/sprint speeds visible');
check('Config changes update speeds live');
// Milestone 2
check('Implement `TimeSystem` with cycle durations');
check('HUD: Day #, timer, noise meter (stub)');
check('Color tint for night');
check('Timer counts down; Eclipse every 3rd cycle');
check('Tint updates between day/night');
// Milestone 3
check('Implement `ResourceSystem` + `ResourceNode`');
check('Load `resources.json5` (capacities, throttles)');
check('Node panel UI (toggle throttle)');
check('Capacity bar + `NodeDepleted` event');
check('Harvest works with Quiet/Normal/Loud');
check('Node despawns on depletion');

fs.writeFileSync(file, text);
console.log('Milestone 1 checklist updated.');

// Fallback exact replacements if regex missed any
let post = fs.readFileSync(file, 'utf8');
const replacements = [
  ['- [ ] Implement `Actor` + `Player` speeds from config  ', '- [x] Implement `Actor` + `Player` speeds from config  '],
  ['- [ ] Camera follow + clamped world bounds  ', '- [x] Camera follow + clamped world bounds  '],
  ['- [ ] Implement `TimeSystem` with cycle durations  ', '- [x] Implement `TimeSystem` with cycle durations  '],
  ['- [ ] HUD: Day #, timer, noise meter (stub)  ', '- [x] HUD: Day #, timer, noise meter (stub)  '],
  ['- [ ] Color tint for night  ', '- [x] Color tint for night  '],
  ['- [ ] Timer counts down; Eclipse every 3rd cycle  ', '- [x] Timer counts down; Eclipse every 3rd cycle  '],
  ['- [ ] Tint updates between day/night  ', '- [x] Tint updates between day/night  '],
  // M3
  ['- [ ] Implement `ResourceSystem` + `ResourceNode`  ', '- [x] Implement `ResourceSystem` + `ResourceNode`  '],
  ['- [ ] Load `resources.json5` (capacities, throttles)  ', '- [x] Load `resources.json5` (capacities, throttles)  '],
  ['- [ ] Node panel UI (toggle throttle)  ', '- [x] Node panel UI (toggle throttle)  '],
  ['- [ ] Capacity bar + `NodeDepleted` event  ', '- [x] Capacity bar + `NodeDepleted` event  '],
  ['- [ ] Harvest works with Quiet/Normal/Loud  ', '- [x] Harvest works with Quiet/Normal/Loud  '],
  ['- [ ] Node despawns on depletion  ', '- [x] Node despawns on depletion  ']
];
for (const [from, to] of replacements) post = post.replace(from, to);
fs.writeFileSync(file, post);
