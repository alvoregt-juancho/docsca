import { Router } from "express";
import { existsSync } from "fs";
import { generateWordDocument } from "../lib/wordGenerator.js";
import { generatePdfDocument } from "../lib/pdfGenerator.js";
import { generateScanPdf } from "../lib/scanPdfGenerator.js";
import {
  loadAllPages,
  ensureOutputDir,
  wordPath,
  pdfPath,
  scanPdfPath,
} from "../lib/tempStorage.js";
import { isConfigured } from "../lib/documentAiClient.js";
import { writeFile } from "fs/promises";

const router = Router();

const SAFE_ID_RE = /^[a-zA-Z0-9_\-]{1,256}$/;

function validateId(id: string | undefined, label: string): string {
  if (!id || !SAFE_ID_RE.test(id)) {
    throw new Error(`Invalid ${label}: must be alphanumeric, hyphens, or underscores only`);
  }
  return id;
}

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
    const safeProjectId = validateId(projectId, "projectId");

    const pages = await loadAllPages(safeProjectId);
    if (pages.length === 0) {
      res.status(400).json({ error: "No pages found for this project" });
      return;
    }

    const timestamp = Date.now();
    const docId = `${safeProjectId}-${timestamp}`;
    await ensureOutputDir(safeProjectId);

    const wPath = wordPath(safeProjectId, docId);
    const pPath = pdfPath(safeProjectId, docId);
    const sPath = scanPdfPath(safeProjectId, docId);

    req.log.info({ projectId: safeProjectId, pageCount: pages.length }, "Generating documents");

    const wordBuffer = await generateWordDocument(pages, projectName);
    await writeFile(wPath, wordBuffer);

    await generatePdfDocument(pages, projectName, pPath);
    await generateScanPdf(pages, sPath);

    res.json({
      success: true,
      documentId: docId,
      pageCount: pages.length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate document");
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/:documentId/download/word", async (req, res) => {
  try {
    const documentId = validateId(req.params["documentId"], "documentId");
    const parts = documentId.split("-");
    const projectId = parts.slice(0, -1).join("-");
    validateId(projectId, "projectId (from documentId)");
    const wPath = wordPath(projectId, documentId);

    if (!existsSync(wPath)) {
      res.status(404).json({ error: "Word document not found" });
      return;
    }

    const raw = (req.query["name"] as string) || "documento";
    const filename = `${raw.replace(/[^a-zA-Z0-9\-_\s]/g, "").trim() || "documento"}.docx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.sendFile(wPath);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/:documentId/download/pdf", async (req, res) => {
  try {
    const documentId = validateId(req.params["documentId"], "documentId");
    const parts = documentId.split("-");
    const projectId = parts.slice(0, -1).join("-");
    validateId(projectId, "projectId (from documentId)");
    const pPath = pdfPath(projectId, documentId);

    if (!existsSync(pPath)) {
      res.status(404).json({ error: "PDF document not found" });
      return;
    }

    const raw = (req.query["name"] as string) || "documento";
    const filename = `${raw.replace(/[^a-zA-Z0-9\-_\s]/g, "").trim() || "documento"}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.sendFile(pPath);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/:documentId/download/scan", async (req, res) => {
  try {
    const documentId = validateId(req.params["documentId"], "documentId");
    const parts = documentId.split("-");
    const projectId = parts.slice(0, -1).join("-");
    validateId(projectId, "projectId (from documentId)");
    const sPath = scanPdfPath(projectId, documentId);

    if (!existsSync(sPath)) {
      res.status(404).json({ error: "Scan PDF not found" });
      return;
    }

    const raw = (req.query["name"] as string) || "escaneo";
    const filename = `${raw.replace(/[^a-zA-Z0-9\-_\s]/g, "").trim() || "escaneo"}_scan.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.sendFile(sPath);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
