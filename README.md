# Zombie Survivors

Repository: `zombie_survival`

Zombie Survivors is a top-down survivor prototype built with TypeScript and Vite. The project explores zombie AI behaviour, resource gathering, and base defense mechanics.

## Prerequisites

- Node.js 20+
- npm 10+

## Getting Started

1. Install dependencies: `npm install`
2. Start the development server: `npm run dev`
3. Build for production: `npm run build`
4. Run the test suite: `npm run test`
5. Lint and format: `npm run lint` and `npm run format`

## Project Structure

- `src/`: Core game logic, systems, and UI components.
- `public/`: Static assets and configuration JSON5 files loaded by the game.
- `tests/`: Vitest test suites covering engine and gameplay systems.
- `docs/`: Design documents and implementation guides.
- `scripts/`: Maintenance scripts.

## Documentation

Additional design and planning resources live in `docs/`. Start with `docs/zombie_ai_gdd.md` for the gameplay concept and `docs/implementation_plan_mvp_checklist.md` for development milestones.

## Contributing

Create feature branches from `main`, keep pull requests focused, and run linting plus tests before opening a PR. A starter checklist template can be found in `templates/`.
