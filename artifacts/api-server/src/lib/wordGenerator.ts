import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Footer,
  AlignmentType,
  ImageRun,
  WidthType,
  HeadingLevel,
  PageBreak,
} from "docx";
import { cropImageRegion } from "./imageProcessor.js";
import type { StoredPage } from "./tempStorage.js";
import { sortPagesWithInterpolation } from "./tempStorage.js";

const FONT = "Calibri";
const BASE_FONT_SIZE = 22;

function ptToHalfPt(em: number): number {
  const pt = Math.round(12 * em);
  return Math.min(Math.max(pt * 2, 16), 72);
}

async function buildPageChildren(
  page: StoredPage,
): Promise<(Paragraph | Table)[]> {
  const children: (Paragraph | Table)[] = [];

  for (const para of page.paragraphs) {
    const size = ptToHalfPt(para.fontSizeEm);
    const p = new Paragraph({
      heading: para.isHeading ? HeadingLevel.HEADING_2 : undefined,
      spacing: { before: para.isHeading ? 240 : 120, after: 80 },
      children: [
        new TextRun({
          text: para.text,
          font: FONT,
          size,
          bold: para.isHeading,
        }),
      ],
    });
    children.push(p);
  }

  for (const tbl of page.tables) {
    const allRows = [...tbl.headers, ...tbl.rows];
    if (allRows.length === 0) continue;

    const tableRows = allRows.map((row, rowIndex) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell || "",
                      font: FONT,
                      size: BASE_FONT_SIZE,
                      bold: rowIndex < tbl.headers.length,
                    }),
                  ],
                }),
              ],
            }),
        ),
      }),
    );

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      }),
    );
    children.push(new Paragraph({ children: [] }));
  }

  for (const imgRegion of page.images) {
    try {
      const imgBuffer = await cropImageRegion(
        page.originalImagePath,
        imgRegion.bbox,
      );
      if (imgBuffer) {
        const targetWidth = Math.round(400 * imgRegion.bbox.w);
        const targetHeight = Math.round(300 * imgRegion.bbox.h);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [
              new ImageRun({
                type: "jpg",
                data: imgBuffer,
                transformation: {
                  width: Math.max(targetWidth, 100),
                  height: Math.max(targetHeight, 75),
                },
              }),
            ],
          }),
        );
      }
    } catch {
      // skip failed images
    }
  }

  return children;
}

export async function generateWordDocument(
  pages: StoredPage[],
  projectName: string,
): Promise<Buffer> {
  const sortedPages = sortPagesWithInterpolation(pages);

  const sections = await Promise.all(
    sortedPages.map(async ({ page, footerPageNumber }, index) => {
      const children = await buildPageChildren(page);

      if (index < sortedPages.length - 1) {
        children.push(
          new Paragraph({ children: [new PageBreak()] }),
        );
      }

      return {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: footerPageNumber
                  ? [
                      new TextRun({
                        text: footerPageNumber,
                        font: FONT,
                        size: 18,
                        color: "888888",
                      }),
                    ]
                  : [],
              }),
            ],
          }),
        },
        children,
      };
    }),
  );

  const doc = new Document({
    creator: "DocScan",
    title: projectName,
    sections,
  });

  return Packer.toBuffer(doc);
}
