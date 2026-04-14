const getBaseUrl = () => `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options);
      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  if (lastError?.name === "AbortError") {
    throw new Error("Tiempo de espera agotado. Verifica tu conexión a internet y que el servidor esté activo.");
  }
  throw new Error(
    `No se pudo conectar al servidor después de ${retries + 1} intentos. Verifica tu conexión.`,
  );
}

async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.error) return json.error;
    } catch {}
    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      if (res.status === 502 || res.status === 503) {
        return "Servidor no disponible. Asegúrate de que el workspace de Replit esté activo.";
      }
      return `Error del servidor (${res.status}). El workspace puede estar inactivo.`;
    }
    return text.substring(0, 200) || `Error HTTP ${res.status}`;
  } catch {
    return `Error HTTP ${res.status}`;
  }
}

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
    const res = await fetchWithRetry(`${getBaseUrl()}/api/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, projectId, captureOrder }),
    });
    if (!res.ok) {
      const msg = await parseErrorResponse(res);
      throw new Error(msg);
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
    const res = await fetchWithRetry(`${getBaseUrl()}/api/documents/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, projectName }),
    });
    if (!res.ok) {
      const msg = await parseErrorResponse(res);
      throw new Error(msg);
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
      const res = await fetchWithTimeout(`${getBaseUrl()}/api/healthz`, { method: "GET" }, 10_000);
      return res.ok;
    } catch {
      return false;
    }
  },
};
