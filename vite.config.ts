import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// THE BUILD STAMP (system messages, Adam 2026-10-18): the
// minute this build was made. One value, two carriers:
//  (1) the define below, which the running game reads as its
//      BUILD_ID (buildNotes.ts);
//  (2) a build.txt asset emitted beside the bundle — the
//      merge flow reads the stamp from the DEPLOYED
//      /build.txt (a plain fetch, no bundle spelunking; the
//      dev lane's correction: minifiers constant-fold the
//      labeled string out of the JS, but a static file is
//      exactly what was written).
// Zero manual steps — the stamp changes on EVERY build
// because the clock does.
const BUILD_STAMP = `${new Date().toISOString().slice(0, 16)}Z`;

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'bioforge-build-stamp',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'build.txt', source: `${BUILD_STAMP}\n` });
        },
      },
    ],
    define: {
      __BIOFORGE_BUILD_ID__: JSON.stringify(`bioforge-build:${BUILD_STAMP}`),
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
