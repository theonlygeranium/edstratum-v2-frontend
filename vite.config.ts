// KB1: @tailwindcss/vite handles all PostCSS — no postcss.config.js needed
// Gate 1: manualChunks isolates React, Motion, and app code for long-lived caching
// Gate 5: Cloudflare Pages targets — es2022, esbuild minifier, no sourcemaps in prod
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    target: 'es2022',
    outDir: 'dist',
    cssCodeSplit: true,
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        entryFileNames:  'assets/[name]-[hash].js',
        chunkFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/motion/')) {
            return 'motion-vendor'
          }
          if (id.includes('node_modules/')) {
            return 'vendor'
          }
        },
      },
    },
  },
})
