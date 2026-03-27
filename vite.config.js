import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
      output: {
        manualChunks: {
          // React kjerne — endres sjelden, caches lenge
          'react-vendor': ['react', 'react-dom'],
          // Markdown-rendering — kun brukt i PlanSection
          'markdown': ['marked', 'dompurify'],
          // Zoom/pan — kun brukt i ImageModal og GalleryView
          'zoom': ['react-zoom-pan-pinch'],
        }
      }
    }
  }
});
