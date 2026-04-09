import type { StoredPage, StoredParagraph, StoredTable, StoredImageRegion } from "./tempStorage.js";

const PROJECT_ID = process.env["GOOGLE_CLOUD_PROJECT_ID"] || "";
const LOCATION = process.env["GOOGLE_CLOUD_LOCATION"] || "us";
const PROCESSOR_ID = process.env["GOOGLE_DOCUMENT_AI_PROCESSOR_ID"] || "";
const CREDENTIALS_JSON = process.env["GOOGLE_APPLICATION_CREDENTIALS_JSON"] || "";

export function isConfigured(): boolean {
  return !!(PROJECT_ID && PROCESSOR_ID && CREDENTIALS_JSON);
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
): Promise<OcrPageResult> {
  if (!isConfigured()) {
    return generateMockOcrResult();
  }

  try {
    const { DocumentProcessorServiceClient } = await import(
      "@google-cloud/documentai"
    );

    const credentials = JSON.parse(CREDENTIALS_JSON);
    const client = new DocumentProcessorServiceClient({ credentials });

    const processorName = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

    const [result] = await client.processDocument({
      name: processorName,
      rawDocument: {
        content: Buffer.from(imageBase64, "base64"),
        mimeType,
      },
    });

    const document = result.document;
    if (!document) throw new Error("No document returned");

    return parseDocumentAiResponse(document);
  } catch (err) {
    throw new Error(`Document AI failed: ${(err as Error).message}`);
  }
}

function parseDocumentAiResponse(document: any): OcrPageResult {
  const fullText: string = document.text || "";
  const pages = document.pages || [];

  const getText = (textAnchor: any): string => {
    if (!textAnchor?.textSegments) return "";
    return textAnchor.textSegments
      .map((seg: any) =>
        fullText.slice(Number(seg.startIndex || 0), Number(seg.endIndex || 0)),
      )
      .join("");
  };

  const getBbox = (boundingPoly: any) => {
    const verts = boundingPoly?.normalizedVertices || [];
    if (verts.length < 4) return { x: 0, y: 0, w: 1, h: 1 };
    const xs = verts.map((v: any) => Number(v.x) || 0);
    const ys = verts.map((v: any) => Number(v.y) || 0);
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

  for (const page of pages) {
    const pageParas = page.paragraphs || [];
    const blockHeights = pageParas.map((p: any) => {
      const bbox = getBbox(p.layout?.boundingPoly);
      return bbox.h;
    });
    const medianH =
      blockHeights.length > 0
        ? blockHeights.sort((a: number, b: number) => a - b)[
            Math.floor(blockHeights.length / 2)
          ]
        : 0.02;

    for (const para of pageParas) {
      const text = getText(para.layout?.textAnchor).trim();
      if (!text) continue;
      const bbox = getBbox(para.layout?.boundingPoly);

      const fontSizeEm =
        medianH > 0 ? Math.min(Math.max(bbox.h / medianH, 0.6), 3) : 1;
      const isHeading = fontSizeEm > 1.3;

      if (
        (bbox.y < 0.12 || bbox.y + bbox.h > 0.88) &&
        /^\d+$/.test(text.trim())
      ) {
        const n = parseInt(text.trim(), 10);
        if (n > 0 && n < 9999) detectedPageNumber = n;
        continue;
      }

      paragraphs.push({ text, fontSizeEm, isHeading, bbox });
    }

    for (const tbl of page.tables || []) {
      const headers = (tbl.headerRows || []).map((row: any) =>
        (row.cells || []).map((cell: any) =>
          getText(cell.layout?.textAnchor).trim(),
        ),
      );
      const rows = (tbl.bodyRows || []).map((row: any) =>
        (row.cells || []).map((cell: any) =>
          getText(cell.layout?.textAnchor).trim(),
        ),
      );
      tables.push({ headers, rows });
    }

    for (const ve of page.visualElements || []) {
      if ((ve.type || "").toUpperCase() === "IMAGE") {
        images.push({ bbox: getBbox(ve.layout?.boundingPoly) });
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
      {
        text: "CAPÍTULO 3",
        fontSizeEm: 1.8,
        isHeading: true,
        bbox: { x: 0.1, y: 0.05, w: 0.8, h: 0.04 },
      },
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
