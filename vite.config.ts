import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Borra dist antes de cada build: evita que archivos viejos (p. ej. un
    // _redirects eliminado del repo) sobrevivan en el caché de Cloudflare.
    emptyOutDir: true,
  },
});
