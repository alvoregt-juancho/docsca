import { Router } from "express";
import { existsSync } from "fs";
import { generateWordDocument } from "../lib/wordGenerator.js";
import { generatePdfDocument } from "../lib/pdfGenerator.js";
import {
  loadAllPages,
  ensureOutputDir,
  wordPath,
  pdfPath,
} from "../lib/tempStorage.js";
import { isConfigured } from "../lib/documentAiClient.js";
import { writeFile } from "fs/promises";

const router = Router();

router.get("/config", (_req, res) => {
  res.json({
    configured: isConfigured(),
    projectId: process.env["GOOGLE_CLOUD_PROJECT_ID"] || null,
    processorId: process.env["GOOGLE_DOCUMENT_AI_PROCESSOR_ID"] || null,
    location: process.env["GOOGLE_CLOUD_LOCATION"] || "us",
    note: isConfigured()
      ? "Google Document AI is configured"
      : "Using mock OCR data. Set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_DOCUMENT_AI_PROCESSOR_ID, GOOGLE_APPLICATION_CREDENTIALS_JSON env vars to enable real OCR.",
  });
});

router.post("/generate", async (req, res) => {
  const { projectId, projectName } = req.body as {
    projectId?: string;
    projectName?: string;
  };

  if (!projectId || !projectName) {
    res.status(400).json({ error: "projectId and projectName are required" });
    return;
  }

  try {
    const pages = await loadAllPages(projectId);
    if (pages.length === 0) {
      res.status(400).json({ error: "No pages found for this project" });
      return;
    }

    const docId = `${projectId}-${Date.now()}`;
    const outDir = await ensureOutputDir(projectId);

    const wPath = wordPath(projectId, docId);
    const pPath = pdfPath(projectId, docId);

    req.log.info({ projectId, pageCount: pages.length }, "Generating documents");

    const wordBuffer = await generateWordDocument(pages, projectName);
    await writeFile(wPath, wordBuffer);

    await generatePdfDocument(pages, projectName, pPath);

    res.json({
      success: true,
      documentId: docId,
      pageCount: pages.length,
      wordPath: wPath,
      pdfPath: pPath,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate document");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/:documentId/download/word", async (req, res) => {
  const { documentId } = req.params;
  const projectId = documentId.split("-").slice(0, -1).join("-");
  const wPath = wordPath(projectId, documentId);

  if (!existsSync(wPath)) {
    res.status(404).json({ error: "Word document not found" });
    return;
  }

  const safeProjectName = (req.query["name"] as string) || "documento";
  const filename = `${safeProjectName.replace(/[^a-zA-Z0-9\-_\s]/g, "").trim() || "documento"}.docx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.sendFile(wPath);
});

router.get("/:documentId/download/pdf", async (req, res) => {
  const { documentId } = req.params;
  const projectId = documentId.split("-").slice(0, -1).join("-");
  const pPath = pdfPath(projectId, documentId);

  if (!existsSync(pPath)) {
    res.status(404).json({ error: "PDF document not found" });
    return;
  }

  const safeProjectName = (req.query["name"] as string) || "documento";
  const filename = `${safeProjectName.replace(/[^a-zA-Z0-9\-_\s]/g, "").trim() || "documento"}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.sendFile(pPath);
});

export default router;
