import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
        // scripts/build.mjs clears dist once before building all entries.
        // Each subsequent Vite build must preserve the other extension scripts.
        emptyOutDir: false,
    rollupOptions: {
      input: process.env.WEB3_ENTRY === 'pageBridge'
        ? 'src/content/pageBridge.ts'
        : process.env.WEB3_ENTRY === 'options'
          ? 'src/options/options.ts'
          : 'src/background/serviceWorker.ts',
      output: {
        entryFileNames: process.env.WEB3_ENTRY === 'pageBridge'
          ? 'pageBridge.js'
          : process.env.WEB3_ENTRY === 'options'
            ? 'options.js'
            : 'background.js',
        codeSplitting: false,
        format: 'iife'
      }
    }
  }
})
