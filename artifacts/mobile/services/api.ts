const getBaseUrl = () => `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export const API = {
  processPage: async (
    imageBase64: string,
    projectId: string,
    captureOrder: number,
  ): Promise<{
    pageId: string;
    detectedPageNumber: number | null;
    wordCount: number;
    hasImages: boolean;
    hasTables: boolean;
    isMockData: boolean;
  }> => {
    const res = await fetch(`${getBaseUrl()}/api/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, projectId, captureOrder }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Error desconocido" }));
      throw new Error((err as { error?: string }).error || `Error ${res.status}`);
    }
    return res.json();
  },

  generateDocument: async (
    projectId: string,
    projectName: string,
  ): Promise<{
    success: boolean;
    documentId: string;
    pageCount: number;
  }> => {
    const res = await fetch(`${getBaseUrl()}/api/documents/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, projectName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Error desconocido" }));
      throw new Error((err as { error?: string }).error || `Error ${res.status}`);
    }
    return res.json();
  },

  getDownloadUrl: (documentId: string, format: "word" | "pdf" | "scan", projectName: string): string => {
    const base = getBaseUrl();
    const name = encodeURIComponent(projectName);
    return `${base}/api/documents/${documentId}/download/${format}?name=${name}`;
  },

  checkHealth: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/healthz`);
      return res.ok;
    } catch {
      return false;
    }
  },
};
