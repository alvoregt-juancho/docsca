import { Router } from "express";
import { processPageWithOcr, isConfigured, type UserCredentials } from "../lib/documentAiClient.js";
import { storePage } from "../lib/tempStorage.js";
import { warpPerspective, type Corners } from "../lib/perspectiveWarp.js";

const router = Router();

const SAFE_ID_RE = /^[a-zA-Z0-9_\-]{1,128}$/;

function validateId(id: string, label: string): string {
  if (!SAFE_ID_RE.test(id)) {
    throw new Error(`Invalid ${label}: must be alphanumeric, hyphens, or underscores only`);
  }
  return id;
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/ocr
 *
 * Canonical OCR endpoint. Accepts a base64-encoded image, optional 4-corner
 * coordinates for perspective correction (true homography warp applied on the
 * server), and optional user-supplied Google Cloud credentials.
 *
 * Body:
 *   imageBase64   string   Required. Base64-encoded image data.
 *   projectId     string   Required. App-level project identifier (alphanumeric).
 *   captureOrder  number   Required. Sequential capture index (0-based).
 *   mimeType      string   Optional. Default "image/jpeg".
 *   corners       object   Optional. { tl, tr, bl, br } each { x, y } in image pixels.
 *                          When provided, a perspective warp is applied before OCR.
 *   credentials   object   Optional. { gcpProjectId, processorId, apiKey } for
 *                          user-supplied Google Cloud credentials.
 */
router.post("/", async (req, res) => {
  const {
    imageBase64,
    projectId,
    captureOrder,
    mimeType = "image/jpeg",
    corners,
    credentials,
  } = req.body as {
    imageBase64?: string;
    projectId?: string;
    captureOrder?: number;
    mimeType?: string;
    corners?: Corners;
    credentials?: UserCredentials;
  };

  if (!imageBase64 || !projectId || captureOrder === undefined) {
    res.status(400).json({ error: "imageBase64, projectId and captureOrder are required" });
    return;
  }

  const resolvedMime = ALLOWED_MIME.has(mimeType) ? mimeType : "image/jpeg";

  try {
    const safeProjectId = validateId(projectId, "projectId");
    const safeOrder = Math.max(0, Math.floor(Number(captureOrder)));

    let processedImageBase64 = imageBase64;

    // Apply perspective warp when 4 corners are provided
    if (corners?.tl && corners?.tr && corners?.bl && corners?.br) {
      const imgBuffer = Buffer.from(imageBase64, "base64");
      const warpedBuffer = await warpPerspective(imgBuffer, corners, 1200);
      processedImageBase64 = warpedBuffer.toString("base64");
    }

    const ocrResult = await processPageWithOcr(processedImageBase64, resolvedMime, credentials);

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

    await storePage(page, processedImageBase64);

    res.json({
      success: true,
      pageId,
      detectedPageNumber: ocrResult.detectedPageNumber,
      wordCount: ocrResult.wordCount,
      hasImages: ocrResult.hasImages,
      hasTables: ocrResult.hasTables,
      isMockData: !isConfigured(credentials),
    });
  } catch (err) {
    req.log.error({ err }, "OCR processing failed");
    const status = (err as Error).message.startsWith("Invalid") ? 400 : 500;
    res.status(status).json({ error: (err as Error).message });
  }
});

export default router;
