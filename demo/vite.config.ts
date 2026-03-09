import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'tiptap-track-changes': path.resolve(__dirname, '../src'),
    },
  },
});
