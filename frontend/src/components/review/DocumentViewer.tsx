'use client';

import { useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  fileUrl: string;
  fileName: string;
}

export function DocumentViewer({ fileUrl, fileName }: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const documentKey = useMemo(() => `${fileUrl}:${retryCount}`, [fileUrl, retryCount]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
    setLoadError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error);
    setLoading(false);
    setLoadError(error.message || 'Unable to load this PDF.');
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(numPages, prev + 1));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(2.0, prev + 0.2));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(0.6, prev - 0.2));
  };

  const retryLoad = () => {
    setLoading(true);
    setLoadError(null);
    setNumPages(0);
    setPageNumber(1);
    setRetryCount((prev) => prev + 1);
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/14 bg-slate-950/40">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-100">{fileName}</h3>
          {numPages > 0 && (
            <p className="text-xs text-slate-400">
              Page {pageNumber} of {numPages}
            </p>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            disabled={scale <= 0.6}
          >
            −
          </button>
          <span className="text-xs text-slate-300">{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            disabled={scale >= 2.0}
          >
            +
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-slate-950/68 p-4">
        {loadError ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-2xl border border-rose-300/22 bg-rose-500/9 p-6 text-center">
              <h4 className="text-sm font-semibold text-rose-100">Unable to load PDF preview</h4>
              <p className="mt-2 text-xs text-rose-100/85">{loadError}</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={retryLoad}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Retry
                </button>
                <button
                  onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}
                  className="rounded-lg border border-sky-300/35 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/25"
                >
                  Open in new tab
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative flex justify-center">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/58 backdrop-blur-[1px]">
                <div className="text-center">
                  <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-sky-200/20 border-t-sky-400"></div>
                  <p className="text-sm text-slate-300">Loading document...</p>
                </div>
              </div>
            )}
            <Document
              key={documentKey}
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading=""
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-2xl"
              />
            </Document>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-4 border-t border-white/10 px-4 py-3">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-300">
            {pageNumber} / {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
