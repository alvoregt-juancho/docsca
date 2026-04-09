import type { StoredPage, StoredParagraph, StoredTable, StoredImageRegion } from "./tempStorage.js";

const ENV_PROJECT_ID = process.env["GOOGLE_CLOUD_PROJECT_ID"] || "";
const ENV_LOCATION = process.env["GOOGLE_CLOUD_LOCATION"] || "us";
const ENV_PROCESSOR_ID = process.env["GOOGLE_DOCUMENT_AI_PROCESSOR_ID"] || "";
const ENV_CREDENTIALS_JSON = process.env["GOOGLE_APPLICATION_CREDENTIALS_JSON"] || "";
const ENV_API_KEY = process.env["GOOGLE_CLOUD_API_KEY"] || "";

export interface UserCredentials {
  gcpProjectId?: string;
  processorId?: string;
  /** Full JSON content of a Google Cloud service account key file */
  serviceAccountJson?: string;
  location?: string;
}

export function isConfigured(creds?: UserCredentials): boolean {
  if (creds?.gcpProjectId && creds?.processorId && creds?.serviceAccountJson) return true;
  return !!(ENV_PROJECT_ID && ENV_PROCESSOR_ID && (ENV_CREDENTIALS_JSON || ENV_API_KEY));
}

export interface OcrPageResult {
  text: string;
  paragraphs: StoredParagraph[];
  tables: StoredTable[];
  images: StoredImageRegion[];
  detectedPageNumber: number | null;
  wordCount: number;
  hasImages: boolean;
  hasTables: boolean;
}

export async function processPageWithOcr(
  imageBase64: string,
  mimeType = "image/jpeg",
  userCreds?: UserCredentials,
): Promise<OcrPageResult> {
  if (!isConfigured(userCreds)) {
    return generateMockOcrResult();
  }

  const projectId = userCreds?.gcpProjectId || ENV_PROJECT_ID;
  const processorId = userCreds?.processorId || ENV_PROCESSOR_ID;
  const location = userCreds?.location || ENV_LOCATION || "us";
  // Use service account JSON: prefer user-provided, fall back to env var
  const credJson = userCreds?.serviceAccountJson || ENV_CREDENTIALS_JSON;

  try {
    const { DocumentProcessorServiceClient } = await import("@google-cloud/documentai");

    const credentials = JSON.parse(credJson);
    const client = new DocumentProcessorServiceClient({ credentials });
    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const [result] = await client.processDocument({
      name: processorName,
      rawDocument: { content: Buffer.from(imageBase64, "base64"), mimeType },
    });

    const document = result.document;
    if (!document) throw new Error("No document returned");
    return parseDocumentAiResponse(document);
  } catch (err) {
    throw new Error(`Document AI failed: ${(err as Error).message}`);
  }
}


function parseDocumentAiResponse(document: unknown): OcrPageResult {
  const doc = document as Record<string, unknown>;
  const fullText: string = (doc["text"] as string) || "";
  const pages = (doc["pages"] as unknown[]) || [];

  const getText = (textAnchor: unknown): string => {
    const anchor = textAnchor as Record<string, unknown> | undefined;
    if (!anchor?.["textSegments"]) return "";
    return (anchor["textSegments"] as Array<Record<string, unknown>>)
      .map((seg) =>
        fullText.slice(Number(seg["startIndex"] || 0), Number(seg["endIndex"] || 0)),
      )
      .join("");
  };

  const getBbox = (boundingPoly: unknown) => {
    const poly = boundingPoly as Record<string, unknown> | undefined;
    const verts = (poly?.["normalizedVertices"] as Array<Record<string, unknown>>) || [];
    if (verts.length < 4) return { x: 0, y: 0, w: 1, h: 1 };
    const xs = verts.map((v) => Number(v["x"]) || 0);
    const ys = verts.map((v) => Number(v["y"]) || 0);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  };

  const paragraphs: StoredParagraph[] = [];
  const tables: StoredTable[] = [];
  const images: StoredImageRegion[] = [];
  let detectedPageNumber: number | null = null;

  for (const rawPage of pages) {
    const page = rawPage as Record<string, unknown>;
    const pageParas = (page["paragraphs"] as unknown[]) || [];
    const blockHeights = pageParas.map((p) => {
      const para = p as Record<string, unknown>;
      const layout = para["layout"] as Record<string, unknown> | undefined;
      return getBbox(layout?.["boundingPoly"]).h;
    });
    const medianH =
      blockHeights.length > 0
        ? [...blockHeights].sort((a, b) => a - b)[Math.floor(blockHeights.length / 2)]
        : 0.02;

    for (const rawPara of pageParas) {
      const para = rawPara as Record<string, unknown>;
      const layout = para["layout"] as Record<string, unknown> | undefined;
      const text = getText(layout?.["textAnchor"]).trim();
      if (!text) continue;
      const bbox = getBbox(layout?.["boundingPoly"]);

      const fontSizeEm = medianH > 0 ? Math.min(Math.max(bbox.h / medianH, 0.6), 3) : 1;
      const isHeading = fontSizeEm > 1.3;

      if ((bbox.y < 0.12 || bbox.y + bbox.h > 0.88) && /^\d+$/.test(text.trim())) {
        const n = parseInt(text.trim(), 10);
        if (n > 0 && n < 9999) detectedPageNumber = n;
        continue;
      }

      paragraphs.push({ text, fontSizeEm, isHeading, bbox });
    }

    for (const rawTbl of (page["tables"] as unknown[]) || []) {
      const tbl = rawTbl as Record<string, unknown>;
      const headers = ((tbl["headerRows"] as unknown[]) || []).map((row) =>
        ((row as Record<string, unknown>)["cells"] as unknown[] || []).map((cell) =>
          getText(((cell as Record<string, unknown>)["layout"] as Record<string, unknown>)?.["textAnchor"]).trim(),
        ),
      );
      const rows = ((tbl["bodyRows"] as unknown[]) || []).map((row) =>
        ((row as Record<string, unknown>)["cells"] as unknown[] || []).map((cell) =>
          getText(((cell as Record<string, unknown>)["layout"] as Record<string, unknown>)?.["textAnchor"]).trim(),
        ),
      );
      tables.push({ headers, rows });
    }

    for (const rawVe of (page["visualElements"] as unknown[]) || []) {
      const ve = rawVe as Record<string, unknown>;
      if ((ve["type"] as string || "").toUpperCase() === "IMAGE") {
        const layout = ve["layout"] as Record<string, unknown> | undefined;
        images.push({ bbox: getBbox(layout?.["boundingPoly"]) });
      }
    }
  }

  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  return {
    text: fullText,
    paragraphs,
    tables,
    images,
    detectedPageNumber,
    wordCount,
    hasImages: images.length > 0,
    hasTables: tables.length > 0,
  };
}

function generateMockOcrResult(): OcrPageResult {
  const mockText = `CAPÍTULO 3

La importancia de la documentación digital en el siglo XXI ha sido ampliamente discutida por expertos en archivística y gestión de información. El proceso de digitalización permite preservar documentos históricos de valor incalculable para las generaciones futuras.

Los principales beneficios de la digitalización incluyen la preservación a largo plazo de documentos frágiles, el acceso remoto para investigadores de todo el mundo, la facilidad de búsqueda y recuperación de información específica, y la reducción significativa del deterioro físico causado por el manejo continuo.

Las tecnologías actuales de reconocimiento óptico de caracteres han alcanzado niveles de precisión superiores al 99% en documentos bien preservados, lo que hace viable la conversión masiva de archivos históricos a formatos digitales editables.`;

  const pageNum = Math.floor(Math.random() * 200) + 10;

  return {
    text: mockText,
    paragraphs: [
      { text: "CAPÍTULO 3", fontSizeEm: 1.8, isHeading: true, bbox: { x: 0.1, y: 0.05, w: 0.8, h: 0.04 } },
      {
        text: "La importancia de la documentación digital en el siglo XXI ha sido ampliamente discutida por expertos en archivística y gestión de información. El proceso de digitalización permite preservar documentos históricos de valor incalculable para las generaciones futuras.",
        fontSizeEm: 1,
        isHeading: false,
        bbox: { x: 0.05, y: 0.12, w: 0.9, h: 0.15 },
      },
      {
        text: "Los principales beneficios de la digitalización incluyen la preservación a largo plazo de documentos frágiles, el acceso remoto para investigadores de todo el mundo, la facilidad de búsqueda y recuperación de información específica, y la reducción significativa del deterioro físico causado por el manejo continuo.",
        fontSizeEm: 1,
        isHeading: false,
        bbox: { x: 0.05, y: 0.3, w: 0.9, h: 0.15 },
      },
      {
        text: "Las tecnologías actuales de reconocimiento óptico de caracteres han alcanzado niveles de precisión superiores al 99% en documentos bien preservados, lo que hace viable la conversión masiva de archivos históricos a formatos digitales editables.",
        fontSizeEm: 1,
        isHeading: false,
        bbox: { x: 0.05, y: 0.48, w: 0.9, h: 0.12 },
      },
    ],
    tables: [
      {
        headers: [["Tecnología", "Precisión (%)", "Año de introducción"]],
        rows: [
          ["OCR básico", "85-90", "1990"],
          ["OCR avanzado", "95-97", "2005"],
          ["Document AI", "99+", "2020"],
        ],
      },
    ],
    images: [],
    detectedPageNumber: pageNum,
    wordCount: mockText.split(/\s+/).filter(Boolean).length,
    hasImages: false,
    hasTables: true,
  };
}
