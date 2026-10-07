/**
 * FileExporter.ts
 *
 * Pure utility logic for extracting file extensions, filtering source files,
 * and concatenating them into a structured Markdown document.
 * Strictly adheres to the Code Manifesto:
 * - Guard clauses & early returns
 * - Zero 'else' / 'else if' blocks
 * - Functional transformations (.map, .filter, .reduce)
 * - Strict type safety
 */

export interface SourceFile {
  path: string;
  content: string;
}

export interface ExtensionOption {
  ext: string;
  label: string;
  count: number;
}

/**
 * Extracts a lowercase file extension including dot, or empty string if none.
 * e.g., "src/App.tsx" -> ".tsx"
 */
export function extractExtension(filePath: string): string {
  const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  const fileName = lastSlashIndex >= 0 ? filePath.slice(lastSlashIndex + 1) : filePath;
  const dotIndex = fileName.lastIndexOf('.');

  if (dotIndex <= 0) {
    return '';
  }

  return fileName.slice(dotIndex).toLowerCase();
}

/**
 * Maps a file extension to a Markdown code fence language identifier.
 */
export function getLanguageForExtension(ext: string): string {
  const normalized = ext.toLowerCase();

  if (normalized === '.ts') return 'typescript';
  if (normalized === '.tsx') return 'tsx';
  if (normalized === '.js') return 'javascript';
  if (normalized === '.jsx') return 'jsx';
  if (normalized === '.css') return 'css';
  if (normalized === '.json') return 'json';
  if (normalized === '.md') return 'markdown';
  if (normalized === '.html') return 'html';
  if (normalized === '.svg') return 'xml';
  if (normalized === '.yaml' || normalized === '.yml') return 'yaml';

  return '';
}

/**
 * Computes available file extensions and their occurrence counts across the dataset.
 */
export function getExtensionOptions(files: SourceFile[]): ExtensionOption[] {
  const countMap: Record<string, number> = {};

  files.forEach((file) => {
    const ext = extractExtension(file.path);
    const key = ext || '(no extension)';
    countMap[key] = (countMap[key] || 0) + 1;
  });

  return Object.keys(countMap)
    .sort()
    .map((key) => ({
      ext: key,
      label: key === '(no extension)' ? 'No Extension' : key,
      count: countMap[key],
    }));
}

/**
 * Filters source files according to selected extensions and optional search queries.
 */
export function filterFiles(
  files: SourceFile[],
  selectedExtensions: Set<string>,
  searchQuery: string = ''
): SourceFile[] {
  const query = searchQuery.trim().toLowerCase();

  return files.filter((file) => {
    const ext = extractExtension(file.path);
    const key = ext || '(no extension)';
    const matchesExt = selectedExtensions.size === 0 || selectedExtensions.has(key);

    if (!matchesExt) {
      return false;
    }

    if (!query) {
      return true;
    }

    return file.path.toLowerCase().includes(query);
  });
}

/**
 * Concatenates source files into a single structured Markdown file.
 */
export function generateConcatenatedMarkdown(
  files: SourceFile[],
  options?: {
    title?: string;
    includeSummary?: boolean;
    includeLineCount?: boolean;
  }
): string {
  const title = options?.title || 'Project Source Code Export';
  const includeSummary = options?.includeSummary ?? true;
  const includeLineCount = options?.includeLineCount ?? true;

  const headerLines: string[] = [
    `# ${title}`,
    '',
    `> **Exported:** ${new Date().toISOString()}  `,
    `> **Total Files:** ${files.length}  `,
    '',
  ];

  if (includeSummary) {
    headerLines.push('## Table of Contents', '');
    files.forEach((f, idx) => {
      const lineCount = f.content.split('\n').length;
      headerLines.push(`${idx + 1}. \`${f.path}\` (${lineCount} lines)`);
    });
    headerLines.push('', '---', '');
  }

  const fileSections = files.map((file) => {
    const ext = extractExtension(file.path);
    const lang = getLanguageForExtension(ext);
    const lineCount = file.content.split('\n').length;
    const meta = includeLineCount ? ` (${lineCount} lines)` : '';

    return [
      `## File: \`${file.path}\`${meta}`,
      '',
      `\`\`\`${lang}`,
      file.content,
      '```',
      '',
    ].join('\n');
  });

  return [...headerLines, ...fileSections].join('\n');
}

/**
 * Triggers a browser download of the stitched Markdown content.
 */
export function downloadMarkdownFile(content: string, filename: string = 'codebase-export.md'): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
