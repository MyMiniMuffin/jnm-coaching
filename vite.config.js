import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
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
