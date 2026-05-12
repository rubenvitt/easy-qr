import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('static/icons');
mkdirSync(OUT, { recursive: true });

function svg(size: number, _padding: number): Buffer {
	const fontSize = Math.round(size * 0.45);
	return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#000000"/>
      <text x="50%" y="50%" font-family="system-ui, sans-serif" font-weight="700"
            font-size="${fontSize}" fill="#ffffff" text-anchor="middle"
            dominant-baseline="central">QR</text>
    </svg>
  `);
}

async function generate(name: string, size: number, padding: number) {
	const png = await sharp(svg(size, padding)).png().toBuffer();
	writeFileSync(resolve(OUT, name), png);
	console.log(`wrote ${name} (${size}x${size})`);
}

await generate('192.png', 192, 0);
await generate('512.png', 512, 0);
// Maskable: safe-zone 80 % (M3-Spec). Wir füllen alles schwarz, Text bleibt im Zentrum → safe.
await generate('maskable.png', 512, 0);
