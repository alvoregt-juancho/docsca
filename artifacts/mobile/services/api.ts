import AsyncStorage from "@react-native-async-storage/async-storage";

const getBaseUrl = () => `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export const CREDS_STORAGE_KEY = "docscan_gcp_credentials_v1";

export interface GcpCredentials {
  gcpProjectId: string;
  processorId: string;
  /** Full JSON content of Google Cloud service account key file */
  serviceAccountJson: string;
}

export interface PageCorners {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  bl: { x: number; y: number };
  br: { x: number; y: number };
}

async function loadCredentials(): Promise<GcpCredentials | undefined> {
  try {
    const raw = await AsyncStorage.getItem(CREDS_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as GcpCredentials;
    if (parsed.gcpProjectId && parsed.processorId && parsed.serviceAccountJson) return parsed;
  } catch {}
  return undefined;
}

export async function saveCredentials(creds: GcpCredentials): Promise<void> {
  await AsyncStorage.setItem(CREDS_STORAGE_KEY, JSON.stringify(creds));
}

export async function clearCredentials(): Promise<void> {
  await AsyncStorage.removeItem(CREDS_STORAGE_KEY);
}

export const API = {
  /**
   * Send an image to POST /api/ocr for perspective warp + OCR.
   * Corners (in resized-image pixel coordinates) trigger server-side homography warp.
   * User-supplied GCP credentials are read from AsyncStorage.
   */
  processPage: async (
    imageBase64: string,
    projectId: string,
    captureOrder: number,
    corners?: PageCorners,
  ): Promise<{
    pageId: string;
    detectedPageNumber: number | null;
    wordCount: number;
    hasImages: boolean;
    hasTables: boolean;
    isMockData: boolean;
  }> => {
    const credentials = await loadCredentials();
    const body: Record<string, unknown> = {
      imageBase64,
      projectId,
      captureOrder,
    };
    if (corners) body["corners"] = corners;
    if (credentials) body["credentials"] = credentials;

    const res = await fetch(`${getBaseUrl()}/api/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  checkConfig: async (): Promise<{
    configured: boolean;
    projectId: string | null;
    processorId: string | null;
    location: string;
    note: string;
    userCredsActive: boolean;
  }> => {
    const res = await fetch(`${getBaseUrl()}/api/documents/config`);
    if (!res.ok) throw new Error("Cannot reach server");
    const serverConfig = await res.json();
    const userCreds = await loadCredentials();
    return {
      ...serverConfig,
      userCredsActive: !!userCreds,
    };
  },
};
