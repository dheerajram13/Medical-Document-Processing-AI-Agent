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

const LOOKUP_LIST_ID: Record<LookupField, string> = {
  patientName: 'patient-name-options',
  sourceContact: 'source-contact-options',
  assignedDoctor: 'assigned-doctor-options',
};

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
        } else {
          setFormData(EMPTY_FORM_DATA);
          setFieldErrors({});
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

    const matchesLookup = (value: string, options: string[]) =>
      options.some((option) => option.toLowerCase() === value.toLowerCase());

    if (values.patientName && patientLookupOptions.length > 0 && !matchesLookup(values.patientName, patientLookupOptions)) {
      errors.patientName = 'Select a patient from the search list.';
    }

    if (values.sourceContact && sourceLookupOptions.length > 0 && !matchesLookup(values.sourceContact, sourceLookupOptions)) {
      errors.sourceContact = 'Select a source contact from the search list.';
    }

    if (values.assignedDoctor && doctorLookupOptions.length > 0 && !matchesLookup(values.assignedDoctor, doctorLookupOptions)) {
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
    placeholder,
  }: {
    label: string;
    field: LookupField;
    value: string;
    confidence: number;
    error?: string;
    options: string[];
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
          type="text"
          list={LOOKUP_LIST_ID[field]}
          value={value}
          onChange={(e) => handleInputChange(field, e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          className={`w-full rounded-xl border bg-slate-900/45 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-400/60 transition focus:bg-slate-900/60 focus:outline-none focus:ring-2 ${
            error
              ? 'border-rose-300/45 focus:border-rose-300/60 focus:ring-rose-300/20'
              : 'border-white/15 focus:border-sky-200/40 focus:ring-sky-300/30'
          }`}
        />
        <datalist id={LOOKUP_LIST_ID[field]}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        {error ? (
          <p className="mt-2 text-xs text-rose-200/90">{error}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-400/80">Search and select from known values.</p>
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
                    onChange={(e) => handleInputChange('category', e.target.value)}
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
