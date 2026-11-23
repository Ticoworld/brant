import {ccc} from '@ckb-ccc/core';
import sharp from 'sharp';

export async function validateLaunchLogo(encoded: unknown, expectedHash?: string) {
  if (encoded === undefined && expectedHash === undefined) return undefined;
  if (typeof encoded !== 'string' || !expectedHash || encoded.length > 56_000) throw Error('Invalid logo payload');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.toString('base64') !== encoded || ccc.hashCkb(bytes) !== expectedHash) {
    throw Error('Logo content does not match signed metadata');
  }
  const image = sharp(bytes, {failOn: 'warning', limitInputPixels: 512 * 512});
  const {format, width, height, pages} = await image.metadata();
  if (!format || !['png', 'jpeg', 'webp'].includes(format) || !width || !height ||
      width > 512 || height > 512 || (pages ?? 1) !== 1) throw Error('Unsupported token logo');
  return (await image.rotate().resize(128, 128, {fit: 'inside', withoutEnlargement: true}).png().toBuffer()).toString('base64');
}
