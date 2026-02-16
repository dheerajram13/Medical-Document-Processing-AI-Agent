'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { ProcessingStepper } from '@/components/upload/ProcessingStepper';
import { FileIcon, UploadCloud } from '@/components/ui/icons';
import { ToastStack, type ToastItem, type ToastTone } from '@/components/ui/ToastStack';
import { api } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';
import type { ProcessingResult } from '@/types';

const VALID_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function getStepFromProgress(progress: number, hasResult: boolean, uploading: boolean): number {
  if (hasResult) return 4;
  if (!uploading) return 1;
  if (progress < 30) return 1;
  if (progress < 60) return 2;
  if (progress < 90) return 3;
  return 4;
}

function getProgressLabel(progress: number, hasResult: boolean): string {
  if (hasResult) return 'Processing complete. Document queued for review.';
  if (progress < 30) return 'Uploading document...';
  if (progress < 60) return 'Running Azure OCR extraction...';
  if (progress < 90) return 'Extracting 7 fields with Gemini AI...';
  return 'Finalizing and preparing for review...';
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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

  const validateAndAssignFile = useCallback(
    (selectedFile: File) => {
      if (!VALID_FILE_TYPES.includes(selectedFile.type)) {
        addToast('error', 'Unsupported file type', 'Please upload a PDF or DOCX file.');
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        addToast('error', 'File too large', 'Maximum allowed size is 10MB.');
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setProgress(0);
      addToast('info', 'File selected', `${selectedFile.name} is ready for processing.`);
    },
    [addToast],
  );

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      validateAndAssignFile(selectedFile);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const selectedFile = event.dataTransfer.files?.[0];
    if (selectedFile) {
      validateAndAssignFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || uploading) {
      return;
    }

    setUploading(true);
    setProgress(8);
    setResult(null);

    let currentProgress = 8;
    const progressInterval = window.setInterval(() => {
      currentProgress = Math.min(currentProgress + Math.floor(Math.random() * 10) + 5, 92);
      setProgress(currentProgress);
    }, 450);

    try {
      const response = await api.processDocument(file);
      clearInterval(progressInterval);
      setProgress(100);

      if (response.success && response.data) {
        setResult(response.data);
        addToast('success', 'Upload complete', 'Document processed and added to review queue.');
        window.setTimeout(() => {
          router.push('/review');
        }, 1200);
      } else {
        const errorMessage = response.error || 'Please retry upload.';
        const isRateLimited = errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit');

        if (isRateLimited) {
          const serviceName = errorMessage.toLowerCase().includes('gemini')
            ? 'Gemini AI'
            : errorMessage.toLowerCase().includes('azure')
              ? 'Azure OCR'
              : 'API';
          addToast(
            'warning',
            `${serviceName} Rate Limit Reached`,
            `The ${serviceName} quota has been exceeded. Please retry later or increase API limits.`,
          );
        } else {
          addToast('error', 'Processing failed', errorMessage);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error during upload.';
      const isRateLimited = message.includes('429') || message.toLowerCase().includes('rate limit');

      if (isRateLimited) {
        addToast(
          'warning',
          'API Rate Limit Exceeded',
          'Quota reached for this account. Please wait and retry, or use higher-tier keys.',
        );
      } else {
        addToast('error', 'Upload failed', message);
      }
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
    }
  };

  const currentStep = useMemo(
    () => getStepFromProgress(progress, Boolean(result), uploading),
    [progress, result, uploading],
  );

  return (
    <div className="mesh-background mesh-noise relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-emerald-400/12 blur-3xl" />
      <div className="subtle-grid pointer-events-none absolute inset-0 opacity-30" />

      <header className="relative z-10 border-b border-white/10 bg-slate-950/35 backdrop-blur-xl">
        <div className="content-shell flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-slate-100">
            Samantha
            <span className="ml-2 text-xs font-medium text-sky-200/80">Medical Document AI</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/upload" className="rounded-xl border border-sky-200/40 bg-sky-500/16 px-3 py-1.5 text-sky-100">
              Upload
            </Link>
            <Link href="/review" className="rounded-xl border border-white/15 px-3 py-1.5 text-slate-200/85 transition hover:bg-white/10">
              Review Queue
            </Link>
          </nav>
        </div>
      </header>

      <main className="content-shell relative z-10 pb-14 pt-10">
        <section className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-100 md:text-4xl">Upload Document</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300/78 md:text-base">
            Submit a medical PDF or DOCX and run the full extraction pipeline: secure upload, OCR, AI field extraction, and review queue handoff.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="glass-panel soft-glow rounded-[1.8rem] border p-6 md:p-7">
            <div
              className={`dropzone-glow rounded-[1.35rem] border-2 border-dashed border-slate-300/30 p-10 text-center ${
                dragging ? 'is-dragging' : ''
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragging(false);
              }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Upload document dropzone"
            >
              <div className="animate-float mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-sky-200/35 bg-sky-500/18 text-sky-100">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-100 md:text-base">
                Drag and drop your document here, or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-300/75">Supports PDF and DOCX files up to 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={handleFileSelect}
                aria-hidden="true"
              />
            </div>

            {file ? (
              <div className="mt-4 rounded-2xl border border-white/15 bg-slate-900/50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl border border-sky-200/30 bg-sky-500/16 p-2 text-sky-100">
                      <FileIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{file.name}</p>
                      <p className="text-xs text-slate-300/75">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="rounded-lg border border-rose-300/30 px-2.5 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/15"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : null}

            {(uploading || result) && (
              <div className="mt-4 rounded-2xl border border-sky-200/22 bg-slate-950/55 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-100">Processing Progress</span>
                  <span className="font-semibold text-sky-100">{progress}%</span>
                </div>
                <div className="progress-track h-2 overflow-hidden rounded-full">
                  <div className="progress-fill h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-300/80">{getProgressLabel(progress, Boolean(result))}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70 ${
                !file || uploading ? 'cursor-not-allowed bg-slate-500/40 text-slate-300' : 'btn-gradient-primary'
              }`}
            >
              {uploading ? 'Processing Document...' : 'Upload & Process'}
            </button>
          </section>

          <aside className="space-y-6">
            <section className="glass-panel rounded-[1.8rem] border p-5 md:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-200/85">Processing Pipeline</h2>
              <p className="mt-1 text-sm text-slate-300/76">Azure OCR to Gemini extraction to review queue.</p>
              <div className="mt-4">
                <ProcessingStepper currentStep={currentStep} completed={Boolean(result)} />
              </div>
            </section>

            <section className="glass-panel rounded-[1.8rem] border p-5 md:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-200/85">Upload Checklist</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300/82">
                <li className="rounded-xl border border-white/10 bg-slate-900/45 px-3 py-2">Use de-identified PDF/DOCX medical documents</li>
                <li className="rounded-xl border border-white/10 bg-slate-900/45 px-3 py-2">Ensure text is readable for OCR confidence</li>
                <li className="rounded-xl border border-white/10 bg-slate-900/45 px-3 py-2">Review extracted 7 fields before approval</li>
              </ul>
              <Link
                href="/review"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
              >
                Open Review Queue
              </Link>
            </section>
          </aside>
        </div>
      </main>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
