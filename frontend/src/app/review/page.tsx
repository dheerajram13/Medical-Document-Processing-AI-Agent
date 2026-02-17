'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueueSkeleton } from '@/components/review/QueueSkeleton';
import { ArrowRight, InboxIcon, RefreshCw } from '@/components/ui/icons';
import { StatusBadge, type QueueStatus } from '@/components/ui/StatusBadge';
import { ToastStack, type ToastItem, type ToastTone } from '@/components/ui/ToastStack';
import { api } from '@/lib/api';
import {
  calculateOverallConfidence,
  DISPLAY_TIME_ZONE,
  formatClockTime,
  formatDate,
  getConfidenceLevel,
} from '@/lib/utils';
import type { Document, ExtractedData } from '@/types';

const QUEUE_POLL_INTERVAL_MS = 15000;

function deriveQueueStatus(document: Document): QueueStatus {
  if (document.status === 'completed') {
    return 'approved';
  }
  if (document.status === 'review') {
    return 'review';
  }
  if (document.extracted_data?.length) {
    return 'extracted';
  }
  return 'ocr';
}

function extractedFieldCount(data: ExtractedData | undefined): number {
  if (!data) return 0;

  const requiredFields = [
    data.patient_name,
    data.report_date,
    data.subject,
    data.source_contact,
    data.store_in,
    data.assigned_doctor,
    data.category,
  ];
  return requiredFields.filter(Boolean).length;
}

function confidenceBadgeClass(confidence: number): string {
  const level = getConfidenceLevel(confidence).level;
  if (level === 'high') return 'confidence-high';
  if (level === 'medium') return 'confidence-medium';
  return 'confidence-low';
}

function workflowSummary(data: ExtractedData | undefined): string {
  if (!data) {
    return 'Workflow pending';
  }
  if (data.workflow_type === 'doctor_review_investigations') {
    return 'Doctor review';
  }
  if (data.workflow_type === 'standard_correspondence_review') {
    return 'Correspondence review';
  }
  return data.requires_doctor_review ? 'Doctor review' : 'Workflow pending';
}

function formatLastUpdated(value: Date | null): string {
  if (!value) {
    return 'Not synced yet';
  }

  const formatted = formatClockTime(value);
  return formatted ? `${formatted} (${DISPLAY_TIME_ZONE})` : 'Not synced yet';
}

type LoadDocumentsOptions = {
  manualRefresh?: boolean;
  silent?: boolean;
  background?: boolean;
};

export default function ReviewQueuePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pollingInFlightRef = useRef(false);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((tone: ToastTone, title: string, message?: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, tone, title, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const loadDocuments = useCallback(
    async ({ manualRefresh = false, silent = false, background = false }: LoadDocumentsOptions = {}) => {
      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else if (!background) {
          setLoading(true);
        }

        const response = await api.getReviewQueue();
        if (response.success && response.data) {
          setDocuments(response.data);
          setLastUpdatedAt(new Date());
          if (manualRefresh) {
            addToast('success', 'Queue refreshed', `${response.data.length} document(s) loaded.`);
          }
          return;
        }
        if (!silent) {
          addToast('error', 'Unable to load queue', response.error || 'Please try again.');
        }
      } catch (error) {
        if (!silent) {
          const message = error instanceof Error ? error.message : 'Unexpected queue loading error.';
          addToast('error', 'Unable to load queue', message);
        }
      } finally {
        if (manualRefresh) {
          setRefreshing(false);
        }
        if (!manualRefresh && !background) {
          setLoading(false);
        }
      }
    },
    [addToast],
  );

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || loading || refreshing || pollingInFlightRef.current) {
        return;
      }

      pollingInFlightRef.current = true;
      void loadDocuments({ background: true, silent: true }).finally(() => {
        pollingInFlightRef.current = false;
      });
    }, QUEUE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadDocuments, loading, refreshing]);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible' || loading || refreshing || pollingInFlightRef.current) {
        return;
      }

      pollingInFlightRef.current = true;
      void loadDocuments({ background: true, silent: true }).finally(() => {
        pollingInFlightRef.current = false;
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshOnFocus();
      }
    };

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadDocuments, loading, refreshing]);

  const summary = useMemo(() => {
    const total = documents.length;
    const confidenceValues = documents
      .map((doc) => (doc.extracted_data?.[0] ? calculateOverallConfidence(doc.extracted_data[0]) : null))
      .filter((value): value is number => value !== null);
    const averageConfidence = confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 0;
    const fullyExtracted = documents.filter((doc) => extractedFieldCount(doc.extracted_data?.[0]) >= 7).length;
    const needsReview = documents.filter((doc) => deriveQueueStatus(doc) === 'review').length;
    return { total, averageConfidence, fullyExtracted, needsReview };
  }, [documents]);

  const summaryCards = [
    {
      label: 'Documents in Queue',
      value: String(summary.total),
      helper: 'Awaiting manual review',
      accentClass: 'border-sky-200/28 bg-sky-500/10 text-sky-100',
    },
    {
      label: 'Average Confidence',
      value: `${Math.round(summary.averageConfidence * 100)}%`,
      helper: 'Combined OCR + AI confidence',
      accentClass: 'border-cyan-200/28 bg-cyan-500/10 text-cyan-100',
    },
    {
      label: '7/7 Fields Captured',
      value: String(summary.fullyExtracted),
      helper: 'Ready for fast approval',
      accentClass: 'border-emerald-200/28 bg-emerald-500/10 text-emerald-100',
    },
    {
      label: 'Needs Review',
      value: String(summary.needsReview),
      helper: 'Requires receptionist action',
      accentClass: 'border-amber-200/28 bg-amber-500/10 text-amber-100',
    },
  ];

  return (
    <div className="mesh-background mesh-noise relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-20 right-0 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="subtle-grid pointer-events-none absolute inset-0 opacity-28" />

      <header className="relative z-10 border-b border-white/10 bg-slate-950/35 backdrop-blur-xl">
        <div className="content-shell flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-slate-100">
            Medical Document AI
            <span className="ml-2 text-xs font-medium text-sky-200/85">Document Processing Platform</span>
          </Link>
          <nav className="flex items-center gap-2 text-xs sm:text-sm">
            <Link
              href="/upload"
              className="rounded-xl border border-white/15 px-3 py-1.5 text-slate-200/85 transition hover:bg-white/10"
            >
              Upload
            </Link>
            <Link href="/review" className="rounded-xl border border-sky-200/35 bg-sky-500/16 px-3 py-1.5 text-sky-100">
              Review Queue
            </Link>
          </nav>
        </div>
      </header>

      <main className="content-shell relative z-10 pb-16 pt-8 md:pt-10">
        <section className="glass-panel mb-5 rounded-[1.7rem] border p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-100 md:text-4xl">Review Queue</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300/78 md:text-base">
                Verify extracted fields, make corrections, and approve documents for completion.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="status-pill border border-white/20 bg-white/6 text-slate-200/90">Auto-refresh every 15s</span>
              <span className="rounded-lg border border-white/14 bg-slate-900/46 px-3 py-2 text-xs text-slate-300/82">
                Last sync: {formatLastUpdated(lastUpdatedAt)}
              </span>
              <button
                type="button"
                onClick={() => void loadDocuments({ manualRefresh: true })}
                disabled={refreshing || loading}
                className="inline-flex items-center gap-2 rounded-xl border border-sky-200/35 bg-sky-500/16 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <article key={card.label} className="glass-panel rounded-2xl border px-4 py-4">
              <div className={`mb-2 inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${card.accentClass}`}>
                {card.label}
              </div>
              <p className="text-3xl font-semibold text-slate-100">{card.value}</p>
              <p className="mt-1 text-xs text-slate-300/72">{card.helper}</p>
            </article>
          ))}
        </section>

        {loading ? (
          <QueueSkeleton />
        ) : documents.length === 0 ? (
          <section className="glass-panel soft-glow rounded-[1.8rem] border px-6 py-14 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 animate-float items-center justify-center rounded-2xl border border-sky-200/35 bg-sky-500/16 text-sky-100">
              <InboxIcon className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold text-slate-100">No documents to review yet</h2>
            <p className="mt-2 text-sm text-slate-300/75">Upload a document to get started.</p>
            <Link
              href="/upload"
              className="btn-gradient-primary mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            >
              Upload Document
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        ) : (
          <section className="glass-panel rounded-[1.8rem] border p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-2 border-b border-white/10 pb-4 text-sm text-slate-300/80 sm:flex-row sm:items-center sm:justify-between">
              <p>{documents.length} document(s) awaiting review</p>
              <p className="text-xs text-slate-300/74">7 required fields tracked per document</p>
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
              <div className="min-w-[920px]">
                <div className="grid grid-cols-[2.3fr,1.35fr,1fr,1fr,1.2fr,0.9fr] gap-3 border-b border-white/10 bg-slate-900/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.09em] text-slate-300/80">
                  <span>Document Name</span>
                  <span>Status</span>
                  <span>Fields</span>
                  <span>Confidence</span>
                  <span>Uploaded</span>
                  <span>Action</span>
                </div>
                {documents.map((document) => {
                  const extractedData = document.extracted_data?.[0];
                  const status = deriveQueueStatus(document);
                  const fieldsCount = extractedFieldCount(extractedData);
                  const confidence = extractedData ? calculateOverallConfidence(extractedData) : 0;

                  return (
                    <div
                      key={document.id}
                      className="table-row-glow grid grid-cols-[2.3fr,1.35fr,1fr,1fr,1.2fr,0.9fr] items-center gap-3 border-b border-white/5 bg-slate-950/18 px-4 py-3.5 text-sm last:border-none"
                    >
                      <div>
                        <p className="truncate font-semibold text-slate-100">{document.file_name}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-300/70">{document.mime_type || 'Medical Document'}</p>
                      </div>
                      <div>
                        <StatusBadge status={status} />
                        <p className="mt-1 text-[11px] text-slate-300/70">
                          {workflowSummary(extractedData)}
                        </p>
                      </div>
                      <span className="status-pill border border-sky-200/28 bg-sky-500/12 text-sky-100">{fieldsCount}/7</span>
                      <span className={`status-pill ${confidenceBadgeClass(confidence)}`}>{Math.round(confidence * 100)}%</span>
                      <span className="text-xs text-slate-300/75">{formatDate(document.uploaded_at)}</span>
                      <Link
                        href={`/review/${document.id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-sky-200/30 hover:bg-sky-500/15"
                      >
                        Review
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {documents.map((document) => {
                const extractedData = document.extracted_data?.[0];
                const status = deriveQueueStatus(document);
                const fieldsCount = extractedFieldCount(extractedData);
                const confidence = extractedData ? calculateOverallConfidence(extractedData) : 0;

                return (
                  <article key={document.id} className="table-row-glow rounded-2xl border border-white/10 bg-slate-900/45 p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="line-clamp-2 text-sm font-semibold text-slate-100">{document.file_name}</h3>
                        <p className="mt-1 text-xs text-slate-300/70">{formatDate(document.uploaded_at)}</p>
                      </div>
                      <div>
                        <StatusBadge status={status} />
                        <p className="mt-1 text-[11px] text-slate-300/70">
                          {workflowSummary(extractedData)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-white/10 bg-slate-900/45 p-2">
                        <p className="text-slate-400">Fields</p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">{fieldsCount}/7</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-900/45 p-2">
                        <p className="text-slate-400">Confidence</p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">{Math.round(confidence * 100)}%</p>
                      </div>
                    </div>
                    <Link
                      href={`/review/${document.id}`}
                      className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-200/30 hover:bg-sky-500/15"
                    >
                      Review
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
