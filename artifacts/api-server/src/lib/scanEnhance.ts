import Jimp from "jimp";

export async function enhanceForScan(imageBuffer: Buffer): Promise<Buffer> {
  const img = await Jimp.read(imageBuffer);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const data = img.bitmap.data as Buffer;

  img.greyscale();

  const pixels: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push(data[i]);
  }
  pixels.sort((a, b) => a - b);

  const blackPoint = pixels[Math.floor(pixels.length * 0.03)] ?? 0;
  const whitePoint = pixels[Math.floor(pixels.length * 0.97)] ?? 255;
  const range = Math.max(whitePoint - blackPoint, 1);

  for (let i = 0; i < data.length; i += 4) {
    let v = data[i];
    v = ((v - blackPoint) / range) * 255;
    v = Math.max(0, Math.min(255, Math.round(v)));

    const norm = v / 255;
    const curved = norm < 0.5
      ? 2 * norm * norm
      : 1 - 2 * (1 - norm) * (1 - norm);
    v = Math.round(curved * 255);

    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }

  const sharpKernel = [
    [0, -0.5, 0],
    [-0.5, 3, -0.5],
    [0, -0.5, 0],
  ];
  const src = Buffer.from(data);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * w + (x + kx)) * 4;
          sum += src[idx] * sharpKernel[ky + 1][kx + 1];
        }
      }
      const idx = (y * w + x) * 4;
      const v = Math.max(0, Math.min(255, Math.round(sum)));
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
    }
  }

  return img.quality(92).getBufferAsync(Jimp.MIME_JPEG);
}
