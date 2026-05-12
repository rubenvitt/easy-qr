import type { Page } from '@playwright/test';
import sharp from 'sharp';
import jsQR from 'jsqr';

export async function decodeVisibleQr(page: Page): Promise<string> {
  const svgXml = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    if (!svg) throw new Error('no svg in page');
    return new XMLSerializer().serializeToString(svg);
  });

  const size = 512;
  const { data, info } = await sharp(Buffer.from(svgXml))
    .resize(size, size, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!code) throw new Error('jsqr could not decode QR');
  return code.data;
}
