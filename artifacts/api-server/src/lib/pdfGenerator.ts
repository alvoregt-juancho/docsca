import { createWriteStream } from "fs";
import { cropImageRegion } from "./imageProcessor.js";
import type { StoredPage } from "./tempStorage.js";
import { sortPagesWithInterpolation } from "./tempStorage.js";

interface PageData {
  page: StoredPage;
  footerPageNumber: string;
  imageBuffers: (Buffer | null)[];
}

async function preparePageData(
  sortedPages: ReturnType<typeof sortPagesWithInterpolation>,
): Promise<PageData[]> {
  return Promise.all(
    sortedPages.map(async ({ page, footerPageNumber }) => {
      const imageBuffers = await Promise.all(
        page.images.map(async (imgRegion) => {
          try {
            return await cropImageRegion(page.originalImagePath, imgRegion.bbox);
          } catch {
            return null;
          }
        }),
      );
      return { page, footerPageNumber, imageBuffers };
    }),
  );
}

export async function generatePdfDocument(
  pages: StoredPage[],
  projectName: string,
  outputPath: string,
): Promise<void> {
  const PDFDocument = (await import("pdfkit")).default;
  const sortedPages = sortPagesWithInterpolation(pages);
  const preparedPages = await preparePageData(sortedPages);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const writeStream = createWriteStream(outputPath);

    doc.pipe(writeStream);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);

    for (const { page, footerPageNumber, imageBuffers } of preparedPages) {
      doc.addPage({ margin: 72 });

      const margin = 72;
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const contentWidth = pageWidth - margin * 2;

      let y = margin;

      for (const para of page.paragraphs) {
        if (y > pageHeight - 100) {
          doc.addPage({ margin: 72 });
          y = margin;
        }

        const fontSize = Math.round(12 * para.fontSizeEm);
        const clampedSize = Math.min(Math.max(fontSize, 8), 36);

        if (para.isHeading) {
          doc.font("Helvetica-Bold").fontSize(clampedSize).fillColor("#1A1A2E");
        } else {
          doc.font("Helvetica").fontSize(clampedSize).fillColor("#1A1A2E");
        }

        const textHeight = doc.heightOfString(para.text, { width: contentWidth });
        doc.text(para.text, margin, y, { width: contentWidth });
        y += textHeight + (para.isHeading ? 16 : 8);
      }

      for (const tbl of page.tables) {
        if (y > pageHeight - 150) {
          doc.addPage({ margin: 72 });
          y = margin;
        }

        const allRows = [
          ...tbl.headers.map((r) => ({ row: r, isHeader: true })),
          ...tbl.rows.map((r) => ({ row: r, isHeader: false })),
        ];
        if (allRows.length === 0) continue;

        const maxCols = Math.max(...allRows.map((r) => r.row.length));
        if (maxCols === 0) continue;

        const colWidth = contentWidth / maxCols;
        const cellPad = 4;
        const rowHeight = 20;

        for (const { row, isHeader } of allRows) {
          if (y + rowHeight > pageHeight - 100) {
            doc.addPage({ margin: 72 });
            y = margin;
          }
          for (let c = 0; c < maxCols; c++) {
            const cellX = margin + c * colWidth;
            doc.rect(cellX, y, colWidth, rowHeight).stroke("#CCCCCC");
            doc
              .font(isHeader ? "Helvetica-Bold" : "Helvetica")
              .fontSize(9)
              .fillColor("#1A1A2E")
              .text(row[c] || "", cellX + cellPad, y + cellPad, {
                width: colWidth - cellPad * 2,
                height: rowHeight - cellPad,
                ellipsis: true,
              });
          }
          y += rowHeight;
        }
        y += 12;
      }

      page.images.forEach((imgRegion, idx) => {
        const imgBuffer = imageBuffers[idx];
        if (!imgBuffer) return;
        try {
          const imgW = Math.round(contentWidth * imgRegion.bbox.w);
          const imgH = Math.round(imgW * (imgRegion.bbox.h / Math.max(imgRegion.bbox.w, 0.01)));
          if (y + imgH > pageHeight - 100) {
            doc.addPage({ margin: 72 });
            y = margin;
          }
          doc.image(imgBuffer, margin, y, {
            width: Math.min(imgW, contentWidth),
            height: Math.min(imgH, 300),
          });
          y += Math.min(imgH, 300) + 12;
        } catch {
          // skip
        }
      });

      if (footerPageNumber) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#888888")
          .text(footerPageNumber, margin, pageHeight - 40, {
            width: contentWidth,
            align: "center",
          });
      }
    }

    doc.end();
  });
}
