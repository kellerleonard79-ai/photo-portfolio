#!/usr/bin/env node
/**
 * Import photos into a series.
 *
 * Usage:
 *   node scripts/import-photos.js --from <folder> --series <slug>
 *
 * For every image in <folder> this:
 *   - converts to JPEG, resized to 2400px on the long edge at quality 85
 *   - bakes in EXIF orientation, then strips ALL metadata (so GPS location
 *     data can never leak — see note below)
 *   - writes it to src/content/series/<slug>/ named sequentially as
 *     01-<original-name>.jpg, 02-<original-name>.jpg, ...
 *
 * It creates the series folder if needed and, if there's no index.md yet,
 * writes a stub with `title` and `order` frontmatter.
 *
 * Note on EXIF: sharp does not copy source metadata unless asked, so simply
 * not preserving it strips everything — camera, lens, timestamps AND GPS.
 * That's the surest way to guarantee no location data ships. If you later
 * want to display camera/lens EXIF, we'd preserve metadata and drop only the
 * GPS IFD instead.
 */

import { parseArgs } from 'node:util';
import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const LONG_EDGE = 2400;
const QUALITY = 85;
const IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.webp',
  '.tif', '.tiff', '.gif', '.avif', '.heic', '.heif',
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERIES_ROOT = path.join(PROJECT_ROOT, 'src', 'content', 'series');

function die(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

/** filename-safe slug: lowercase, accents stripped, non-alphanumerics -> '-' */
function slugify(s) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "joshua_tree" / "new-york" -> "Joshua Tree" / "New York" */
function titleFromSlug(slug) {
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Next landing-page order: one past the highest `order:` among sibling series. */
async function nextOrder() {
  let max = 0;
  const dirs = await readdir(SERIES_ROOT, { withFileTypes: true }).catch(() => []);
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    try {
      const txt = await readFile(path.join(SERIES_ROOT, d.name, 'index.md'), 'utf8');
      const m = txt.match(/^order:\s*(\d+)/m);
      if (m) max = Math.max(max, Number(m[1]));
    } catch {
      /* no index.md here — skip */
    }
  }
  return max + 1;
}

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      series: { type: 'string' },
    },
  });

  if (!values.from || !values.series) {
    die('usage: node scripts/import-photos.js --from <folder> --series <slug>');
  }

  const fromDir = path.resolve(values.from);
  const series = slugify(values.series);
  if (!series) die(`--series "${values.series}" is not a valid slug`);
  if (!existsSync(fromDir)) die(`source folder not found: ${fromDir}`);

  const destDir = path.join(SERIES_ROOT, series);

  // Collect image files, sorted naturally so 2 comes before 10.
  const entries = await readdir(fromDir, { withFileTypes: true });
  const images = entries
    .filter(
      (e) =>
        e.isFile() &&
        !e.name.startsWith('.') &&
        IMAGE_EXTS.has(path.extname(e.name).toLowerCase()),
    )
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (images.length === 0) {
    die(`no images found in ${fromDir}`);
  }

  await mkdir(destDir, { recursive: true });

  const padWidth = Math.max(2, String(images.length).length);
  const results = [];

  for (let i = 0; i < images.length; i++) {
    const original = images[i];
    const base = slugify(path.basename(original, path.extname(original))) || 'image';
    const seq = String(i + 1).padStart(padWidth, '0');
    const outName = `${seq}-${base}.jpg`;
    const outPath = path.join(destDir, outName);

    // .rotate() with no angle applies the EXIF orientation to the pixels
    // BEFORE we drop metadata, so the image stays upright afterward.
    // No keep*/withMetadata call => all EXIF (incl. GPS) is stripped.
    const info = await sharp(path.join(fromDir, original), { failOn: 'none' })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize(LONG_EDGE, LONG_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: QUALITY })
      .toFile(outPath);

    results.push({ original, outName, ...info });
  }

  // Stub index.md — never clobber an existing (curated) one.
  const indexPath = path.join(destDir, 'index.md');
  let indexStatus;
  if (existsSync(indexPath)) {
    indexStatus = 'kept existing index.md';
  } else {
    const order = await nextOrder();
    const title = titleFromSlug(series);
    await writeFile(indexPath, `---\ntitle: "${title}"\norder: ${order}\n---\n`);
    indexStatus = `wrote stub index.md (title: "${title}", order: ${order})`;
  }

  // Report.
  const relDest = path.relative(PROJECT_ROOT, destDir);
  console.log(`\nImported ${results.length} image${results.length === 1 ? '' : 's'} into ${relDest}/`);
  console.log('EXIF (including GPS) stripped from every image.\n');
  for (const r of results) {
    console.log(`  ${r.original}  ->  ${r.outName}  (${r.width}x${r.height}, ${humanSize(r.size)})`);
  }
  console.log(`\n  ${indexStatus}\n`);
}

main().catch((err) => die(err?.message || String(err)));
