import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  resolve: { alias: { $lib: path.resolve('./src/lib') } },
  build: { outDir: 'dist', target: 'esnext' },
  server: { port: 5173, hmr: { port: 5174 } }
});
