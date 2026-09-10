import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins:[react()],
  base:'./',
  // Keep the production bundle compatible with older iOS Safari / mobile in-app browsers.
  build:{target:'es2018'}
});
