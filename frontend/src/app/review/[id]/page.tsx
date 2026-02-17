'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, CheckCircle, FileText, X } from '@/components/ui/icons';
import { ToastStack, type ToastItem, type ToastTone } from '@/components/ui/ToastStack';
import { api } from '@/lib/api';
import { Document, DOCUMENT_CATEGORIES } from '@/types';
import { formatDate, getConfidenceLevel } from '@/lib/utils';

// Dynamically import PDF viewer to avoid SSR issues
const DocumentViewer = dynamic(
  () => import('@/components/review/DocumentViewer').then((mod) => mod.DocumentViewer),
  { ssr: false }
);

type ReviewFormData = {
  patientName: string;
  reportDate: string;
  subject: string;
  sourceContact: string;
  storeIn: 'Investigations' | 'Correspondence';
  assignedDoctor: string;
  category: string;
};

type ReviewFormField = keyof ReviewFormData;
type FormErrors = Partial<Record<ReviewFormField, string>>;
type LookupField = 'patientName' | 'sourceContact' | 'assignedDoctor';
type LookupState = {
  label: string;
  hint: string;
  tone: 'neutral' | 'success' | 'warning' | 'error';
};

const EMPTY_FORM_DATA: ReviewFormData = {
  patientName: '',
  reportDate: '',
  subject: '',
  sourceContact: '',
  storeIn: 'Investigations',
  assignedDoctor: '',
  category: '',
};

const REQUIRED_FIELDS_FOR_APPROVAL: Array<{ field: ReviewFormField; label: string }> = [
  { field: 'patientName', label: 'Patient Name' },
  { field: 'reportDate', label: 'Report Date' },
  { field: 'subject', label: 'Subject' },
  { field: 'sourceContact', label: 'Source Contact' },
  { field: 'storeIn', label: 'Store In' },
  { field: 'assignedDoctor', label: 'Assigned Doctor' },
  { field: 'category', label: 'Category' },
];

const LOOKUP_MENU_DEFAULT_STATE: Record<LookupField, boolean> = {
  patientName: false,
  sourceContact: false,
  assignedDoctor: false,
};

function matchesLookupValue(value: string, options: string[]) {
  const normalized = value.trim().toLowerCase();
  return options.some((option) => option.trim().toLowerCase() === normalized);
}

const HIGHLIGHT_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'you',
  'your',
]);

const NAME_TITLE_TOKENS = new Set([
  'dr',
  'doctor',
  'mr',
  'mrs',
  'ms',
  'miss',
  'prof',
  'professor',
]);

function isLikelyPersonName(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (/[0-9?!:;=]/.test(normalized)) {
    return false;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) {
    return false;
  }

  return tokens.every((token) => /^[A-Za-z][A-Za-z'.-]*$/.test(token));
}

function tokenizeNameTerms(value: string): string[] {
  return value
    .split(/[\s,./-]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => /^[A-Za-z']+$/.test(token))
    .filter((token) => !HIGHLIGHT_STOPWORDS.has(token.toLowerCase()))
    .filter((token) => !NAME_TITLE_TOKENS.has(token.toLowerCase()));
}

function buildNameHighlightTerms(value: string): string[] {
  if (!isLikelyPersonName(value)) {
    return [];
  }

  const normalized = value.trim();
  const tokens = tokenizeNameTerms(normalized);
  if (tokens.length === 0) {
    return [normalized];
  }

  if (tokens.length === 1) {
    return [normalized, tokens[0]];
  }

  return [normalized, tokens[0], tokens[tokens.length - 1]];
}

function buildDateHighlightTerms(isoDate: string): string[] {
  if (!isIsoDate(isoDate)) {
    return [];
  }

  const [year, month, day] = isoDate.split('-');
  const dayValue = String(Number(day));
  const monthValue = String(Number(month));
  const shortYear = year.slice(-2);

  return [
    isoDate,
    `${day}/${month}/${year}`,
    `${day}-${month}-${year}`,
    `${day}.${month}.${year}`,
    `${day} ${month} ${year}`,
    `${day}/${month}/${shortYear}`,
    `${day}-${month}-${shortYear}`,
    `${day}.${month}.${shortYear}`,
    `${day} ${month} ${shortYear}`,
    `${dayValue}/${monthValue}/${year}`,
    `${dayValue}-${monthValue}-${year}`,
    `${dayValue}.${monthValue}.${year}`,
    `${dayValue} ${monthValue} ${year}`,
    `${dayValue}/${monthValue}/${shortYear}`,
    `${dayValue}-${monthValue}-${shortYear}`,
    `${dayValue}.${monthValue}.${shortYear}`,
    `${dayValue} ${monthValue} ${shortYear}`,
  ];
}

function buildSubjectHighlightTerms(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 3) {
    return [];
  }

  const terms: string[] = [trimmed];

  // Also extract meaningful multi-word fragments (3+ char tokens, skip stopwords)
  const tokens = trimmed
    .split(/[\s,/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .filter((t) => !HIGHLIGHT_STOPWORDS.has(t.toLowerCase()));

  for (const token of tokens) {
    terms.push(token);
  }

  return terms;
}

function buildPdfHighlightTerms(values: ReviewFormData): string[] {
  const nameTerms = [
    ...buildNameHighlightTerms(values.patientName),
    ...buildNameHighlightTerms(values.sourceContact),
    ...buildNameHighlightTerms(values.assignedDoctor),
  ];

  const dateTerms = buildDateHighlightTerms(values.reportDate.trim());
  const subjectTerms = buildSubjectHighlightTerms(values.subject);
  const allTerms = [...nameTerms, ...dateTerms, ...subjectTerms];
  const deduped = new Map<string, string>();
  for (const term of allTerms) {
    const key = term.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, term);
    }
  }

  return Array.from(deduped.values());
}

function buildLookupState(value: string, options: string[], loading: boolean): LookupState {
  const normalized = value.trim();
  if (!normalized) {
    return {
      label: 'Missing',
      hint: 'Required before approval.',
      tone: 'warning',
    };
  }

  if (loading) {
    return {
      label: 'Checking',
      hint: 'Searching lookup values…',
      tone: 'neutral',
    };
  }

  if (options.length === 0) {
    return {
      label: 'No lookup data',
      hint: 'No matches returned for this query.',
      tone: 'warning',
    };
  }

  if (matchesLookupValue(normalized, options)) {
    return {
      label: 'Found',
      hint: 'Matches a lookup value.',
      tone: 'success',
    };
  }

  return {
    label: 'Not found',
    hint: 'Select a value from the lookup list.',
    tone: 'error',
  };
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeFormData(values: ReviewFormData): ReviewFormData {
  return {
    patientName: values.patientName.trim(),
    reportDate: values.reportDate.trim(),
    subject: values.subject.trim(),
    sourceContact: values.sourceContact.trim(),
    storeIn: values.storeIn,
    assignedDoctor: values.assignedDoctor.trim(),
    category: values.category.trim(),
  };
}

function getDocumentStatusLabel(status: Document['status']): string {
  if (status === 'completed') return 'Approved';
  if (status === 'review') return 'Needs Review';
  if (status === 'processing') return 'Processing';
  if (status === 'failed') return 'Failed';
  return 'Pending';
}

function getDocumentStatusClass(status: Document['status']): string {
  if (status === 'completed') return 'status-approved';
  if (status === 'review') return 'status-review';
  if (status === 'processing') return 'status-ocr';
  if (status === 'failed') return 'confidence-low';
  return 'status-extracted';
}

function getWorkflowLabel(
  workflowType: 'doctor_review_investigations' | 'standard_correspondence_review' | null | undefined,
): string {
  if (workflowType === 'doctor_review_investigations') {
    return 'Doctor Review Workflow';
  }
  if (workflowType === 'standard_correspondence_review') {
    return 'Correspondence Workflow';
  }
  return 'Workflow Pending';
}

export default function ReviewDetailPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Form state
  const [formData, setFormData] = useState<ReviewFormData>(EMPTY_FORM_DATA);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [patientLookupOptions, setPatientLookupOptions] = useState<string[]>([]);
  const [sourceLookupOptions, setSourceLookupOptions] = useState<string[]>([]);
  const [doctorLookupOptions, setDoctorLookupOptions] = useState<string[]>([]);
  const [lookupLoading, setLookupLoading] = useState<Record<LookupField, boolean>>({
    patientName: false,
    sourceContact: false,
    assignedDoctor: false,
  });
  const [lookupMenuOpen, setLookupMenuOpen] = useState<Record<LookupField, boolean>>(LOOKUP_MENU_DEFAULT_STATE);

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

  const loadDocument = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getDocument(documentId);
      if (response.success && response.data) {
        setDocument(response.data);

        // Populate form with extracted data
        const extracted = response.data.extracted_data?.[0];
        if (extracted) {
          setFormData({
            patientName: extracted.patient_name || '',
            reportDate: extracted.report_date || '',
            subject: extracted.subject || '',
            sourceContact: extracted.source_contact || '',
            storeIn: (extracted.store_in || 'Investigations') as 'Investigations' | 'Correspondence',
            assignedDoctor: extracted.assigned_doctor || '',
            category: extracted.category || '',
          });
          setFieldErrors({});
          setLookupMenuOpen(LOOKUP_MENU_DEFAULT_STATE);
        } else {
          setFormData(EMPTY_FORM_DATA);
          setFieldErrors({});
          setLookupMenuOpen(LOOKUP_MENU_DEFAULT_STATE);
        }
      } else {
        addToast('error', 'Failed to load document', response.error || 'Please try again.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load document';
      addToast('error', 'Failed to load document', message);
    } finally {
      setLoading(false);
    }
  }, [documentId, addToast]);

  useEffect(() => {
    if (documentId) {
      void loadDocument();
    }
  }, [documentId, loadDocument]);

  const loadLookupOptions = useCallback(async (field: LookupField, query: string) => {
    setLookupLoading((prev) => ({ ...prev, [field]: true }));
    try {
      if (field === 'patientName') {
        const response = await api.getPatientLookup(query);
        if (response.success && response.data) {
          setPatientLookupOptions(response.data);
        }
        return;
      }

      if (field === 'sourceContact') {
        const response = await api.getSourceContactLookup(query);
        if (response.success && response.data) {
          setSourceLookupOptions(response.data);
        }
        return;
      }

      const response = await api.getDoctorLookup(query);
      if (response.success && response.data) {
        setDoctorLookupOptions(response.data);
      }
    } catch (error) {
      // Silent failure: review form should remain usable if lookup APIs are unavailable.
      console.warn(`Lookup fetch failed for ${field}`, error);
    } finally {
      setLookupLoading((prev) => ({ ...prev, [field]: false }));
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadLookupOptions('patientName', formData.patientName);
    }, 250);
    return () => window.clearTimeout(timerId);
  }, [formData.patientName, loadLookupOptions]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadLookupOptions('sourceContact', formData.sourceContact);
    }, 250);
    return () => window.clearTimeout(timerId);
  }, [formData.sourceContact, loadLookupOptions]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadLookupOptions('assignedDoctor', formData.assignedDoctor);
    }, 250);
    return () => window.clearTimeout(timerId);
  }, [formData.assignedDoctor, loadLookupOptions]);

  const validateForm = useCallback((values: ReviewFormData, mode: 'save' | 'approve'): FormErrors => {
    const errors: FormErrors = {};

    if (mode === 'approve') {
      REQUIRED_FIELDS_FOR_APPROVAL.forEach(({ field, label }) => {
        const value = values[field];
        const trimmed = typeof value === 'string' ? value.trim() : value;
        if (!trimmed) {
          errors[field] = `${label} is required for approval.`;
        }
      });
    }

    const reportDate = values.reportDate.trim();
    if (reportDate && !isIsoDate(reportDate)) {
      errors.reportDate = 'Report Date must use YYYY-MM-DD format.';
    }

    if (values.category && !DOCUMENT_CATEGORIES.includes(values.category as (typeof DOCUMENT_CATEGORIES)[number])) {
      errors.category = 'Please choose a valid category from the list.';
    }

    if (!['Investigations', 'Correspondence'].includes(values.storeIn)) {
      errors.storeIn = 'Store In must be Investigations or Correspondence.';
    }

    return errors;
  }, []);

  const validateLookupSelections = useCallback((values: ReviewFormData): FormErrors => {
    const errors: FormErrors = {};

    if (values.patientName && patientLookupOptions.length > 0 && !matchesLookupValue(values.patientName, patientLookupOptions)) {
      errors.patientName = 'Select a patient from the search list.';
    }

    if (values.sourceContact && sourceLookupOptions.length > 0 && !matchesLookupValue(values.sourceContact, sourceLookupOptions)) {
      errors.sourceContact = 'Select a source contact from the search list.';
    }

    if (values.assignedDoctor && doctorLookupOptions.length > 0 && !matchesLookupValue(values.assignedDoctor, doctorLookupOptions)) {
      errors.assignedDoctor = 'Select a doctor from the search list.';
    }

    return errors;
  }, [patientLookupOptions, sourceLookupOptions, doctorLookupOptions]);

  const handleInputChange = <K extends ReviewFormField>(field: K, value: ReviewFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const toggleLookupMenu = useCallback((field: LookupField, open: boolean) => {
    setLookupMenuOpen((prev) => {
      if (open) {
        return {
          patientName: field === 'patientName',
          sourceContact: field === 'sourceContact',
          assignedDoctor: field === 'assignedDoctor',
        };
      }
      if (!prev[field]) {
        return prev;
      }
      return { ...prev, [field]: false };
    });
  }, []);

  const closeLookupMenuWithDelay = useCallback((field: LookupField) => {
    window.setTimeout(() => {
      toggleLookupMenu(field, false);
    }, 120);
  }, [toggleLookupMenu]);

  const handleSave = async () => {
    const normalizedData = normalizeFormData(formData);
    const validationErrors = validateForm(normalizedData, 'save');
    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      addToast('error', 'Please fix validation errors', 'Correct highlighted fields before saving.');
      return;
    }

    try {
      setSaving(true);
      setFormData(normalizedData);
      const response = await api.updateExtractedData(documentId, normalizedData);
      if (response.success) {
        addToast('success', 'Changes saved', 'Document updated successfully.');
        await loadDocument();
      } else {
        addToast('error', 'Failed to save changes', response.error || 'Please try again.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save changes';
      addToast('error', 'Failed to save changes', message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    const normalizedData = normalizeFormData(formData);
    const validationErrors = {
      ...validateForm(normalizedData, 'approve'),
      ...validateLookupSelections(normalizedData),
    };
    setFieldErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      addToast('error', 'Validation required', 'Complete required fields and select lookup values before approval.');
      return;
    }

    if (!confirm('Approve this document? It will be marked as completed.')) {
      return;
    }

    try {
      setSaving(true);
      setFormData(normalizedData);
      const saveResponse = await api.updateExtractedData(documentId, normalizedData);
      if (!saveResponse.success) {
        addToast('error', 'Failed to save changes', saveResponse.error || 'Please try again.');
        return;
      }

      const response = await api.approveDocument(documentId);
      if (response.success) {
        addToast('success', 'Document approved');
        setTimeout(() => {
          router.push('/review');
        }, 1200);
      } else {
        addToast('error', 'Failed to approve document', response.error || 'Please try again.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve document';
      addToast('error', 'Failed to approve document', message);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return;

    try {
      setSaving(true);
      const response = await api.rejectDocument(documentId, reason);
      if (response.success) {
        addToast('info', 'Document rejected', reason || undefined);
        setTimeout(() => {
          router.push('/review');
        }, 1200);
      } else {
        addToast('error', 'Failed to reject document', response.error || 'Please try again.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reject document';
      addToast('error', 'Failed to reject document', message);
    } finally {
      setSaving(false);
    }
  };

  const FieldRow = ({
    label,
    field,
    value,
    confidence,
    error,
    type = 'text',
    placeholder,
  }: {
    label: string;
    field: ReviewFormField;
    value: string;
    confidence: number;
    error?: string;
    type?: 'text' | 'date';
    placeholder?: string;
  }) => {
    const confidenceLevel = getConfidenceLevel(confidence).level;
    const confidenceClass =
      confidenceLevel === 'high' ? 'confidence-high' : confidenceLevel === 'medium' ? 'confidence-medium' : 'confidence-low';

    return (
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-300/85">{label}</label>
          <span className={`status-pill ${confidenceClass}`}>{Math.round(confidence * 100)}%</span>
        </div>
        <input
          type={type}
          value={value}
          onChange={(e) => handleInputChange(field, e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className={`w-full rounded-xl border bg-slate-900/45 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400/60 transition focus:bg-slate-900/60 focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-300/45 focus:border-rose-300/60 focus:ring-rose-300/20'
              : 'border-white/15 focus:border-sky-200/40 focus:ring-sky-300/30'
          }`}
        />
        {error && <p className="mt-2 text-xs text-rose-200/90">{error}</p>}
      </div>
    );
  };

  const LookupFieldRow = ({
    label,
    field,
    value,
    confidence,
    error,
    options,
    lookupState,
    menuOpen,
    placeholder,
  }: {
    label: string;
    field: LookupField;
    value: string;
    confidence: number;
    error?: string;
    options: string[];
    lookupState: LookupState;
    menuOpen: boolean;
    placeholder?: string;
  }) => {
    const confidenceLevel = getConfidenceLevel(confidence).level;
    const confidenceClass =
      confidenceLevel === 'high' ? 'confidence-high' : confidenceLevel === 'medium' ? 'confidence-medium' : 'confidence-low';
    const lookupClass =
      lookupState.tone === 'success'
        ? 'border border-emerald-300/40 bg-emerald-500/15 text-emerald-100'
        : lookupState.tone === 'error'
          ? 'border border-rose-300/45 bg-rose-500/15 text-rose-100'
          : lookupState.tone === 'warning'
            ? 'border border-amber-300/40 bg-amber-500/15 text-amber-100'
            : 'border border-white/20 bg-white/5 text-slate-200';
    const showMenu = menuOpen && options.length > 0;
    const visibleOptions = options.slice(0, 8);

    return (
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-300/85">{label}</label>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${lookupClass}`}>{lookupState.label}</span>
            <span className={`status-pill ${confidenceClass}`}>{Math.round(confidence * 100)}%</span>
          </div>
        </div>
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              handleInputChange(field, e.target.value);
              toggleLookupMenu(field, true);
            }}
            onFocus={() => {
              if (options.length > 0) {
                toggleLookupMenu(field, true);
              }
            }}
            onBlur={() => closeLookupMenuWithDelay(field)}
            placeholder={placeholder}
            autoComplete="off"
            aria-invalid={Boolean(error)}
            className={`w-full rounded-xl border bg-slate-900/45 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400/60 transition focus:bg-slate-900/60 focus:outline-none focus:ring-2 ${
              error
                ? 'border-rose-300/45 focus:border-rose-300/60 focus:ring-rose-300/20'
                : 'border-white/15 focus:border-sky-200/40 focus:ring-sky-300/30'
            }`}
          />
          {showMenu && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-52 overflow-y-auto rounded-xl border border-white/15 bg-slate-900/98 p-1 shadow-2xl">
              {visibleOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleInputChange(field, option);
                    toggleLookupMenu(field, false);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-sky-500/18 hover:text-sky-100"
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-2 text-xs text-rose-200/90">{error}</p>
        ) : (
          <p
            className={`mt-2 text-xs ${
              lookupState.tone === 'success'
                ? 'text-emerald-200/85'
                : lookupState.tone === 'error'
                  ? 'text-rose-200/85'
                  : lookupState.tone === 'warning'
                    ? 'text-amber-200/85'
                    : 'text-slate-400/80'
            }`}
          >
            {lookupState.hint}
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="mesh-background mesh-noise relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="glass-panel soft-glow rounded-[2rem] border p-8 text-center">
          <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-b-2 border-t-2 border-sky-400" />
          <p className="text-sm text-slate-300/75">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="mesh-background mesh-noise relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="glass-panel soft-glow rounded-[2rem] border p-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-200/35 bg-rose-500/16 text-rose-100">
            <FileText className="h-8 w-8" />
          </div>
          <h2 className="mb-3 text-xl font-bold text-slate-100">Document not found</h2>
          <p className="mb-5 text-sm text-slate-300/75">
            The document you&rsquo;re looking for doesn&rsquo;t exist or was removed.
          </p>
          <Link
            href="/review"
            className="btn-gradient-primary inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
          >
            Back to Review Queue
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const extractedData = document.extracted_data?.[0];
  const encodedFilePath = document.file_path
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  const fallbackPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${encodedFilePath}`
    : '';
  const documentFileUrl = document.file_signed_url || fallbackPublicUrl;
  const statusLabel = getDocumentStatusLabel(document.status);
  const statusClass = getDocumentStatusClass(document.status);
  const pdfHighlightTerms = buildPdfHighlightTerms(formData);
  const patientLookupState = buildLookupState(formData.patientName, patientLookupOptions, lookupLoading.patientName);
  const sourceLookupState = buildLookupState(formData.sourceContact, sourceLookupOptions, lookupLoading.sourceContact);
  const doctorLookupState = buildLookupState(formData.assignedDoctor, doctorLookupOptions, lookupLoading.assignedDoctor);

  return (
    <div className="mesh-background mesh-noise relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-20 left-1/4 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-1/4 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="subtle-grid pointer-events-none absolute inset-0 opacity-28" />

      <header className="relative z-10 border-b border-white/10 bg-slate-950/35 backdrop-blur-xl">
        <div className="content-shell-wide flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-slate-100">
            Samantha
            <span className="ml-2 text-xs font-medium text-sky-200/85">Medical Document AI</span>
          </Link>
          <Link
            href="/review"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-1.5 text-sm text-slate-200/85 transition hover:bg-white/10"
          >
            ← Back to Queue
          </Link>
        </div>
      </header>

      <main className="content-shell-wide relative z-10 pb-16 pt-8">
        <div className="mb-6 rounded-2xl border border-white/12 bg-slate-900/42 px-4 py-4 md:px-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold text-slate-100 md:text-3xl">{document.file_name}</h1>
              <p className="mt-1 text-xs text-slate-300/65">Document ID: {document.id}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
              <span className="status-pill border border-white/20 bg-white/5 text-slate-100">
                Uploaded {formatDate(document.uploaded_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          {/* Left column - Document Preview */}
          <section className="glass-panel h-[800px] rounded-[1.8rem] border p-5 md:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-200/80">Document Preview</h2>
            <div className="h-[calc(100%-3rem)]">
              {document.mime_type === 'application/pdf' ? (
                <DocumentViewer
                  key={documentFileUrl}
                  fileUrl={documentFileUrl}
                  fileName={document.file_name}
                  highlightTerms={pdfHighlightTerms}
                />
              ) : (
                <div className="dropzone-glow flex h-full items-center justify-center rounded-[1.5rem] border-2 border-dashed p-10 text-center">
                  <div>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-200/35 bg-sky-500/16 text-sky-100">
                      <FileText className="h-8 w-8" />
                    </div>
                    <p className="mb-2 text-sm font-semibold text-slate-100">{document.file_name}</p>
                    <p className="text-xs text-slate-300/75">Preview not available for DOCX files</p>
                    <p className="mt-4 truncate text-xs text-slate-400/60">{document.file_path}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right column - Extraction Form */}
          <section className="glass-panel rounded-[1.8rem] border p-5 md:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-200/80">Extracted Data (7 Fields)</h2>
            <p className="mb-4 text-xs text-slate-300/70">All fields are required before approval. Save Draft allows partial progress.</p>
            <div className="mb-4 rounded-xl border border-sky-200/22 bg-slate-900/45 px-3 py-2 text-xs text-slate-300/82">
              Lookup fields (Patient, Source Contact, Assigned Doctor) should be chosen from search results when available.
            </div>
            {extractedData && (
              <div className="mb-4 rounded-xl border border-emerald-200/24 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100/90">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">Workflow Route</span>
                  <span className="status-pill border border-emerald-200/35 bg-emerald-500/20 text-emerald-100">
                    {getWorkflowLabel(extractedData.workflow_type)}
                  </span>
                </div>
                <p className="mt-1">
                  Requires doctor review: {extractedData.requires_doctor_review ? 'Yes' : 'No'}
                </p>
                {extractedData.workflow_reason ? (
                  <p className="mt-1 text-[11px] text-emerald-100/80">
                    Rule: {extractedData.workflow_reason}
                  </p>
                ) : null}
              </div>
            )}

            {extractedData && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSave();
                }}
              >
                <LookupFieldRow
                  label="Patient Name"
                  field="patientName"
                  value={formData.patientName}
                  confidence={extractedData.patient_name_confidence}
                  error={fieldErrors.patientName}
                  options={patientLookupOptions}
                  lookupState={patientLookupState}
                  menuOpen={lookupMenuOpen.patientName}
                  placeholder="Search patient name"
                />

                <FieldRow
                  label="Report Date"
                  field="reportDate"
                  value={formData.reportDate}
                  confidence={extractedData.report_date_confidence}
                  error={fieldErrors.reportDate}
                  type="date"
                  placeholder="YYYY-MM-DD"
                />

                <FieldRow
                  label="Subject"
                  field="subject"
                  value={formData.subject}
                  confidence={extractedData.subject_confidence}
                  error={fieldErrors.subject}
                />

                <LookupFieldRow
                  label="Source Contact"
                  field="sourceContact"
                  value={formData.sourceContact}
                  confidence={extractedData.source_contact_confidence}
                  error={fieldErrors.sourceContact}
                  options={sourceLookupOptions}
                  lookupState={sourceLookupState}
                  menuOpen={lookupMenuOpen.sourceContact}
                  placeholder="Search source contact"
                />

                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-300/85">Store In</label>
                    <span
                      className={`status-pill ${
                        getConfidenceLevel(extractedData.store_in_confidence).level === 'high'
                          ? 'confidence-high'
                          : getConfidenceLevel(extractedData.store_in_confidence).level === 'medium'
                            ? 'confidence-medium'
                            : 'confidence-low'
                      }`}
                    >
                      {Math.round(extractedData.store_in_confidence * 100)}%
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <label
                      className={`flex flex-1 cursor-pointer items-center rounded-xl border bg-slate-900/45 px-4 py-2.5 text-sm text-slate-100 transition hover:border-sky-200/30 hover:bg-sky-500/12 ${
                        fieldErrors.storeIn ? 'border-rose-300/45' : 'border-white/15'
                      }`}
                    >
                      <input
                        type="radio"
                        value="Investigations"
                        checked={formData.storeIn === 'Investigations'}
                        onChange={(e) => handleInputChange('storeIn', e.target.value as ReviewFormData['storeIn'])}
                        className="mr-2"
                      />
                      Investigations
                    </label>
                    <label
                      className={`flex flex-1 cursor-pointer items-center rounded-xl border bg-slate-900/45 px-4 py-2.5 text-sm text-slate-100 transition hover:border-sky-200/30 hover:bg-sky-500/12 ${
                        fieldErrors.storeIn ? 'border-rose-300/45' : 'border-white/15'
                      }`}
                    >
                      <input
                        type="radio"
                        value="Correspondence"
                        checked={formData.storeIn === 'Correspondence'}
                        onChange={(e) => handleInputChange('storeIn', e.target.value as ReviewFormData['storeIn'])}
                        className="mr-2"
                      />
                      Correspondence
                    </label>
                  </div>
                  {fieldErrors.storeIn && <p className="mt-2 text-xs text-rose-200/90">{fieldErrors.storeIn}</p>}
                </div>

                <LookupFieldRow
                  label="Assigned Doctor"
                  field="assignedDoctor"
                  value={formData.assignedDoctor}
                  confidence={extractedData.assigned_doctor_confidence}
                  error={fieldErrors.assignedDoctor}
                  options={doctorLookupOptions}
                  lookupState={doctorLookupState}
                  menuOpen={lookupMenuOpen.assignedDoctor}
                  placeholder="Search GP doctor"
                />

                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-300/85">Category</label>
                    <span
                      className={`status-pill ${
                        getConfidenceLevel(extractedData.category_confidence).level === 'high'
                          ? 'confidence-high'
                          : getConfidenceLevel(extractedData.category_confidence).level === 'medium'
                            ? 'confidence-medium'
                            : 'confidence-low'
                      }`}
                    >
                      {Math.round(extractedData.category_confidence * 100)}%
                    </span>
                  </div>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const nextCategory = e.target.value;
                      handleInputChange('category', nextCategory);
                      if (['Medical imaging report', 'Pathology results', 'ECG'].includes(nextCategory)) {
                        handleInputChange('storeIn', 'Investigations');
                      }
                    }}
                    aria-invalid={Boolean(fieldErrors.category)}
                    className={`w-full rounded-xl border bg-slate-900/45 px-4 py-2.5 text-sm text-slate-100 transition focus:bg-slate-900/60 focus:outline-none focus:ring-2 ${
                      fieldErrors.category
                        ? 'border-rose-300/45 focus:border-rose-300/60 focus:ring-rose-300/20'
                        : 'border-white/15 focus:border-sky-200/40 focus:ring-sky-300/30'
                    }`}
                  >
                    <option value="">Select category...</option>
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.category && <p className="mt-2 text-xs text-rose-200/90">{fieldErrors.category}</p>}
                </div>

                {/* Additional AI-Extracted Fields (read-only info) */}
                {extractedData && (extractedData.patient_dob || extractedData.patient_id || extractedData.specialist || extractedData.facility || extractedData.summary) && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300/70">Additional Extracted Info</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                      {extractedData.patient_dob && (
                        <div>
                          <span className="text-slate-400">DOB:</span>{' '}
                          <span className="text-slate-100">{extractedData.patient_dob}</span>
                          <span className={`ml-1.5 text-[10px] font-semibold ${
                            getConfidenceLevel(extractedData.patient_dob_confidence).level === 'high' ? 'text-emerald-300' :
                            getConfidenceLevel(extractedData.patient_dob_confidence).level === 'medium' ? 'text-amber-300' : 'text-rose-300'
                          }`}>{Math.round(extractedData.patient_dob_confidence * 100)}%</span>
                        </div>
                      )}
                      {extractedData.patient_id && (
                        <div>
                          <span className="text-slate-400">MRN:</span>{' '}
                          <span className="text-slate-100">{extractedData.patient_id}</span>
                          <span className={`ml-1.5 text-[10px] font-semibold ${
                            getConfidenceLevel(extractedData.patient_id_confidence).level === 'high' ? 'text-emerald-300' :
                            getConfidenceLevel(extractedData.patient_id_confidence).level === 'medium' ? 'text-amber-300' : 'text-rose-300'
                          }`}>{Math.round(extractedData.patient_id_confidence * 100)}%</span>
                        </div>
                      )}
                      {extractedData.specialist && (
                        <div>
                          <span className="text-slate-400">Specialist:</span>{' '}
                          <span className="text-slate-100">{extractedData.specialist}</span>
                          <span className={`ml-1.5 text-[10px] font-semibold ${
                            getConfidenceLevel(extractedData.specialist_confidence).level === 'high' ? 'text-emerald-300' :
                            getConfidenceLevel(extractedData.specialist_confidence).level === 'medium' ? 'text-amber-300' : 'text-rose-300'
                          }`}>{Math.round(extractedData.specialist_confidence * 100)}%</span>
                        </div>
                      )}
                      {extractedData.facility && (
                        <div>
                          <span className="text-slate-400">Facility:</span>{' '}
                          <span className="text-slate-100">{extractedData.facility}</span>
                          <span className={`ml-1.5 text-[10px] font-semibold ${
                            getConfidenceLevel(extractedData.facility_confidence).level === 'high' ? 'text-emerald-300' :
                            getConfidenceLevel(extractedData.facility_confidence).level === 'medium' ? 'text-amber-300' : 'text-rose-300'
                          }`}>{Math.round(extractedData.facility_confidence * 100)}%</span>
                        </div>
                      )}
                      {extractedData.urgency && extractedData.urgency !== 'Normal' && (
                        <div className="col-span-2">
                          <span className="text-slate-400">Urgency:</span>{' '}
                          <span className={`font-semibold ${
                            extractedData.urgency === 'Critical' ? 'text-rose-300' :
                            extractedData.urgency === 'Urgent' ? 'text-amber-300' : 'text-slate-100'
                          }`}>{extractedData.urgency}</span>
                        </div>
                      )}
                    </div>
                    {extractedData.summary && (
                      <div className="mt-3 border-t border-white/8 pt-3">
                        <span className="text-xs text-slate-400">AI Summary:</span>
                        <p className="mt-1 text-sm leading-relaxed text-slate-200/90">{extractedData.summary}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApprove()}
                    disabled={saving}
                    className="btn-gradient-primary flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReject()}
                    disabled={saving}
                    className="flex-1 rounded-xl border border-rose-300/30 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="inline h-4 w-4" /> Reject
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </main>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
