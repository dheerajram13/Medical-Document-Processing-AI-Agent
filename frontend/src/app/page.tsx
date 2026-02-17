import Link from 'next/link';
import type { ReactElement, SVGProps } from 'react';
import {
  ArrowRight,
  CheckCircle,
  ClipboardCheck,
  FileIcon,
  SparklesIcon,
} from '@/components/ui/icons';

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

type FeatureCard = {
  title: string;
  description: string;
  icon: IconComponent;
  accentClass: string;
};

const featureCards: FeatureCard[] = [
  {
    title: 'Secure Ingestion',
    description: 'Drag and drop PDF and DOCX files into an encrypted workflow with intake validation.',
    icon: FileIcon,
    accentClass: 'border-sky-300/30 bg-sky-500/14 text-sky-100',
  },
  {
    title: 'OCR + AI Extraction',
    description: 'Azure OCR and Gemini extraction identify all 7 required medical metadata fields.',
    icon: SparklesIcon,
    accentClass: 'border-cyan-300/30 bg-cyan-500/14 text-cyan-100',
  },
  {
    title: 'Human Review Control',
    description: 'Reception teams verify fields, correct values, and approve with full audit visibility.',
    icon: ClipboardCheck,
    accentClass: 'border-emerald-300/30 bg-emerald-500/14 text-emerald-100',
  },
];

const workflowSteps = [
  'Upload document',
  'Extract text with OCR',
  'Run AI field extraction',
  'Queue for human review',
];

export default function Home() {
  return (
    <div className="mesh-background mesh-noise relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-24 left-[15%] h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-[12%] h-72 w-72 rounded-full bg-emerald-400/12 blur-3xl" />
      <div className="subtle-grid pointer-events-none absolute inset-0 opacity-35" />

      <header className="relative z-10 border-b border-white/10 bg-slate-950/35 backdrop-blur-xl">
        <div className="content-shell flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-slate-100">
            Medical Document AI
            <span className="ml-2 text-xs font-medium text-sky-200/80">Document Processing Platform</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/upload" className="rounded-xl border border-white/15 px-3 py-1.5 text-slate-200/85 transition hover:bg-white/10">
              Upload
            </Link>
            <Link href="/review" className="rounded-xl border border-white/15 px-3 py-1.5 text-slate-200/85 transition hover:bg-white/10">
              Review Queue
            </Link>
          </nav>
        </div>
      </header>

      <main className="content-shell relative z-10 pb-20 pt-12 md:pt-16">
        <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex rounded-full border border-sky-200/30 bg-sky-500/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">
              Enterprise HealthTech Workflow
            </p>
            <h1 className="text-4xl font-bold leading-tight text-slate-100 md:text-6xl">
              <span className="block">Turn Medical Documents into</span>
              <span className="gradient-text mt-2 block">Ready-to-Review Records</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-300/85 md:text-lg">
              Medical Document AI automates OCR and field extraction for your clinic operations team, with clear human checkpoints before final approval.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/upload"
                className="btn-gradient-primary inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white"
              >
                Start Upload
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/review"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
              >
                Open Review Queue
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="glass-panel rounded-2xl border px-4 py-3">
                <p className="text-2xl font-bold text-slate-100">7</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-300/70">Required Fields</p>
              </div>
              <div className="glass-panel rounded-2xl border px-4 py-3">
                <p className="text-2xl font-bold text-slate-100">&lt; 30s</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-300/70">Typical Processing</p>
              </div>
              <div className="glass-panel rounded-2xl border px-4 py-3">
                <p className="text-2xl font-bold text-slate-100">90%+</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-300/70">AI Extraction Accuracy</p>
              </div>
            </div>
          </div>

          <aside className="glass-panel soft-glow rounded-[1.8rem] border p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-200/85">Pipeline Health</h2>
              <span className="status-pill status-approved">Operational</span>
            </div>

            <ol className="space-y-3">
              {workflowSteps.map((step, index) => (
                <li key={step} className="rounded-xl border border-white/10 bg-slate-900/45 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-sky-200/30 bg-sky-500/14 text-xs font-semibold text-sky-100">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{step}</p>
                      <p className="mt-0.5 text-xs text-slate-300/70">
                        {index === 1
                          ? 'Azure Document Intelligence'
                          : index === 2
                            ? 'Gemini extraction and confidence scoring'
                            : index === 3
                              ? 'Receptionist approval required'
                              : 'Stored with metadata for processing'}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-5 rounded-xl border border-emerald-200/25 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-100">
              All core services connected: Supabase, Azure OCR, Gemini API
            </div>
          </aside>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="glass-panel rounded-[1.45rem] border p-5">
                <span className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${feature.accentClass}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-semibold text-slate-100">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300/78">{feature.description}</p>
              </article>
            );
          })}
        </section>

        <section className="glass-panel mt-10 rounded-[1.8rem] border p-6 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-100">Ready for live demo flow</h2>
              <p className="mt-1 text-sm text-slate-300/78">Upload, extract, review, and approve documents in a single operator workflow.</p>
            </div>
            <Link
              href="/upload"
              className="btn-gradient-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            >
              Process a Document
              <CheckCircle className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
