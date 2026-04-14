import { GoogleGenAI } from "@google/genai";
import type { StoredParagraph, StoredTable, StoredImageRegion } from "./tempStorage.js";
import { logger } from "./logger.js";

const BASE_URL = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"] || "";
const API_KEY = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"] || "";

export function isGeminiConfigured(): boolean {
  return !!(BASE_URL && API_KEY);
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

const SYSTEM_PROMPT = `You are an OCR engine. Extract ALL text from this book/document page image.
Return a JSON object with exactly these fields:
{
  "pageNumber": <number or null if no page number visible>,
  "paragraphs": [
    { "text": "<paragraph text>", "isHeading": <true if heading/title> }
  ],
  "tables": [
    { "headers": [["col1","col2",...]], "rows": [["val1","val2",...], ...] }
  ],
  "hasImages": <true if the page contains photos/diagrams/figures>
}

Rules:
- Extract the REAL text from the image, character by character. Do NOT invent or summarize.
- Preserve paragraph breaks as separate entries.
- Detect headings by their larger font size or bold styling.
- Page numbers are usually at the top or bottom of the page, isolated.
- If there are tables, extract them with headers and rows.
- Return ONLY valid JSON, no markdown fences, no extra text.`;

export async function processPageWithGemini(
  imageBase64: string,
  mimeType = "image/jpeg",
): Promise<OcrPageResult> {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini AI not configured");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY, httpOptions: { apiVersion: "", baseUrl: BASE_URL } });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: SYSTEM_PROMPT },
          { inlineData: { data: imageBase64, mimeType } },
        ],
      },
    ],
    config: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  const raw = response.text ?? "";
  logger.info({ responseLength: raw.length }, "Gemini OCR response received");

  let parsed: {
    pageNumber?: number | null;
    paragraphs?: Array<{ text: string; isHeading?: boolean }>;
    tables?: Array<{ headers: string[][]; rows: string[][] }>;
    hasImages?: boolean;
  };

  try {
    const cleaned = raw.replace(/^```json\s*/, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    logger.warn({ raw: raw.slice(0, 500) }, "Failed to parse Gemini JSON, extracting text directly");
    parsed = {
      pageNumber: null,
      paragraphs: [{ text: raw, isHeading: false }],
      tables: [],
      hasImages: false,
    };
  }

  const paragraphs: StoredParagraph[] = (parsed.paragraphs || []).map((p, i) => ({
    text: p.text || "",
    fontSizeEm: p.isHeading ? 1.6 : 1,
    isHeading: !!p.isHeading,
    bbox: {
      x: 0.05,
      y: 0.05 + i * 0.12,
      w: 0.9,
      h: 0.1,
    },
  }));

  const tables: StoredTable[] = (parsed.tables || []).map((t) => ({
    headers: t.headers || [],
    rows: t.rows || [],
  }));

  const images: StoredImageRegion[] = parsed.hasImages
    ? [{ bbox: { x: 0.1, y: 0.3, w: 0.8, h: 0.4 } }]
    : [];

  const fullText = paragraphs.map((p) => p.text).join("\n\n");
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  return {
    text: fullText,
    paragraphs,
    tables,
    images,
    detectedPageNumber: parsed.pageNumber ?? null,
    wordCount,
    hasImages: !!parsed.hasImages || images.length > 0,
    hasTables: tables.length > 0,
  };
}
