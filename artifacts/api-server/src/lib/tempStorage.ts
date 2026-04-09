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

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

function pageDir(projectId: string) {
  return join(TMP_BASE, projectId, "pages");
}

function imageDir(projectId: string) {
  return join(TMP_BASE, projectId, "images");
}

export function outputDir(projectId: string) {
  return join(TMP_BASE, projectId, "output");
}

export async function storePage(page: StoredPage, imageBase64: string): Promise<void> {
  const pDir = pageDir(page.projectId);
  const iDir = imageDir(page.projectId);
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
  return join(outputDir(projectId), `${docId}.docx`);
}

export function pdfPath(projectId: string, docId: string): string {
  return join(outputDir(projectId), `${docId}.pdf`);
}

export function sortPagesWithInterpolation(pages: StoredPage[]): {
  page: StoredPage;
  footerPageNumber: string;
}[] {
  const result: { page: StoredPage; footerPageNumber: string }[] = [];

  const numberedPages = pages.filter((p) => p.detectedPageNumber !== null);

  const sorted = [...pages].sort((a, b) => {
    if (a.detectedPageNumber !== null && b.detectedPageNumber !== null) {
      return a.detectedPageNumber - b.detectedPageNumber;
    }
    if (a.detectedPageNumber !== null) {
      const bNeighbor = findNearestNumbered(b, pages);
      if (bNeighbor !== null) return a.detectedPageNumber - bNeighbor;
    }
    if (b.detectedPageNumber !== null) {
      const aNeighbor = findNearestNumbered(a, pages);
      if (aNeighbor !== null) return aNeighbor - b.detectedPageNumber;
    }
    return a.captureOrder - b.captureOrder;
  });

  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i];
    let footerPageNumber: string;

    if (page.detectedPageNumber !== null) {
      footerPageNumber = page.detectedPageNumber.toString();
    } else {
      let prevNum: number | null = null;
      let nextNum: number | null = null;
      for (let j = i - 1; j >= 0; j--) {
        if (sorted[j].detectedPageNumber !== null) {
          prevNum = sorted[j].detectedPageNumber;
          break;
        }
      }
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].detectedPageNumber !== null) {
          nextNum = sorted[j].detectedPageNumber;
          break;
        }
      }
      if (prevNum !== null) {
        footerPageNumber = prevNum.toString();
      } else if (nextNum !== null) {
        footerPageNumber = nextNum.toString();
      } else {
        footerPageNumber = "";
      }
    }

    result.push({ page, footerPageNumber });
  }

  return result;
}

function findNearestNumbered(
  page: StoredPage,
  allPages: StoredPage[],
): number | null {
  const neighbors = allPages
    .filter(
      (p) =>
        p.detectedPageNumber !== null &&
        Math.abs(p.captureOrder - page.captureOrder) <= 3,
    )
    .sort(
      (a, b) =>
        Math.abs(a.captureOrder - page.captureOrder) -
        Math.abs(b.captureOrder - page.captureOrder),
    );
  return neighbors.length > 0 ? neighbors[0].detectedPageNumber : null;
}
