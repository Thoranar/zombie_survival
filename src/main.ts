import { Canvas2DEngine } from '@app/EngineAdapter';
import { EventBus } from '@app/EventBus';
import { GameApp } from '@app/GameApp';
import { ConfigService } from '@core/data/ConfigService';

async function boot(): Promise<void> {
  const container = document.getElementById('app');
  if (!container) throw new Error('Missing #app container');
  const cfg = new ConfigService();
  await cfg.loadGameConfigBrowser('/config/game.json5');
  const app = new GameApp(new Canvas2DEngine(), new EventBus(), cfg, container);
  await app.start();
}

boot().catch((e) => {
  console.error(e);
});
