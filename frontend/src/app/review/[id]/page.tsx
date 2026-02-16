'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Document, DOCUMENT_CATEGORIES } from '@/types';
import { getConfidenceLevel } from '@/lib/utils';

export default function ReviewDetailPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    patientName: '',
    reportDate: '',
    subject: '',
    sourceContact: '',
    storeIn: 'Investigations' as 'Investigations' | 'Correspondence',
    assignedDoctor: '',
    category: '',
  });

  useEffect(() => {
    if (documentId) {
      loadDocument();
    }
  }, [documentId]);

  const loadDocument = async () => {
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
        }
      } else {
        setError(response.error || 'Failed to load document');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccess(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await api.updateExtractedData(documentId, formData);
      if (response.success) {
        setSuccess('Changes saved successfully');
        await loadDocument(); // Reload to get updated confidence
      } else {
        setError(response.error || 'Failed to save changes');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Approve this document? It will be marked as completed and ready for PMS import.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const response = await api.approveDocument(documentId);
      if (response.success) {
        setSuccess('Document approved successfully!');
        setTimeout(() => {
          router.push('/review');
        }, 1500);
      } else {
        setError(response.error || 'Failed to approve document');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve document');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return; // User cancelled

    try {
      setSaving(true);
      setError(null);
      const response = await api.rejectDocument(documentId, reason);
      if (response.success) {
        setSuccess('Document rejected');
        setTimeout(() => {
          router.push('/review');
        }, 1500);
      } else {
        setError(response.error || 'Failed to reject document');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject document');
    } finally {
      setSaving(false);
    }
  };

  const FieldRow = ({ label, field, value, confidence }: { label: string; field: keyof typeof formData; value: string; confidence: number }) => {
    const confidenceInfo = getConfidenceLevel(confidence);
    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-700">{label}</label>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${confidenceInfo.bgColor} ${confidenceInfo.color}`}>
            {Math.round(confidence * 100)}%
          </span>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => handleInputChange(field, e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Document not found</h2>
          <Link href="/review" className="text-blue-600 hover:underline">
            Back to Review Queue
          </Link>
        </div>
      </div>
    );
  }

  const extractedData = document.extracted_data?.[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" className="text-2xl font-bold text-blue-600">
                  DocAI
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <Link
                href="/review"
                className="text-sm font-medium text-gray-700 hover:text-blue-600"
              >
                ← Back to Queue
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-4 sm:px-6 lg:px-8">
        <div className="px-4 py-4 sm:px-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{document.file_name}</h1>
          <p className="text-xs text-gray-500 mb-4">Document ID: {document.id}</p>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left column - PDF Viewer Placeholder */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-base font-semibold mb-3">Document Preview</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-gray-600">{document.file_name}</p>
                <p className="text-sm text-gray-500 mt-2">PDF viewer will be added here</p>
                <p className="text-xs text-gray-400 mt-4">File path: {document.file_path}</p>
              </div>
            </div>

            {/* Right column - Extraction Form */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-base font-semibold mb-3">Extracted Data</h2>

              {extractedData && (
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                  <FieldRow
                    label="Patient Name"
                    field="patientName"
                    value={formData.patientName}
                    confidence={extractedData.patient_name_confidence}
                  />

                  <FieldRow
                    label="Report Date"
                    field="reportDate"
                    value={formData.reportDate}
                    confidence={extractedData.report_date_confidence}
                  />

                  <FieldRow
                    label="Subject"
                    field="subject"
                    value={formData.subject}
                    confidence={extractedData.subject_confidence}
                  />

                  <FieldRow
                    label="Source Contact"
                    field="sourceContact"
                    value={formData.sourceContact}
                    confidence={extractedData.source_contact_confidence}
                  />

                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-700">Store In</label>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${getConfidenceLevel(extractedData.store_in_confidence).bgColor} ${getConfidenceLevel(extractedData.store_in_confidence).color}`}>
                        {Math.round(extractedData.store_in_confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <label className="flex items-center text-sm">
                        <input
                          type="radio"
                          value="Investigations"
                          checked={formData.storeIn === 'Investigations'}
                          onChange={(e) => handleInputChange('storeIn', e.target.value)}
                          className="mr-1.5"
                        />
                        Investigations
                      </label>
                      <label className="flex items-center text-sm">
                        <input
                          type="radio"
                          value="Correspondence"
                          checked={formData.storeIn === 'Correspondence'}
                          onChange={(e) => handleInputChange('storeIn', e.target.value)}
                          className="mr-1.5"
                        />
                        Correspondence
                      </label>
                    </div>
                  </div>

                  <FieldRow
                    label="Assigned Doctor"
                    field="assignedDoctor"
                    value={formData.assignedDoctor}
                    confidence={extractedData.assigned_doctor_confidence}
                  />

                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-700">Category</label>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${getConfidenceLevel(extractedData.category_confidence).bgColor} ${getConfidenceLevel(extractedData.category_confidence).color}`}>
                        {Math.round(extractedData.category_confidence * 100)}%
                      </span>
                    </div>
                    <select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select category...</option>
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 bg-gray-600 text-white px-3 py-1.5 text-sm rounded hover:bg-gray-700 disabled:bg-gray-300"
                    >
                      {saving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={saving}
                      className="flex-1 bg-green-600 text-white px-3 py-1.5 text-sm rounded hover:bg-green-700 disabled:bg-gray-300"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={saving}
                      className="flex-1 bg-red-600 text-white px-3 py-1.5 text-sm rounded hover:bg-red-700 disabled:bg-gray-300"
                    >
                      Reject
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
