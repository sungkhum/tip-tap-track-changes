import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/tip-tap-track-changes/' : '/',
  resolve: {
    alias: {
      'tiptap-track-changes': path.resolve(__dirname, '../src'),
    },
  },
});
