import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Navbar */}
      <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">D</span>
                  </div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    DocAI
                  </h1>
                </div>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <Link
                  href="/upload"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  Upload
                </Link>
                <Link
                  href="/review"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                >
                  Review Queue
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-8 sm:px-0">
          <div className="text-center mb-10">
            <div className="inline-block mb-3 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              AI-Powered Medical Document Processing
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Automate Your<br/>
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Document Workflow
              </span>
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              Extract medical data from documents with 90%+ accuracy using OCR and AI extraction
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
            <div className="bg-white p-5 rounded-2xl shadow-lg card-hover border border-gray-100">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-base font-bold mb-2 text-gray-900">Upload Documents</h3>
              <p className="text-sm text-gray-600 mb-4">
                Drag & drop PDF or DOCX files for instant processing with Azure OCR
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center justify-center w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 text-sm rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
              >
                Upload Now →
              </Link>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-lg card-hover border border-gray-100">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-bold mb-2 text-gray-900">Review & Approve</h3>
              <p className="text-sm text-gray-600 mb-4">
                AI extracts 7 fields with confidence scoring, review and approve for import
              </p>
              <Link
                href="/review"
                className="inline-flex items-center justify-center w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 text-sm rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg"
              >
                View Queue →
              </Link>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-lg card-hover border border-gray-100">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-base font-bold mb-2 text-gray-900">AI Extraction</h3>
              <p className="text-sm text-gray-600 mb-4">
                Patient, Date, Subject, Source, Doctor, Category, Store In
              </p>
              <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-1.5">
                  <span>Accuracy</span>
                  <span className="font-semibold text-purple-600">90%+</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Processing</span>
                  <span className="font-semibold text-purple-600">&lt;30s</span>
                </div>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="mt-10 bg-white p-5 rounded-2xl shadow-lg border border-gray-100">
            <h3 className="text-base font-bold mb-4 text-gray-900">System Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                <div className="text-xl font-bold text-blue-600 mb-0.5">✓</div>
                <div className="text-xs text-gray-600 mb-0.5">OCR Engine</div>
                <div className="text-xs font-medium text-blue-600">Azure Ready</div>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                <div className="text-xl font-bold text-green-600 mb-0.5">✓</div>
                <div className="text-xs text-gray-600 mb-0.5">AI Extraction</div>
                <div className="text-xs font-medium text-green-600">Gemini Ready</div>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                <div className="text-xl font-bold text-purple-600 mb-0.5">✓</div>
                <div className="text-xs text-gray-600 mb-0.5">Database</div>
                <div className="text-xs font-medium text-purple-600">Supabase Ready</div>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl">
                <div className="text-xl font-bold text-orange-600 mb-0.5">✓</div>
                <div className="text-xs text-gray-600 mb-0.5">Backend API</div>
                <div className="text-xs font-medium text-orange-600">NestJS Ready</div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-5 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600 mb-1">90%+</div>
              <div className="text-xs text-gray-600">AI Accuracy</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600 mb-1">&lt;30s</div>
              <div className="text-xs text-gray-600">Processing Time</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600 mb-1">7</div>
              <div className="text-xs text-gray-600">Fields Extracted</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-10 py-6 border-t border-gray-200 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-500">
          <p>Medical Document AI · Powered by Azure OCR + Gemini AI + Next.js</p>
        </div>
      </footer>
    </div>
  );
}
