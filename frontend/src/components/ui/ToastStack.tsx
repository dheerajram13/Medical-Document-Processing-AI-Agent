import { X } from './icons';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

function toneStyles(tone: ToastTone): string {
  if (tone === 'success') {
    return 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100';
  }
  if (tone === 'error') {
    return 'border-rose-300/30 bg-rose-500/12 text-rose-100';
  }
  if (tone === 'warning') {
    return 'border-orange-300/30 bg-orange-500/12 text-orange-100';
  }
  return 'border-sky-300/30 bg-sky-500/12 text-sky-100';
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed right-4 top-4 z-50 flex w-[min(92vw,24rem)] flex-col gap-3"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-enter glass-panel rounded-xl border px-4 py-3 ${toneStyles(toast.tone)}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.message ? (
                <p className="mt-1 text-xs text-slate-200/85">{toast.message}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded-lg p-1 text-slate-200/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
