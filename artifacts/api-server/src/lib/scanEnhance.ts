import Jimp from "jimp";

const MAX_DIMENSION = 4000;

export async function enhanceForScan(imageBuffer: Buffer): Promise<Buffer> {
  const img = await Jimp.read(imageBuffer);
  const w = img.bitmap.width;
  const h = img.bitmap.height;

  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(w, h);
    img.resize(Math.round(w * scale), Math.round(h * scale));
  }

  const data = img.bitmap.data as Buffer;
  const finalW = img.bitmap.width;
  const finalH = img.bitmap.height;

  img.greyscale();

  const histogram = new Uint32Array(256);
  const totalPixels = (data.length / 4) | 0;
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }

  const lowTarget = Math.floor(totalPixels * 0.03);
  const highTarget = Math.floor(totalPixels * 0.97);
  let cumulative = 0;
  let blackPoint = 0;
  let whitePoint = 255;
  for (let i = 0; i < 256; i++) {
    cumulative += histogram[i];
    if (cumulative >= lowTarget) {
      blackPoint = i;
      break;
    }
  }
  cumulative = 0;
  for (let i = 0; i < 256; i++) {
    cumulative += histogram[i];
    if (cumulative >= highTarget) {
      whitePoint = i;
      break;
    }
  }

  const range = Math.max(whitePoint - blackPoint, 1);
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let v = ((i - blackPoint) / range) * 255;
    v = Math.max(0, Math.min(255, v));
    const norm = v / 255;
    const curved = norm < 0.5
      ? 2 * norm * norm
      : 1 - 2 * (1 - norm) * (1 - norm);
    lut[i] = Math.round(curved * 255);
  }

  for (let i = 0; i < data.length; i += 4) {
    const v = lut[data[i]];
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }

  const rowBytes = finalW * 4;
  const prevRow = new Uint8Array(rowBytes);
  const currRow = new Uint8Array(rowBytes);
  const nextRow = new Uint8Array(rowBytes);

  for (let y = 1; y < finalH - 1; y++) {
    const prevOff = (y - 1) * rowBytes;
    const currOff = y * rowBytes;
    const nextOff = (y + 1) * rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      prevRow[i] = data[prevOff + i];
      currRow[i] = data[currOff + i];
      nextRow[i] = data[nextOff + i];
    }

    for (let x = 1; x < finalW - 1; x++) {
      const px = x * 4;
      const sum =
        prevRow[px - 4] * 0 + prevRow[px] * -0.5 + prevRow[px + 4] * 0 +
        currRow[px - 4] * -0.5 + currRow[px] * 3 + currRow[px + 4] * -0.5 +
        nextRow[px - 4] * 0 + nextRow[px] * -0.5 + nextRow[px + 4] * 0;
      const v = Math.max(0, Math.min(255, Math.round(sum)));
      const idx = currOff + px;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
    }
  }

  return img.quality(92).getBufferAsync(Jimp.MIME_JPEG);
}
