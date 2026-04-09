import { Router } from "express";
import { processPageWithOcr, isConfigured } from "../lib/documentAiClient.js";
import { storePage } from "../lib/tempStorage.js";

const router = Router();

router.post("/process", async (req, res) => {
  const { imageBase64, projectId, captureOrder, mimeType = "image/jpeg" } = req.body as {
    imageBase64?: string;
    projectId?: string;
    captureOrder?: number;
    mimeType?: string;
  };

  if (!imageBase64 || !projectId || captureOrder === undefined) {
    res.status(400).json({ error: "imageBase64, projectId and captureOrder are required" });
    return;
  }

  try {
    const ocrResult = await processPageWithOcr(imageBase64, mimeType);

    const pageId = `${projectId}-${captureOrder}`;
    const page = {
      pageId,
      projectId,
      captureOrder,
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

    await storePage(page, imageBase64);

    res.json({
      success: true,
      pageId,
      detectedPageNumber: ocrResult.detectedPageNumber,
      wordCount: ocrResult.wordCount,
      hasImages: ocrResult.hasImages,
      hasTables: ocrResult.hasTables,
      isMockData: !isConfigured(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to process page");
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
