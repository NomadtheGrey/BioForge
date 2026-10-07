import { SourceFile } from './FileExporter';

/**
 * PROJECT_SOURCE_MAP
 *
 * Uses Vite's `import.meta.glob('...', { query: '?raw', import: 'default', eager: true })`
 * to dynamically load the project's source files as raw text strings at build time.
 * This guarantees the developer export tool always reflects the live codebase.
 */
const rawSources = import.meta.glob(
  [
    '/src/**/*.{ts,tsx,css}',
    '/CODE_MANIFESTO.md',
    '/CHANGELOG.md',
    '/package.json',
    '/vite.config.ts',
    '/index.html',
  ],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  }
) as Record<string, string>;

export function getProjectWorkspaceFiles(): SourceFile[] {
  return Object.keys(rawSources)
    .sort()
    .map((key) => {
      // Normalize leading slash for display cleanliness (e.g. "/src/App.tsx" -> "src/App.tsx")
      const normalizedPath = key.startsWith('/') ? key.slice(1) : key;
      return {
        path: normalizedPath,
        content: rawSources[key] || '',
      };
    });
}
