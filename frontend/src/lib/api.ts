import {
  Document,
  ApiResponse,
  ProcessingResult,
  UpdateExtractedDataPayload,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Upload and process document
  async processDocument(file: File): Promise<ApiResponse<ProcessingResult>> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/documents/process`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Upload failed');
    }

    return data;
  }

  // Get document by ID
  async getDocument(id: string): Promise<ApiResponse<Document>> {
    return this.fetch<Document>(`/documents/${id}`);
  }

  // Get review queue
  async getReviewQueue(): Promise<ApiResponse<Document[]>> {
    return this.fetch<Document[]>('/documents/queue/review');
  }

  async getPatientLookup(query: string): Promise<ApiResponse<string[]>> {
    const params = new URLSearchParams({ q: query });
    return this.fetch<string[]>(`/documents/lookups/patients?${params.toString()}`);
  }

  async getDoctorLookup(query: string): Promise<ApiResponse<string[]>> {
    const params = new URLSearchParams({ q: query });
    return this.fetch<string[]>(`/documents/lookups/doctors?${params.toString()}`);
  }

  async getSourceContactLookup(query: string): Promise<ApiResponse<string[]>> {
    const params = new URLSearchParams({ q: query });
    return this.fetch<string[]>(`/documents/lookups/sources?${params.toString()}`);
  }

  // Update extracted data
  async updateExtractedData(
    documentId: string,
    updates: UpdateExtractedDataPayload
  ): Promise<ApiResponse<void>> {
    return this.fetch<void>(`/documents/${documentId}/update`, {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  }

  // Approve document
  async approveDocument(documentId: string): Promise<ApiResponse<void>> {
    return this.fetch<void>(`/documents/${documentId}/approve`, {
      method: 'POST',
    });
  }

  // Reject document
  async rejectDocument(
    documentId: string,
    reason?: string
  ): Promise<ApiResponse<void>> {
    return this.fetch<void>(`/documents/${documentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }
}

export const api = new ApiClient();
