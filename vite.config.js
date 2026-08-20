import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Fjern console.log i produksjon
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        coaching: fileURLToPath(new URL('./coaching/index.html', import.meta.url)),
      },
      output: {
        manualChunks(id) {
          // React kjerne - endres sjelden, caches lenge
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'react-vendor';
          }
          // Zoom/pan - kun brukt i ImageModal og GalleryView
          if (id.includes('/node_modules/react-zoom-pan-pinch/')) {
            return 'zoom';
          }
        }
      }
    }
  }
});
