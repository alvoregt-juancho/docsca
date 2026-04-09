export interface PageSummary {
  id: string;
  captureOrder: number;
  detectedPageNumber: number | null;
  wordCount: number;
  hasImages: boolean;
  hasTables: boolean;
  processedAt: number;
  isProcessing?: boolean;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  pages: PageSummary[];
  documentId?: string;
}
