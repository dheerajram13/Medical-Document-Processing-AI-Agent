'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      // Validate file type
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(selectedFile.type)) {
        setError('Please select a PDF or DOCX file');
        return;
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];

      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(selectedFile.type)) {
        setError('Please select a PDF or DOCX file');
        return;
      }

      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(10);
    setError(null);
    setResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const response = await api.processDocument(file);

      clearInterval(progressInterval);
      setProgress(100);

      if (response.success) {
        setResult(response.data);
        setTimeout(() => {
          router.push('/review');
        }, 2000);
      } else {
        setError(response.error || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
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
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-blue-600 border-b-2 border-blue-600"
                >
                  Upload
                </Link>
                <Link
                  href="/review"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-blue-600"
                >
                  Review Queue
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto py-4 sm:px-6 lg:px-8">
        <div className="px-4 py-4 sm:px-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Upload Document</h1>

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div className="text-4xl mb-3">📄</div>
            <p className="text-base text-gray-600 mb-1">
              Drag and drop your document here, or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Supports PDF and DOCX files up to 10MB
            </p>
            <input
              id="file-input"
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {file && (
            <div className="mt-4 bg-white p-3 rounded-lg shadow">
              <h3 className="text-base font-semibold mb-2">Selected File</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {uploading && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-800 font-medium">Processing...</span>
                <span className="text-blue-600">{progress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-blue-600 mt-2">
                {progress < 30 && 'Uploading document...'}
                {progress >= 30 && progress < 60 && 'Running OCR extraction...'}
                {progress >= 60 && progress < 90 && 'AI extracting fields...'}
                {progress >= 90 && 'Finalizing...'}
              </p>
            </div>
          )}

          {result && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
              <h3 className="text-base font-semibold text-green-800 mb-2">
                ✓ Document processed successfully!
              </h3>
              <p className="text-green-700 mb-2">
                Extracted {result.extractedData?.patientName || 'patient data'} from {result.ocrResult?.pages || 1} page(s)
              </p>
              <p className="text-sm text-green-600">
                Redirecting to review queue...
              </p>
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className={`w-full py-2 px-4 rounded-lg font-medium text-white ${
                !file || uploading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {uploading ? 'Processing...' : 'Upload and Process'}
            </button>
          </div>

          <div className="mt-6 bg-white p-4 rounded-lg shadow">
            <h3 className="text-base font-semibold mb-3">Processing Pipeline</h3>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold mr-2 text-sm">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium">Upload Document</p>
                  <p className="text-xs text-gray-500">Upload PDF/DOCX to storage</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold mr-2 text-sm">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium">OCR Extraction</p>
                  <p className="text-xs text-gray-500">Azure Document Intelligence extracts text</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold mr-2 text-sm">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium">AI Field Extraction</p>
                  <p className="text-xs text-gray-500">Gemini AI extracts 7 medical fields</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold mr-2 text-sm">
                  4
                </div>
                <div>
                  <p className="text-sm font-medium">Ready for Review</p>
                  <p className="text-xs text-gray-500">Document added to review queue</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
