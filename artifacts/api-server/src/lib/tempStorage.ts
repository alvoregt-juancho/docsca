import { mkdir, readFile, writeFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const TMP_BASE = "/tmp/docscanner";

export interface StoredPage {
  pageId: string;
  projectId: string;
  captureOrder: number;
  detectedPageNumber: number | null;
  text: string;
  paragraphs: StoredParagraph[];
  tables: StoredTable[];
  images: StoredImageRegion[];
  wordCount: number;
  hasImages: boolean;
  hasTables: boolean;
  originalImagePath: string;
}

export interface StoredParagraph {
  text: string;
  fontSizeEm: number;
  isHeading: boolean;
  bbox: BBox;
}

export interface StoredTable {
  headers: string[][];
  rows: string[][];
}

export interface StoredImageRegion {
  bbox: BBox;
}

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SAFE_ID_RE = /^[a-zA-Z0-9_\-]{1,128}$/;

function sanitizeId(id: string): string {
  if (!SAFE_ID_RE.test(id)) {
    throw new Error(`Invalid project ID: "${id}" — must be alphanumeric, hyphens, or underscores only`);
  }
  return id;
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

function pageDir(projectId: string) {
  return join(TMP_BASE, sanitizeId(projectId), "pages");
}

function imageDir(projectId: string) {
  return join(TMP_BASE, sanitizeId(projectId), "images");
}

export function outputDir(projectId: string) {
  return join(TMP_BASE, sanitizeId(projectId), "output");
}

export async function storePage(page: StoredPage, imageBase64: string): Promise<void> {
  const safeProjectId = sanitizeId(page.projectId);
  const pDir = pageDir(safeProjectId);
  const iDir = imageDir(safeProjectId);
  await ensureDir(pDir);
  await ensureDir(iDir);

  const imagePath = join(iDir, `page_${page.captureOrder}.jpg`);
  await writeFile(imagePath, Buffer.from(imageBase64, "base64"));

  const pageData: StoredPage = { ...page, originalImagePath: imagePath };
  await writeFile(
    join(pDir, `page_${page.captureOrder}.json`),
    JSON.stringify(pageData, null, 2),
  );
}

export async function loadAllPages(projectId: string): Promise<StoredPage[]> {
  const pDir = pageDir(projectId);
  if (!existsSync(pDir)) return [];

  const files = await readdir(pDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

  const pages: StoredPage[] = [];
  for (const f of jsonFiles) {
    try {
      const data = await readFile(join(pDir, f), "utf-8");
      pages.push(JSON.parse(data) as StoredPage);
    } catch {
      // skip corrupt files
    }
  }

  return pages.sort((a, b) => a.captureOrder - b.captureOrder);
}

export async function ensureOutputDir(projectId: string): Promise<string> {
  const dir = outputDir(projectId);
  await ensureDir(dir);
  return dir;
}

export function wordPath(projectId: string, docId: string): string {
  return join(outputDir(projectId), `${sanitizeId(docId)}.docx`);
}

export function pdfPath(projectId: string, docId: string): string {
  return join(outputDir(projectId), `${sanitizeId(docId)}.pdf`);
}

export function scanPdfPath(projectId: string, docId: string): string {
  return join(outputDir(projectId), `${sanitizeId(docId)}_scan.pdf`);
}

/**
 * Sort pages using detected page numbers as anchors, then interpolate
 * integer page numbers for unnumbered pages based on their capture-order
 * position relative to surrounding numbered anchors.
 *
 * Example: pages captured in order [unnumbered, pg24, unnumbered, unnumbered, pg28]
 *   - First unnumbered  → before pg24  → footer "23"
 *   - Between pg24/28 with 2 unnumbered → gap=4, positions 1/3 and 2/3 → footers "25", "26"
 */
export function sortPagesWithInterpolation(pages: StoredPage[]): {
  page: StoredPage;
  footerPageNumber: string;
}[] {
  if (pages.length === 0) return [];

  // Step 1: assign a float sortKey to each page
  const sortKeys = computeSortKeys(pages);

  // Step 2: sort by sortKey
  const sorted = [...pages].sort(
    (a, b) => (sortKeys.get(a.pageId) ?? 0) - (sortKeys.get(b.pageId) ?? 0),
  );

  // Step 3: assign footer page numbers using interpolated integers
  return sorted.map((page) => {
    if (page.detectedPageNumber !== null) {
      return { page, footerPageNumber: page.detectedPageNumber.toString() };
    }
    const key = sortKeys.get(page.pageId);
    if (key === undefined) return { page, footerPageNumber: "" };
    return { page, footerPageNumber: Math.round(key).toString() };
  });
}

function computeSortKeys(pages: StoredPage[]): Map<string, number> {
  const keys = new Map<string, number>();

  // Numbered pages are anchors — their sort key equals their detected number
  for (const p of pages) {
    if (p.detectedPageNumber !== null) {
      keys.set(p.pageId, p.detectedPageNumber);
    }
  }

  // Sort numbered anchors by capture order so we can interpolate between them
  const anchors = pages
    .filter((p) => p.detectedPageNumber !== null)
    .sort((a, b) => a.captureOrder - b.captureOrder);

  // Group unnumbered pages by their position relative to numbered anchors
  const unnumbered = pages
    .filter((p) => p.detectedPageNumber === null)
    .sort((a, b) => a.captureOrder - b.captureOrder);

  for (const u of unnumbered) {
    const prevAnchor = [...anchors]
      .reverse()
      .find((a) => a.captureOrder < u.captureOrder);
    const nextAnchor = anchors.find((a) => a.captureOrder > u.captureOrder);

    if (prevAnchor !== undefined && nextAnchor !== undefined) {
      // Between two anchors: calculate how many unnumbered pages are in this gap
      const siblings = unnumbered.filter(
        (p) =>
          p.captureOrder > prevAnchor.captureOrder &&
          p.captureOrder < nextAnchor.captureOrder,
      );
      const idx = siblings.findIndex((p) => p.pageId === u.pageId);
      const totalSlots = siblings.length + 1;
      const prevNum = prevAnchor.detectedPageNumber!;
      const nextNum = nextAnchor.detectedPageNumber!;
      // Interpolate evenly between prevNum and nextNum
      keys.set(u.pageId, prevNum + (nextNum - prevNum) * ((idx + 1) / totalSlots));
    } else if (prevAnchor !== undefined) {
      // After all numbered pages: extrapolate forward
      const siblings = unnumbered.filter(
        (p) => p.captureOrder > prevAnchor.captureOrder,
      );
      const idx = siblings.findIndex((p) => p.pageId === u.pageId);
      keys.set(u.pageId, prevAnchor.detectedPageNumber! + idx + 1);
    } else if (nextAnchor !== undefined) {
      // Before all numbered pages: extrapolate backward
      const siblings = unnumbered.filter(
        (p) => p.captureOrder < nextAnchor.captureOrder,
      );
      const idx = siblings.findIndex((p) => p.pageId === u.pageId);
      keys.set(u.pageId, nextAnchor.detectedPageNumber! - (siblings.length - idx));
    } else {
      // No numbered pages at all: use capture order as sort key
      keys.set(u.pageId, u.captureOrder);
    }
  }

  return keys;
}
