import type { ReactElement, SVGProps } from 'react';
import { ArrowRight, Check, ClipboardCheck, FileIcon, ScanIcon, SparklesIcon } from '@/components/ui/icons';

interface ProcessingStepperProps {
  currentStep: number;
  completed: boolean;
}

interface StepItem {
  id: number;
  title: string;
  description: string;
  icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
}

const steps: StepItem[] = [
  {
    id: 1,
    title: 'Upload Document',
    description: 'PDF/DOCX stored securely',
    icon: FileIcon,
  },
  {
    id: 2,
    title: 'OCR Extraction',
    description: 'Azure Document Intelligence processing',
    icon: ScanIcon,
  },
  {
    id: 3,
    title: 'AI Field Extraction',
    description: 'Gemini AI extracting medical fields',
    icon: SparklesIcon,
  },
  {
    id: 4,
    title: 'Ready for Review',
    description: 'Queued for human approval',
    icon: ClipboardCheck,
  },
];

function stepStyles(stepId: number, currentStep: number, completed: boolean): string {
  const isComplete = completed || stepId < currentStep;
  const isActive = !completed && stepId === currentStep;

  if (isComplete) {
    return 'border-emerald-300/30 bg-emerald-500/14 text-emerald-100';
  }
  if (isActive) {
    return 'border-sky-300/45 bg-sky-500/16 text-sky-100 animate-pulse-soft';
  }
  return 'border-slate-300/15 bg-slate-900/40 text-slate-300/82';
}

function connectorStyles(stepId: number, currentStep: number, completed: boolean): string {
  const isComplete = completed || stepId < currentStep;
  return isComplete ? 'bg-emerald-300/45' : 'bg-slate-300/20';
}

export function ProcessingStepper({ currentStep, completed }: ProcessingStepperProps) {
  return (
    <>
      <ol className="space-y-3 md:hidden">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isComplete = completed || step.id < currentStep;
          return (
            <li key={step.id} className="relative">
              {index !== steps.length - 1 ? (
                <span
                  className={`absolute left-[1.3rem] top-10 h-8 w-px ${connectorStyles(step.id, currentStep, completed)}`}
                  aria-hidden="true"
                />
              ) : null}
              <div className={`rounded-xl border p-3 ${stepStyles(step.id, currentStep, completed)}`}>
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border ${
                      isComplete ? 'border-emerald-200/45 bg-emerald-400/20' : 'border-sky-200/25 bg-slate-900/35'
                    }`}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4 animate-pop text-emerald-100" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="mt-0.5 text-xs text-slate-200/75">{step.description}</p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <ol className="hidden grid-cols-4 gap-3 md:grid">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isComplete = completed || step.id < currentStep;
          const isActive = !completed && step.id === currentStep;
          return (
            <li key={step.id} className="relative">
              {index !== steps.length - 1 ? (
                <div className="pointer-events-none absolute -right-5 top-10 z-10 flex items-center gap-1">
                  <span className={`h-px w-8 ${connectorStyles(step.id, currentStep, completed)}`} />
                  <ArrowRight className={`h-3 w-3 ${isComplete || isActive ? 'text-sky-200/80' : 'text-slate-400/45'}`} />
                </div>
              ) : null}
              <div className={`h-full rounded-xl border p-3 ${stepStyles(step.id, currentStep, completed)}`}>
                <div
                  className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl border ${
                    isComplete ? 'border-emerald-200/45 bg-emerald-400/20' : 'border-sky-200/25 bg-slate-900/35'
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-5 w-5 animate-pop text-emerald-100" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-xs text-slate-200/75">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
