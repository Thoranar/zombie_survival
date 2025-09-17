# Pull Request Description

## Milestone
- Milestone 3 — Continuous Resource Nodes (Harvest)

## Summary
Implements continuous resource nodes: config‑driven ResourceSystem + ResourceNode, UI to toggle Quiet/Normal/Loud throttles, capacity bar rendering, NodeDepleted event and despawn. Loads rates and capacities from resources.json5.

## Changes Made
- public/config/resources.json5: nodes + throttles
- src/core/entities/ResourceNode.ts: node model
- src/core/systems/ResourceSystem.ts: harvest logic + NodeDepleted
- src/app/EngineAdapter.ts: drawResourceNode, screenToWorld
- src/app/GameApp.ts: load resources, spawn demo node, draw, selection
- src/ui/NodePanel.ts: throttle buttons (Quiet/Normal/Loud)
- tests/core/systems/ResourceSystem.test.ts: rate + depletion tests
- implementation_plan_mvp_checklist.md: check Milestone 3 items

## Tests
- [x] Unit tests added/updated
- [x] All tests passing (`npm run test`)

## Checklist
- [x] No hardcoded numbers (all from config)
- [x] Docstrings updated
- [x] Ran `npm run lint`
- [x] Ran `npm run test`
