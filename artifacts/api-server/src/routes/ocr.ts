import { Router } from "express";
import { processPageWithGemini, isGeminiConfigured } from "../lib/geminiOcr.js";
import { storePage } from "../lib/tempStorage.js";
import { enhanceForScan } from "../lib/scanEnhance.js";

const router = Router();

const SAFE_ID_RE = /^[a-zA-Z0-9_\-]{1,128}$/;

function validateId(id: string, label: string): string {
  if (!SAFE_ID_RE.test(id)) {
    throw new Error(`Invalid ${label}: must be alphanumeric, hyphens, or underscores only`);
  }
  return id;
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

router.post("/", async (req, res) => {
  const {
    imageBase64,
    projectId,
    captureOrder,
    mimeType = "image/jpeg",
  } = req.body as {
    imageBase64?: string;
    projectId?: string;
    captureOrder?: number;
    mimeType?: string;
  };

  if (!imageBase64 || !projectId || captureOrder === undefined) {
    res.status(400).json({ error: "imageBase64, projectId and captureOrder are required" });
    return;
  }

  if (!isGeminiConfigured()) {
    res.status(500).json({ error: "Gemini AI is not configured on the server" });
    return;
  }

  const resolvedMime = ALLOWED_MIME.has(mimeType) ? mimeType : "image/jpeg";

  try {
    const safeProjectId = validateId(projectId, "projectId");
    const safeOrder = Math.max(0, Math.floor(Number(captureOrder)));

    const ocrResult = await processPageWithGemini(imageBase64, resolvedMime);

    const enhancedBuffer = await enhanceForScan(Buffer.from(imageBase64, "base64"));
    const enhancedBase64 = enhancedBuffer.toString("base64");

    const pageId = `${safeProjectId}-${safeOrder}`;
    const page = {
      pageId,
      projectId: safeProjectId,
      captureOrder: safeOrder,
      detectedPageNumber: ocrResult.detectedPageNumber,
      text: ocrResult.text,
      paragraphs: ocrResult.paragraphs,
      tables: ocrResult.tables,
      images: ocrResult.images,
      wordCount: ocrResult.wordCount,
      hasImages: ocrResult.hasImages,
      hasTables: ocrResult.hasTables,
      originalImagePath: "",
    };

    await storePage(page, enhancedBase64);

    res.json({
      success: true,
      pageId,
      detectedPageNumber: ocrResult.detectedPageNumber,
      wordCount: ocrResult.wordCount,
      hasImages: ocrResult.hasImages,
      hasTables: ocrResult.hasTables,
      isMockData: false,
    });
  } catch (err) {
    req.log.error({ err }, "OCR processing failed");
    const status = (err as Error).message.startsWith("Invalid") ? 400 : 500;
    res.status(status).json({ error: (err as Error).message });
  }
});

export default router;
