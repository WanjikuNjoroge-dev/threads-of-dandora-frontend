import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(projectRoot, 'assets', 'image-sources.json');
const force = process.argv.includes('--force');
const downloadOnly = process.argv.includes('--download-only');
const sharp = downloadOnly ? null : (await import('sharp')).default;

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
validateManifest(manifest);

const sourceDirectory = resolveProjectPath(manifest.sourceDirectory);
const outputDirectory = resolveProjectPath(manifest.outputDirectory);

await mkdir(sourceDirectory, { recursive: true });
await mkdir(outputDirectory, { recursive: true });

for (const image of manifest.images) {
  const profile = manifest.profiles[image.profile];
  const sourcePath = path.join(sourceDirectory, `${image.name}.jpg`);
  const largestWidth = Math.max(...profile.widths);

  if (force || !(await fileExists(sourcePath))) {
    const downloadUrl = buildDownloadUrl(image.sourceUrl, largestWidth);
    process.stdout.write(`Downloading ${image.name}... `);
    await downloadImage(downloadUrl, sourcePath);
    process.stdout.write('done\n');
  } else {
    process.stdout.write(`Using cached source for ${image.name}\n`);
  }

  if (downloadOnly) continue;

  await ensureReadableImage(sourcePath, image.name);

  for (const width of profile.widths) {
    const jpegPath = path.join(outputDirectory, `${image.name}-${width}.jpg`);
    const webpPath = path.join(outputDirectory, `${image.name}-${width}.webp`);

    if (force || !(await fileExists(jpegPath))) {
      await writeVariant(sourcePath, jpegPath, width, 'jpeg', profile.jpegQuality);
    }

    if (force || !(await fileExists(webpPath))) {
      await writeVariant(sourcePath, webpPath, width, 'webp', profile.webpQuality);
    }
  }
}

process.stdout.write(downloadOnly
  ? `Downloaded image sources to ${path.relative(projectRoot, sourceDirectory)}\n`
  : `Generated responsive images in ${path.relative(projectRoot, outputDirectory)}\n`);

function validateManifest(value) {
  if (!value || value.version !== 1) {
    throw new Error('Image manifest must have version 1.');
  }

  if (!value.profiles || typeof value.profiles !== 'object') {
    throw new Error('Image manifest must define profiles.');
  }

  if (!Array.isArray(value.images) || value.images.length === 0) {
    throw new Error('Image manifest must contain at least one image.');
  }

  const names = new Set();

  for (const image of value.images) {
    if (!image || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(image.name || '')) {
      throw new Error(`Invalid image name: ${String(image && image.name)}`);
    }

    if (names.has(image.name)) {
      throw new Error(`Duplicate image name: ${image.name}`);
    }
    names.add(image.name);

    if (!value.profiles[image.profile]) {
      throw new Error(`Unknown profile "${image.profile}" for ${image.name}.`);
    }

    let url;
    try {
      url = new URL(image.sourceUrl);
    } catch {
      throw new Error(`Invalid source URL for ${image.name}.`);
    }

    if (url.protocol !== 'https:' || url.hostname !== 'images.unsplash.com') {
      throw new Error(`Only HTTPS images.unsplash.com sources are allowed (${image.name}).`);
    }

    const profile = value.profiles[image.profile];
    if (!Array.isArray(profile.widths) || profile.widths.length === 0 ||
        profile.widths.some((width) => !Number.isInteger(width) || width < 1)) {
      throw new Error(`Profile "${image.profile}" has invalid widths.`);
    }

    for (const [key, quality] of [
      ['jpegQuality', profile.jpegQuality],
      ['webpQuality', profile.webpQuality]
    ]) {
      if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
        throw new Error(`Profile "${image.profile}" has invalid ${key}.`);
      }
    }
  }
}

function resolveProjectPath(relativePath) {
  const absolutePath = path.resolve(projectRoot, relativePath);
  const relativeToRoot = path.relative(projectRoot, absolutePath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Manifest path escapes the project root: ${relativePath}`);
  }

  return absolutePath;
}

function buildDownloadUrl(sourceUrl, width) {
  const url = new URL(sourceUrl);
  url.searchParams.set('auto', 'format');
  url.searchParams.set('fit', 'max');
  url.searchParams.set('fm', 'jpg');
  url.searchParams.set('q', '95');
  url.searchParams.set('w', String(width));
  return url;
}

async function downloadImage(url, destination) {
  const response = await fetch(url, {
    headers: {
      Accept: 'image/jpeg',
      'User-Agent': 'threads-of-dandora-image-pipeline/1.0'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000)
  });

  if (!response.ok) {
    throw new Error(`Image request failed (${response.status} ${response.statusText}): ${url}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Expected an image but received "${contentType || 'unknown'}": ${url}`);
  }

  const temporaryPath = `${destination}.tmp`;
  try {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      throw new Error(`Received an empty image response: ${url}`);
    }
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, destination);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function ensureReadableImage(sourcePath, name) {
  try {
    const metadata = await sharp(sourcePath).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('missing dimensions');
    }
  } catch (error) {
    throw new Error(`Source image for ${name} is not readable: ${error.message}`);
  }
}

async function writeVariant(sourcePath, destination, width, format, quality) {
  const temporaryPath = `${destination}.tmp`;
  let pipeline = sharp(sourcePath)
    .rotate()
    .resize({ width, fit: 'inside', withoutEnlargement: false });

  pipeline = format === 'jpeg'
    ? pipeline.jpeg({ quality, mozjpeg: true })
    : pipeline.webp({ quality });

  try {
    const result = await pipeline.toFile(temporaryPath);
    if (result.width !== width || result.format !== format) {
      throw new Error(
        `Variant validation failed for ${path.basename(destination)}: ` +
        `expected ${format} at ${width}px, received ${result.format} at ${result.width}px.`
      );
    }
    await rename(temporaryPath, destination);
    process.stdout.write(`  ${path.basename(destination)}\n`);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}
