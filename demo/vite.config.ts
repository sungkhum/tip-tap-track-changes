import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/tiptap-track-changes/' : '/',
  resolve: {
    alias: {
      'tiptap-track-changes': path.resolve(__dirname, '../src'),
    },
  },
});
