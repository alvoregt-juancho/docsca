import { createWriteStream } from "fs";
import { existsSync } from "fs";
import type { StoredPage } from "./tempStorage.js";
import { sortPagesWithInterpolation } from "./tempStorage.js";

// US Letter: 8.5 × 11 inches at 72 dpi = 612 × 792 points
const LETTER_W = 612;
const LETTER_H = 792;
const FOOTER_H = 30;

/**
 * Generates a scan-only PDF: each page is the perspective-corrected JPEG
 * fitted to US Letter (8.5 × 11 in) with a centered page-number footer.
 * Pages are sorted using the same interpolation logic as the OCR exports.
 */
export async function generateScanPdf(
  pages: StoredPage[],
  outputPath: string,
): Promise<void> {
  const PDFDocument = (await import("pdfkit")).default;
  const sortedPages = sortPagesWithInterpolation(pages);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
    const ws = createWriteStream(outputPath);
    doc.pipe(ws);
    ws.on("error", reject);
    ws.on("finish", resolve);

    for (const { page, footerPageNumber } of sortedPages) {
      doc.addPage({ size: "LETTER", margin: 0 });

      const imageAreaH = LETTER_H - FOOTER_H;
      const imgPath = page.originalImagePath;

      if (existsSync(imgPath)) {
        try {
          doc.image(imgPath, 0, 0, {
            fit: [LETTER_W, imageAreaH],
            align: "center",
            valign: "center",
          });
        } catch {
          // blank page if image is unreadable
        }
      }

      if (footerPageNumber) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#888888")
          .text(footerPageNumber, 0, LETTER_H - FOOTER_H + 8, {
            width: LETTER_W,
            align: "center",
          });
      }
    }

    doc.end();
  });
}
