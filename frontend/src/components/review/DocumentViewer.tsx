'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { api } from '@/lib/api';
import { OcrPageLayout } from '@/types';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerProps {
  fileUrl: string;
  fileName: string;
  highlightTerms?: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function DocumentViewer({
  fileUrl,
  fileName,
  highlightTerms = [],
}: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [textLayerHasText, setTextLayerHasText] = useState<boolean | null>(null);
  const [ocrPages, setOcrPages] = useState<OcrPageLayout[]>([]);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrAttempted, setOcrAttempted] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const documentKey = useMemo(() => `${fileUrl}:${retryCount}`, [fileUrl, retryCount]);
  const normalizedHighlightTerms = useMemo(() => {
    const seen = new Set<string>();
    for (const rawTerm of highlightTerms) {
      const term = rawTerm.trim();
      if (term.length < 2) {
        continue;
      }

      const key = term.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
    }

    return Array.from(seen.values())
      .map((key) => highlightTerms.find((term) => term.trim().toLowerCase() === key) ?? key)
      .sort((a, b) => b.length - a.length);
  }, [highlightTerms]);

  const normalizedHighlightTermsLower = useMemo(
    () => normalizedHighlightTerms.map((term) => term.toLowerCase()),
    [normalizedHighlightTerms],
  );

  const highlightMatchers = useMemo(
    () =>
      normalizedHighlightTermsLower.map((term) => {
        const simpleWord = /^[a-z0-9]+$/.test(term);
        return {
          term,
          pattern: simpleWord
            ? new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`)
            : null,
        };
      }),
    [normalizedHighlightTermsLower],
  );

  const matchesAnyHighlightTerm = useCallback(
    (text: string) =>
      highlightMatchers.some(({ term, pattern }) =>
        pattern ? pattern.test(text) : text.includes(term),
      ),
    [highlightMatchers],
  );

  const ocrHighlightBoxes = useMemo(() => {
    if (normalizedHighlightTermsLower.length === 0) {
      return [];
    }

    const pageLayout = ocrPages.find((page) => page.pageNumber === pageNumber);
    if (!pageLayout || !pageLayout.width || !pageLayout.height) {
      return [];
    }

    const pageWidth = pageLayout.width;
    const pageHeight = pageLayout.height;
    const boxes: Array<{
      id: string;
      leftPct: number;
      topPct: number;
      widthPct: number;
      heightPct: number;
    }> = [];
    const seen = new Set<string>();

    for (const line of pageLayout.lineItems || []) {
      const lineText = line.content.trim().toLowerCase();
      if (!lineText) {
        continue;
      }

      if (!matchesAnyHighlightTerm(lineText)) {
        continue;
      }

      const xValues = line.polygon.map((point) => point.x).filter((value) => Number.isFinite(value));
      const yValues = line.polygon.map((point) => point.y).filter((value) => Number.isFinite(value));
      if (xValues.length === 0 || yValues.length === 0) {
        continue;
      }

      const minX = Math.max(0, Math.min(...xValues));
      const maxX = Math.min(pageWidth, Math.max(...xValues));
      const minY = Math.max(0, Math.min(...yValues));
      const maxY = Math.min(pageHeight, Math.max(...yValues));

      if (maxX <= minX || maxY <= minY) {
        continue;
      }

      const leftPct = (minX / pageWidth) * 100;
      const topPct = (minY / pageHeight) * 100;
      const widthPct = ((maxX - minX) / pageWidth) * 100;
      const heightPct = ((maxY - minY) / pageHeight) * 100;
      const key = `${leftPct.toFixed(3)}:${topPct.toFixed(3)}:${widthPct.toFixed(3)}:${heightPct.toFixed(3)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      boxes.push({
        id: `${lineText.slice(0, 24)}:${key}`,
        leftPct,
        topPct,
        widthPct,
        heightPct,
      });
    }

    return boxes;
  }, [matchesAnyHighlightTerm, normalizedHighlightTermsLower.length, ocrPages, pageNumber]);

  const loadOcrLayout = useCallback(async () => {
    if (ocrLoading) {
      return;
    }

    setOcrAttempted(true);
    setOcrLoading(true);
    setOcrError(null);

    try {
      const response = await api.extractTextFromUrl(fileUrl);
      if (!response.success || !response.data) {
        setOcrError(response.error || 'OCR response unavailable.');
        setOcrPages([]);
        return;
      }

      setOcrPages(response.data.metadata?.pages || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load OCR layout.';
      setOcrError(message);
      setOcrPages([]);
    } finally {
      setOcrLoading(false);
    }
  }, [fileUrl, ocrLoading]);

  const applyTextHighlights = useCallback(() => {
    const container = viewerRef.current;
    if (!container) {
      return;
    }

    // react-pdf v10 / pdfjs-dist v5: text spans are direct <span> children of .textLayer
    const textSpans = container.querySelectorAll<HTMLElement>('.textLayer > span');
    const hasRenderableText = Array.from(textSpans).some((span) => (span.textContent ?? '').trim().length > 0);
    setTextLayerHasText(hasRenderableText);
    textSpans.forEach((span) => {
      span.classList.remove('pdf-highlight-fragment');
      if (normalizedHighlightTermsLower.length === 0) {
        return;
      }

      const text = (span.textContent ?? '').trim().toLowerCase();
      if (!text) {
        return;
      }

      if (matchesAnyHighlightTerm(text)) {
        span.classList.add('pdf-highlight-fragment');
      }
    });
  }, [matchesAnyHighlightTerm, normalizedHighlightTermsLower.length]);

  useEffect(() => {
    // The text layer renders asynchronously after the page canvas.
    // Use a short delay to ensure spans are in the DOM, then observe for late additions.
    const timerId = window.setTimeout(() => {
      applyTextHighlights();
    }, 150);

    const container = viewerRef.current;
    let observer: MutationObserver | null = null;
    if (container) {
      observer = new MutationObserver(() => {
        applyTextHighlights();
      });
      observer.observe(container, { childList: true, subtree: true });
    }

    return () => {
      window.clearTimeout(timerId);
      observer?.disconnect();
    };
  }, [applyTextHighlights, pageNumber, scale, documentKey]);

  useEffect(() => {
    if (
      textLayerHasText === false &&
      normalizedHighlightTermsLower.length > 0 &&
      !ocrAttempted &&
      !ocrLoading
    ) {
      void loadOcrLayout();
    }
  }, [
    loadOcrLayout,
    normalizedHighlightTermsLower.length,
    ocrAttempted,
    ocrLoading,
    textLayerHasText,
  ]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
    setLoadError(null);
    setTextLayerHasText(null);
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
    setTextLayerHasText(null);
    setOcrPages([]);
    setOcrLoading(false);
    setOcrError(null);
    setOcrAttempted(false);
    setRetryCount((prev) => prev + 1);
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/14 bg-slate-950/40">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-100">{fileName}</h3>
          {normalizedHighlightTerms.length > 0 && (
            <p className="mt-0.5 truncate text-[11px] text-slate-300/75">
              Highlighting {Math.min(4, normalizedHighlightTerms.length)} of {normalizedHighlightTerms.length}:{' '}
              {normalizedHighlightTerms.slice(0, 4).join(', ')}
              {normalizedHighlightTerms.length > 4 ? '…' : ''}
            </p>
          )}
          {normalizedHighlightTerms.length > 0 && textLayerHasText === false && (
            <p className="mt-1 text-[11px] text-amber-200/90">
              {ocrLoading
                ? 'No selectable text on this page. Running OCR highlight overlay...'
                : ocrHighlightBoxes.length > 0
                  ? `No selectable text on this page. Showing ${ocrHighlightBoxes.length} OCR highlight region${ocrHighlightBoxes.length > 1 ? 's' : ''}.`
                  : ocrError
                    ? `No selectable text on this page. OCR overlay failed: ${ocrError}`
                    : ocrAttempted
                      ? 'No selectable text on this page. OCR found no matching regions for current fields.'
                      : 'No selectable text on this page. Preparing OCR overlay...'}
            </p>
          )}
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
          <div ref={viewerRef} className="relative flex justify-center">
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
              <div className="relative inline-block">
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  onRenderTextLayerSuccess={applyTextHighlights}
                  className="shadow-2xl"
                />
                {textLayerHasText === false && ocrHighlightBoxes.length > 0 && (
                  <div className="pointer-events-none absolute inset-0 z-[4]">
                    {ocrHighlightBoxes.map((box) => (
                      <div
                        key={box.id}
                        className="pdf-ocr-highlight-box"
                        style={{
                          left: `${box.leftPct}%`,
                          top: `${box.topPct}%`,
                          width: `${box.widthPct}%`,
                          height: `${box.heightPct}%`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
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
