import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const DISPLAY_TIME_ZONE = 'Australia/Sydney';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Get confidence level and color
export function getConfidenceLevel(confidence: number): {
  level: 'high' | 'medium' | 'low';
  color: string;
  bgColor: string;
  label: string;
} {
  if (confidence >= 0.9) {
    return {
      level: 'high',
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      label: 'High confidence',
    };
  } else if (confidence >= 0.7) {
    return {
      level: 'medium',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      label: 'Medium confidence',
    };
  } else {
    return {
      level: 'low',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      label: 'Needs review',
    };
  }
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Format date
export function formatDate(dateString: string): string {
  // Backend timestamps currently come as ISO strings without timezone suffix.
  // Treat them as UTC for deterministic display, then render in Australia/Sydney.
  const normalized = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(dateString)
    ? dateString
    : `${dateString}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(date);
}

export function formatClockTime(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(value);
}

// Calculate overall confidence
export function calculateOverallConfidence(data: {
  patient_name_confidence: number;
  report_date_confidence: number;
  subject_confidence: number;
  source_contact_confidence: number;
  store_in_confidence: number;
  assigned_doctor_confidence: number;
  category_confidence: number;
}): number {
  const total =
    data.patient_name_confidence +
    data.report_date_confidence +
    data.subject_confidence +
    data.source_contact_confidence +
    data.store_in_confidence +
    data.assigned_doctor_confidence +
    data.category_confidence;
  return total / 7;
}
