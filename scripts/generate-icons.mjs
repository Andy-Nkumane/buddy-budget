import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = new URL('../assets/brand/app-icon-master.png', import.meta.url);
const outputDirectory = new URL('../public/icons/', import.meta.url);

await mkdir(outputDirectory, { recursive: true });

await Promise.all(
  [192, 512].map((size) =>
    sharp(fileURLToPath(source))
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(fileURLToPath(new URL(`icon-${size}.png`, outputDirectory))),
  ),
);
