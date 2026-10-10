import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  FileCode,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  CheckSquare,
  Square,
  MinusSquare,
  FolderArchive,
} from 'lucide-react';
import {
  SourceFile,
  getExtensionOptions,
  filterFiles,
  generateConcatenatedMarkdown,
  downloadMarkdownFile,
} from '../utils/FileExporter';

interface SourceExporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: SourceFile[];
}

export const SourceExporterModal: React.FC<SourceExporterModalProps> = ({
  isOpen,
  onClose,
  files,
}) => {
  // Set of selected file paths for export concatenation
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(
    () => new Set(files.map((f) => f.path))
  );

  // Filter & Search states
  const [selectedExtensions, setSelectedExtensions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showOnlySelected, setShowOnlySelected] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Sync selection if files array is updated from workspace source map
  useEffect(() => {
    if (!isOpen) return;
    if (files.length === 0) return;

    setSelectedFilePaths((prev) => {
      if (prev.size === 0 && files.length > 0) {
        return new Set(files.map((f) => f.path));
      }
      return prev;
    });
  }, [isOpen, files]);

  // Derived extension options across the loaded files
  const extensionOptions = useMemo(() => getExtensionOptions(files), [files]);

  // Files matching current extension & search filters
  const filteredFiles = useMemo(
    () => filterFiles(files, selectedExtensions, searchQuery),
    [files, selectedExtensions, searchQuery]
  );

  // Visible files in the selection drawer (honoring showOnlySelected toggle)
  const visibleFiles = useMemo(() => {
    if (!showOnlySelected) {
      return filteredFiles;
    }
    return filteredFiles.filter((f) => selectedFilePaths.has(f.path));
  }, [filteredFiles, showOnlySelected, selectedFilePaths]);

  // The authoritative set of files to be concatenated and downloaded
  const filesToExport = useMemo(
    () => files.filter((f) => selectedFilePaths.has(f.path)),
    [files, selectedFilePaths]
  );

  // Stitched Markdown document generated strictly from the selected files
  const stitchedMarkdown = useMemo(() => {
    if (filesToExport.length === 0) {
      return '';
    }
    return generateConcatenatedMarkdown(filesToExport, {
      title: 'BioForge Source Codebase Export',
      includeSummary: true,
      includeLineCount: true,
    });
  }, [filesToExport]);

  // Cumulative statistics for selected files
  const totalLines = useMemo(
    () => filesToExport.reduce((acc, f) => acc + f.content.split('\n').length, 0),
    [filesToExport]
  );

  const totalBytes = useMemo(
    () => filesToExport.reduce((acc, f) => acc + new Blob([f.content]).size, 0),
    [filesToExport]
  );

  // Visible selection metrics
  const allVisibleSelected = useMemo(
    () => visibleFiles.length > 0 && visibleFiles.every((f) => selectedFilePaths.has(f.path)),
    [visibleFiles, selectedFilePaths]
  );

  const someVisibleSelected = useMemo(
    () => visibleFiles.some((f) => selectedFilePaths.has(f.path)),
    [visibleFiles, selectedFilePaths]
  );

  const selectedInVisibleCount = useMemo(
    () => visibleFiles.filter((f) => selectedFilePaths.has(f.path)).length,
    [visibleFiles, selectedFilePaths]
  );

  // Early return if modal is closed
  if (!isOpen) {
    return null;
  }

  // --- Selection Handlers ---

  const handleToggleFile = (filePath: string) => {
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
        return next;
      }
      next.add(filePath);
      return next;
    });
  };

  const handleSelectAllFiles = () => {
    setSelectedFilePaths(new Set(files.map((f) => f.path)));
  };

  const handleDeselectAllFiles = () => {
    setSelectedFilePaths(new Set());
  };

  const handleSelectAllVisible = () => {
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      visibleFiles.forEach((f) => next.add(f.path));
      return next;
    });
  };

  const handleDeselectAllVisible = () => {
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      visibleFiles.forEach((f) => next.delete(f.path));
      return next;
    });
  };

  const handleToggleMasterCheckbox = () => {
    if (allVisibleSelected) {
      handleDeselectAllVisible();
      return;
    }
    handleSelectAllVisible();
  };

  // --- Filter Handlers ---

  const handleToggleExtension = (ext: string) => {
    setSelectedExtensions((prev) => {
      const next = new Set(prev);
      if (next.has(ext)) {
        next.delete(ext);
        return next;
      }
      next.add(ext);
      return next;
    });
  };

  const handleClearAllExtensions = () => {
    setSelectedExtensions(new Set());
  };

  // --- Export Actions ---

  const handleCopyMarkdown = async () => {
    if (!stitchedMarkdown) return;
    try {
      await navigator.clipboard.writeText(stitchedMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for restricted clipboard context
      const textarea = document.createElement('textarea');
      textarea.value = stitchedMarkdown;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (filesToExport.length === 0) return;
    if (!stitchedMarkdown) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadMarkdownFile(stitchedMarkdown, `bioforge-source-export-${dateStr}.md`);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-5xl h-[740px] rounded-3xl flex flex-col overflow-hidden border border-cyan-500/30 shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-tech font-bold text-white tracking-wide">
                  DEVELOPER SOURCE EXPORTER
                </h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Dev Utility
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Stitch & concatenate project source files into clean structured Markdown for external review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Export Volume</span>
              <span className="font-tech font-bold text-cyan-400 text-sm">
                {filesToExport.length} of {files.length} files • {totalLines.toLocaleString()} lines ({formatBytes(totalBytes)})
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
          {/* Extension Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              Extensions:
            </span>
            {extensionOptions.map((opt) => {
              const isChecked = selectedExtensions.has(opt.ext);
              return (
                <button
                  key={opt.ext}
                  onClick={() => handleToggleExtension(opt.ext)}
                  className={`text-xs px-2.5 py-1 rounded-xl font-mono flex items-center gap-1.5 transition-colors border ${
                    isChecked
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-500/20'
                      : 'bg-slate-850/60 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{opt.label}</span>
                  <span className="text-[10px] opacity-70">({opt.count})</span>
                </button>
              );
            })}

            {selectedExtensions.size > 0 && (
              <button
                onClick={handleClearAllExtensions}
                className="text-[11px] text-slate-400 hover:text-cyan-300 hover:underline px-1 font-mono ml-1"
              >
                Clear Ext Filter
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search file path..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-slate-950/80 border border-slate-700/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Individual Files Selection Drawer */}
          <div className="w-80 border-r border-slate-800 bg-slate-950/50 flex flex-col">
            {/* Selection Controls Header */}
            <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                {/* Master checkbox toggle for visible files */}
                <button
                  type="button"
                  onClick={handleToggleMasterCheckbox}
                  className="flex items-center gap-2 text-xs font-mono text-slate-200 hover:text-cyan-300 transition-colors"
                  title={allVisibleSelected ? 'Deselect all visible files' : 'Select all visible files'}
                >
                  {allVisibleSelected ? (
                    <CheckSquare className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  ) : someVisibleSelected ? (
                    <MinusSquare className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  )}
                  <span className="font-semibold">
                    {allVisibleSelected ? 'Deselect Visible' : 'Select Visible'}
                  </span>
                </button>

                {/* Quick Selection Buttons */}
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <button
                    onClick={handleSelectAllFiles}
                    className="text-cyan-400 hover:text-cyan-300 hover:underline px-1 py-0.5 rounded transition-colors"
                    title={`Select all ${files.length} project files`}
                  >
                    All ({files.length})
                  </button>
                  <span className="text-slate-600">/</span>
                  <button
                    onClick={handleDeselectAllFiles}
                    className="text-slate-400 hover:text-rose-400 hover:underline px-1 py-0.5 rounded transition-colors"
                    title="Deselect all files"
                  >
                    None
                  </button>
                </div>
              </div>

              {/* View Scope & Status Indicator */}
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                <span>
                  {selectedInVisibleCount} of {visibleFiles.length} visible ({filesToExport.length} total)
                </span>

                <button
                  onClick={() => setShowOnlySelected((prev) => !prev)}
                  className={`px-2 py-0.5 rounded-lg border transition-colors ${
                    showOnlySelected
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Filter list to show only currently selected files"
                >
                  {showOnlySelected ? 'Selected Only ✓' : 'Show All'}
                </button>
              </div>
            </div>

            {/* Scrollable File Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/30 p-2 space-y-1.5">
              {visibleFiles.map((file) => {
                const isSelected = selectedFilePaths.has(file.path);
                const lineCount = file.content.split('\n').length;
                const fileSize = new Blob([file.content]).size;

                return (
                  <div
                    key={file.path}
                    onClick={() => handleToggleFile(file.path)}
                    className={`p-2.5 rounded-xl cursor-pointer select-none transition-all duration-150 flex items-start gap-2.5 border ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/50 shadow-sm shadow-cyan-950 text-slate-100 hover:border-cyan-400'
                        : 'bg-slate-900/30 border-slate-800/50 text-slate-400 hover:bg-slate-850/50 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFile(file.path);
                      }}
                      className="mt-0.5 flex-shrink-0 text-cyan-400 hover:scale-110 transition-transform focus:outline-none"
                      aria-label={isSelected ? `Deselect ${file.path}` : `Select ${file.path}`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span
                        className={`font-mono text-xs truncate ${
                          isSelected ? 'text-cyan-100 font-medium' : 'text-slate-300'
                        }`}
                        title={file.path}
                      >
                        {file.path}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span>{lineCount} lines</span>
                        <span>•</span>
                        <span>{formatBytes(fileSize)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {visibleFiles.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500">
                  {showOnlySelected
                    ? 'No files are currently selected in this view.'
                    : 'No files match the active filter criteria.'}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Markdown Preview & Download Actions */}
          <div className="flex-1 flex flex-col bg-slate-950/70 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2">
                <span className="text-xs px-3 py-1 rounded-lg font-mono bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                  Markdown Stitched View ({filesToExport.length} files)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyMarkdown}
                  disabled={filesToExport.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={filesToExport.length === 0 ? 'Select files to copy' : 'Copy concatenated markdown'}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-300" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownload}
                  disabled={filesToExport.length === 0}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  title={filesToExport.length === 0 ? 'Select files to download' : 'Download stitched .md file'}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .md</span>
                </button>
              </div>
            </div>

            {/* Preview Body / Empty State */}
            {filesToExport.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950/60">
                <div className="w-14 h-14 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-950">
                  <FileCode className="w-7 h-7" />
                </div>
                <h3 className="font-tech text-base font-bold text-white mb-1 tracking-wide">
                  NO FILES SELECTED
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
                  Check individual files on the left to include them in the download, or select all files to export the full codebase.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSelectAllFiles}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 flex items-center gap-2 transition-colors"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Select All {files.length} Files</span>
                  </button>
                  {visibleFiles.length > 0 && visibleFiles.length < files.length && (
                    <button
                      onClick={handleSelectAllVisible}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-2 transition-colors"
                    >
                      <span>Select {visibleFiles.length} Visible Files</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 p-4 overflow-auto">
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap select-text leading-relaxed">
                  {stitchedMarkdown}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">
              {filesToExport.length} file{filesToExport.length === 1 ? '' : 's'} staged for export
            </span>
          </div>
          <span className="text-[11px] font-mono">
            Pure Client-Side Export • Zero 'else' Compliant • Granular File Control
          </span>
        </div>
      </div>
    </div>
  );
};
