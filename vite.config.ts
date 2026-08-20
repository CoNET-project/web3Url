import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: process.env.WEB3_ENTRY !== 'pageBridge',
    rollupOptions: {
      input: process.env.WEB3_ENTRY === 'pageBridge'
        ? 'src/content/pageBridge.ts'
        : 'src/background/serviceWorker.ts',
      output: {
        entryFileNames: process.env.WEB3_ENTRY === 'pageBridge' ? 'pageBridge.js' : 'background.js',
        codeSplitting: false,
        format: 'iife'
      }
    }
  }
})
