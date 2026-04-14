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

  img.greyscale();

  const histogram = new Uint32Array(256);
  const totalPixels = (data.length / 4) | 0;
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }

  const lowTarget = Math.floor(totalPixels * 0.01);
  const highTarget = Math.floor(totalPixels * 0.99);
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
    lut[i] = Math.round(v);
  }

  for (let i = 0; i < data.length; i += 4) {
    const v = lut[data[i]];
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }

  return img.quality(98).getBufferAsync(Jimp.MIME_JPEG);
}
