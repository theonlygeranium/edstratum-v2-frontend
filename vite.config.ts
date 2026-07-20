// KB1: @tailwindcss/vite handles all PostCSS — no postcss.config.js needed
// Gate 1: manualChunks isolates React, Motion, and app code for long-lived caching
// Gate 5: Cloudflare Pages targets — es2022, esbuild minifier, no sourcemaps in prod
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const PDF_VENDOR_PACKAGES = [
  'node_modules/@babel/runtime/',
  'node_modules/@noble/ciphers/',
  'node_modules/@noble/hashes/',
  'node_modules/@react-pdf/',
  'node_modules/@swc/helpers/',
  'node_modules/abs-svg-path/',
  'node_modules/base64-js/',
  'node_modules/bidi-js/',
  'node_modules/blob-stream/',
  'node_modules/brotli/',
  'node_modules/browserify-zlib/',
  'node_modules/buffer/',
  'node_modules/clone/',
  'node_modules/color-string/',
  'node_modules/dfa/',
  'node_modules/emoji-regex-xs/',
  'node_modules/events/',
  'node_modules/fast-deep-equal/',
  'node_modules/fontkit/',
  'node_modules/hsl-to-hex/',
  'node_modules/hyphen/',
  'node_modules/is-url/',
  'node_modules/jay-peg/',
  'node_modules/js-md5/',
  'node_modules/linebreak/',
  'node_modules/media-engine/',
  'node_modules/normalize-svg-path/',
  'node_modules/object-assign/',
  'node_modules/pako/',
  'node_modules/parse-svg-path/',
  'node_modules/png-js/',
  'node_modules/postcss-value-parser/',
  'node_modules/process/',
  'node_modules/prop-types/',
  'node_modules/queue/',
  'node_modules/restructure/',
  'node_modules/svg-arc-to-cubic-bezier/',
  'node_modules/tiny-inflate/',
  'node_modules/unicode-properties/',
  'node_modules/unicode-trie/',
  'node_modules/vite-compatible-readable-stream/',
  'node_modules/yoga-layout/',
]

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
          if (PDF_VENDOR_PACKAGES.some((pkg) => id.includes(pkg))) {
            return 'pdf-vendor'
          }

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
