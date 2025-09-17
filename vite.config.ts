import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@engine': path.resolve(__dirname, 'src/engine'),
      '@ui': path.resolve(__dirname, 'src/ui')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts']
  }
});
