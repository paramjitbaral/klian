import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Use a generic environment variable name for API keys to avoid vendor-specific naming
        'process.env.API_KEY': JSON.stringify(env.APP_API_KEY || env.API_KEY || ''),
        'process.env.APP_API_KEY': JSON.stringify(env.APP_API_KEY || env.API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      esbuild: {
        drop: ['console', 'debugger'],
      }
    };
});
