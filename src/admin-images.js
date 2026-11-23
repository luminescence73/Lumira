import sharp from 'sharp';

async function resizeExpression(imageUrl, size, maxBytes) {
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error('Could not fetch image');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5e6) throw Error('Image too large');
  const output = await sharp(bytes)
    .resize(size, size, { fit: 'contain', background: '#00000000' })
    .png()
    .toBuffer();
  if (output.length > maxBytes) throw Error('Resized image exceeds the Discord upload limit');
  return output;
}

export const imageForEmoji = (url) => resizeExpression(url, 128, 256 * 1024);
export const imageForSticker = (url) => resizeExpression(url, 320, 512 * 1024);
