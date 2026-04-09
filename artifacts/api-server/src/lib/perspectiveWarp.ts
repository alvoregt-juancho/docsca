import Jimp from "jimp";

export interface Corners {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  bl: { x: number; y: number };
  br: { x: number; y: number };
}

function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

function computeHomography(
  src: [number, number][],
  dst: [number, number][],
): number[] {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i];
    const [dx, dy] = dst[i];

    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);

    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  const h = solveLinear(A, b);
  return [...h, 1];
}

function applyH(H: number[], x: number, y: number): [number, number] {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

export async function warpPerspective(
  imageBuffer: Buffer,
  corners: Corners,
  targetWidth: number,
): Promise<Buffer> {
  const src = await Jimp.read(imageBuffer);
  const srcW = src.bitmap.width;
  const srcH = src.bitmap.height;

  const aspectRatio =
    Math.sqrt(
      ((corners.br.x - corners.bl.x) ** 2 + (corners.br.y - corners.bl.y) ** 2) *
        ((corners.tr.x - corners.tl.x) ** 2 + (corners.tr.y - corners.tl.y) ** 2),
    ) /
    Math.sqrt(
      ((corners.tr.x - corners.br.x) ** 2 + (corners.tr.y - corners.br.y) ** 2) *
        ((corners.tl.x - corners.bl.x) ** 2 + (corners.tl.y - corners.bl.y) ** 2),
    );

  const outW = Math.min(targetWidth, srcW);
  const outH = Math.max(1, Math.round(outW / Math.max(0.1, Math.sqrt(aspectRatio))));

  // Source corners: tl, tr, br, bl
  const srcPts: [number, number][] = [
    [corners.tl.x, corners.tl.y],
    [corners.tr.x, corners.tr.y],
    [corners.br.x, corners.br.y],
    [corners.bl.x, corners.bl.y],
  ];

  // Destination rectangle: tl, tr, br, bl
  const dstPts: [number, number][] = [
    [0, 0],
    [outW - 1, 0],
    [outW - 1, outH - 1],
    [0, outH - 1],
  ];

  // Inverse homography: dst pixel → src pixel
  const H_inv = computeHomography(dstPts, srcPts);

  const srcData = src.bitmap.data as Buffer;
  const dstData = Buffer.alloc(outW * outH * 4, 255);

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      const [fsx, fsy] = applyH(H_inv, dx, dy);
      const sx0 = Math.floor(fsx);
      const sy0 = Math.floor(fsy);

      if (sx0 < 0 || sy0 < 0 || sx0 >= srcW - 1 || sy0 >= srcH - 1) continue;

      const fx = fsx - sx0;
      const fy = fsy - sy0;
      const wfx = 1 - fx;
      const wfy = 1 - fy;

      const i00 = (sy0 * srcW + sx0) * 4;
      const i10 = (sy0 * srcW + sx0 + 1) * 4;
      const i01 = ((sy0 + 1) * srcW + sx0) * 4;
      const i11 = ((sy0 + 1) * srcW + sx0 + 1) * 4;
      const di = (dy * outW + dx) * 4;

      for (let c = 0; c < 3; c++) {
        dstData[di + c] = Math.round(
          wfx * wfy * srcData[i00 + c] +
            fx * wfy * srcData[i10 + c] +
            wfx * fy * srcData[i01 + c] +
            fx * fy * srcData[i11 + c],
        );
      }
      dstData[di + 3] = 255;
    }
  }

  const dstImg = await Jimp.create(outW, outH, 0xffffffff);
  (dstImg.bitmap.data as Buffer).set(dstData);

  return dstImg.getBufferAsync(Jimp.MIME_JPEG);
}
