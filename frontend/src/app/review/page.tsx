'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Document } from '@/types';
import { formatDate, getConfidenceLevel, calculateOverallConfidence } from '@/lib/utils';

export default function ReviewQueuePage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.getReviewQueue();
      if (response.success && response.data) {
        setDocuments(response.data);
      } else {
        setError(response.error || 'Failed to load documents');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const getOverallConfidence = (doc: Document) => {
    if (!doc.extracted_data || doc.extracted_data.length === 0) return 0;
    const data = doc.extracted_data[0];
    return calculateOverallConfidence(data);
  };

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
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/upload"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-blue-600"
                >
                  Upload
                </Link>
                <Link
                  href="/review"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-blue-600 border-b-2 border-blue-600"
                >
                  Review Queue
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-4 sm:px-6 lg:px-8">
        <div className="px-4 py-4 sm:px-0">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
            <button
              onClick={loadDocuments}
              className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading documents...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {!loading && documents.length === 0 && (
            <div className="text-center py-8 bg-white rounded-lg shadow">
              <div className="text-4xl mb-3">📭</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No documents to review</h2>
              <p className="text-sm text-gray-500 mb-4">Upload a document to get started</p>
              <Link
                href="/upload"
                className="inline-block bg-blue-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-blue-700"
              >
                Upload Document
              </Link>
            </div>
          )}

          {!loading && documents.length > 0 && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-3 sm:px-6 bg-gray-50">
                <h3 className="text-base leading-6 font-medium text-gray-900">
                  {documents.length} document{documents.length !== 1 ? 's' : ''} awaiting review
                </h3>
              </div>
              <ul className="divide-y divide-gray-200">
                {documents.map((doc) => {
                  const confidence = getOverallConfidence(doc);
                  const confidenceInfo = getConfidenceLevel(confidence);
                  const extractedData = doc.extracted_data?.[0];

                  return (
                    <li
                      key={doc.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/review/${doc.id}`)}
                    >
                      <div className="px-4 py-3 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <h3 className="text-base font-medium text-gray-900 mr-2">
                                {doc.file_name}
                              </h3>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${confidenceInfo.bgColor} ${confidenceInfo.color}`}
                              >
                                {Math.round(confidence * 100)}% {confidenceInfo.label}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                              <div>
                                <p className="text-xs text-gray-500">Patient</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {extractedData?.patient_name || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Date</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {extractedData?.report_date || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Category</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {extractedData?.category || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Doctor</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {extractedData?.assigned_doctor || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="ml-4 flex-shrink-0">
                            <svg
                              className="h-5 w-5 text-gray-400"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path d="M9 5l7 7-7 7"></path>
                            </svg>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500">
                          <span>Uploaded {formatDate(doc.uploaded_at)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
