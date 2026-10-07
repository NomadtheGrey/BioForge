import React, { useState, useMemo } from 'react';
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
  FileText,
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
  const [selectedExtensions, setSelectedExtensions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'files'>('preview');

  const extensionOptions = useMemo(() => getExtensionOptions(files), [files]);

  // If no extensions selected, treat as "all selected" for filtering convenience
  const filteredFiles = useMemo(
    () => filterFiles(files, selectedExtensions, searchQuery),
    [files, selectedExtensions, searchQuery]
  );

  const stitchedMarkdown = useMemo(
    () =>
      generateConcatenatedMarkdown(filteredFiles, {
        title: 'BioForge Source Codebase Export',
        includeSummary: true,
        includeLineCount: true,
      }),
    [filteredFiles]
  );

  const totalLines = useMemo(
    () => filteredFiles.reduce((acc, f) => acc + f.content.split('\n').length, 0),
    [filteredFiles]
  );

  const totalBytes = useMemo(
    () => filteredFiles.reduce((acc, f) => acc + new Blob([f.content]).size, 0),
    [filteredFiles]
  );

  if (!isOpen) {
    return null;
  }

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

  const handleSelectAll = () => {
    setSelectedExtensions(new Set(extensionOptions.map((o) => o.ext)));
  };

  const handleClearAll = () => {
    setSelectedExtensions(new Set());
  };

  const handleCopyMarkdown = async () => {
    if (!stitchedMarkdown) return;
    try {
      await navigator.clipboard.writeText(stitchedMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
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
    if (filteredFiles.length === 0) return;
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
      <div className="glass-panel-biolum w-full max-w-5xl h-[720px] rounded-3xl flex flex-col overflow-hidden border border-cyan-500/30 shadow-2xl">
        {/* Header */}
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
                {filteredFiles.length} files • {totalLines.toLocaleString()} lines ({formatBytes(totalBytes)})
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

        {/* Filter & Toolbar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
          {/* Extension Checkbox Badges */}
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

            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={handleSelectAll}
                className="text-[11px] text-cyan-400 hover:underline px-1 font-mono"
              >
                All
              </button>
              <span className="text-slate-600 text-xs">/</span>
              <button
                onClick={handleClearAll}
                className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline px-1 font-mono"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter file path..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-950/80 border border-slate-700/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Files List (Collapsible on mobile or fixed width) */}
          <div className="w-72 border-r border-slate-800 bg-slate-950/40 flex flex-col">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">Included Files ({filteredFiles.length})</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-2 space-y-1">
              {filteredFiles.map((file) => {
                const lineCount = file.content.split('\n').length;
                return (
                  <div
                    key={file.path}
                    className="p-2 rounded-xl bg-slate-900/40 hover:bg-slate-850/60 text-xs flex flex-col gap-0.5 border border-slate-800/40"
                  >
                    <span className="text-slate-200 font-mono truncate" title={file.path}>
                      {file.path}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {lineCount} lines • {formatBytes(new Blob([file.content]).size)}
                    </span>
                  </div>
                );
              })}
              {filteredFiles.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500">
                  No files match current filter criteria.
                </div>
              )}
            </div>
          </div>

          {/* Right: Markdown Preview / Raw Output */}
          <div className="flex-1 flex flex-col bg-slate-950/70 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`text-xs px-3 py-1 rounded-lg font-mono transition-colors ${
                    activeTab === 'preview'
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Markdown Stitched View
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyMarkdown}
                  disabled={filteredFiles.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-40"
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
                  disabled={filteredFiles.length === 0}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 transition-all disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .md</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-auto">
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap select-text leading-relaxed">
                {stitchedMarkdown}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">Virtual Workspace File Map Ready</span>
          </div>
          <span className="text-[11px] font-mono">
            Pure Client-Side Export • No Telemetry • Zero Else Compliant
          </span>
        </div>
      </div>
    </div>
  );
};
