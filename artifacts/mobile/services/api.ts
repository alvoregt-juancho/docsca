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
    const res = await fetch(`${getBaseUrl()}/api/pages/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, projectId, captureOrder }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Error desconocido" }));
      throw new Error(err.error || `Error ${res.status}`);
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
      throw new Error(err.error || `Error ${res.status}`);
    }
    return res.json();
  },

  getDownloadUrl: (
    documentId: string,
    format: "word" | "pdf",
    projectName: string,
  ): string => {
    const base = getBaseUrl();
    const name = encodeURIComponent(projectName);
    return `${base}/api/documents/${documentId}/download/${format}?name=${name}`;
  },

  checkConfig: async (): Promise<{
    configured: boolean;
    projectId: string | null;
    processorId: string | null;
    location: string;
    note: string;
  }> => {
    const res = await fetch(`${getBaseUrl()}/api/documents/config`);
    if (!res.ok) throw new Error("Cannot reach server");
    return res.json();
  },
};
