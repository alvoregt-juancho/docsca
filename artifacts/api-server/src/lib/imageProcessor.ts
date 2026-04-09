import { readFile } from "fs/promises";
import type { BBox } from "./tempStorage.js";

export async function cropImageRegion(
  imagePath: string,
  bbox: BBox,
): Promise<Buffer | null> {
  try {
    const imageBuffer = await readFile(imagePath);
    const Jimp = (await import("jimp")).default;

    const image = await Jimp.read(imageBuffer);
    const imgWidth = image.getWidth();
    const imgHeight = image.getHeight();

    const x = Math.round(bbox.x * imgWidth);
    const y = Math.round(bbox.y * imgHeight);
    const w = Math.max(1, Math.round(bbox.w * imgWidth));
    const h = Math.max(1, Math.round(bbox.h * imgHeight));

    const safeX = Math.max(0, Math.min(x, imgWidth - 1));
    const safeY = Math.max(0, Math.min(y, imgHeight - 1));
    const safeW = Math.min(w, imgWidth - safeX);
    const safeH = Math.min(h, imgHeight - safeY);

    if (safeW <= 0 || safeH <= 0) return null;

    image.crop(safeX, safeY, safeW, safeH);
    return image.getBufferAsync("image/jpeg" as any);
  } catch {
    return null;
  }
}

export async function readImageAsBuffer(imagePath: string): Promise<Buffer | null> {
  try {
    return await readFile(imagePath);
  } catch {
    return null;
  }
}
