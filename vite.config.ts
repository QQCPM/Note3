import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: false,
    host: true,
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },

  // Path aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      // Polyfill for Node.js crypto (needed by langsmith/langchain)
      crypto: 'crypto-browserify',
    },
  },

  // Prevent vite from obscuring rust errors
  clearScreen: false,

  // Environment variables
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri supports es2021
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      // Externalize Node.js built-ins for LangChain compatibility
      external: [],
      output: {
        // Ensure proper module handling
        manualChunks: (id) => {
          // Put langchain in a separate chunk
          if (id.includes('@langchain') || id.includes('langsmith')) {
            return 'langchain';
          }
        },
      },
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    // Pre-bundle LangChain packages to fix ESM star export issues
    // This resolves: "Importing binding name 'default' cannot be resolved by star export entries"
    include: [
      '@google/genai',
      '@langchain/langgraph',
      '@langchain/langgraph/web',
      '@langchain/core',
      '@langchain/core/messages',
      '@langchain/openai',
    ],
    // Exclude these from main bundle - they are handled in the Web Worker
    exclude: [
      'langsmith',          // Exclude langsmith to avoid crypto issues
      'llamaindex',         // LlamaIndex runs in Web Worker only
      '@llamaindex/core',
      '@llamaindex/env',
      '@llamaindex/google',
    ],
  },

  // Web Worker configuration
  worker: {
    format: 'es' as const,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
      },
    },
  },

  // Handle Node.js modules in browser
  define: {
    'process.env': {},
  },
});
