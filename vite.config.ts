import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // THE BUILD STAMP (system messages, Adam 2026-10-18):
      // every build bakes the minute it was built, labeled so
      // the merge flow can read it back out of the deployed
      // bundle (grep 'bioforge-build:') and write it into the
      // system feed as latestBuild. Zero manual steps — the
      // stamp changes on EVERY build because the clock does.
      // buildNotes.ts unwraps it into BUILD_ID.
      __BIOFORGE_BUILD_ID__: JSON.stringify(
        `bioforge-build:${new Date().toISOString().slice(0, 16)}Z`
      ),
    },
    resolve: {
      alias: {
        // `import.meta.dirname` replaces `__dirname` here: Vite's native
        // config loader (the future default) runs this file as a true ES
        // module, where `__dirname` doesn't exist. Same folder, new spelling.
        '@': path.resolve(import.meta.dirname, '.'),

      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
