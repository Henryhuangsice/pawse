import { defineConfig } from 'vite';

// Tauri expects a fixed dev port; see src-tauri/tauri.conf.json -> build.devUrl
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  build: {
    target: 'safari15',
    rollupOptions: {
      input: { pet: 'index.html', settings: 'settings.html' },
    },
  },
});
