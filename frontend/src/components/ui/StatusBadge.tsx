export type QueueStatus = 'ocr' | 'extracted' | 'review' | 'approved';

interface StatusBadgeProps {
  status: QueueStatus;
}

const STATUS_TEXT: Record<QueueStatus, string> = {
  ocr: 'OCR Processing',
  extracted: 'Extracted',
  review: 'Needs Review',
  approved: 'Approved',
};

const STATUS_CLASS: Record<QueueStatus, string> = {
  ocr: 'status-ocr',
  extracted: 'status-extracted',
  review: 'status-review',
  approved: 'status-approved',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-pill ${STATUS_CLASS[status]}`}>{STATUS_TEXT[status]}</span>;
}
