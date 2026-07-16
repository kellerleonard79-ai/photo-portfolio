#!/usr/bin/env node
/**
 * Build contact sheets from a folder of photos.
 *
 * Usage:
 *   node scripts/contact-sheet.js --from <folder> [--out <dir>]
 *
 * Walks <folder>, groups every image by the directory that contains it, and
 * writes ONE contact-sheet JPG per folder. Each sheet is a grid montage, 5
 * thumbnails across, each thumbnail ~300px on its long edge and labelled
 * underneath with `<folder-name>/<filename>` (e.g. yosemite/03-dsc-8640).
 *
 * Point --from at a single series folder to get one sheet, or at a parent
 * (e.g. src/content/series) to get one sheet for every series under it.
 *
 * Sheets are written to --out (default ./contact-sheets) and each is kept
 * under ~4MB by backing off JPEG quality if a sheet ever runs large.
 */

import { parseArgs } from 'node:util';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const THUMB = 300;        // thumbnail long edge, px
const COLS = 5;           // thumbnails across
const GAP = 16;           // gap between cells, px
const MARGIN = 24;        // outer margin around the grid, px
const LABEL_FONT = 12;    // label font size, px
const LABEL_AREA = 24;    // vertical room reserved for the label under a thumb
const CELL_W = THUMB;             // fixed cell width; thumbs are centred in it
const CELL_H = THUMB + LABEL_AREA; // image area + label strip
const MAX_BYTES = 4 * 1024 * 1024; // ~4MB per sheet

const IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.webp',
  '.tif', '.tiff', '.gif', '.avif', '.heic', '.heif',
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

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

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Escape a string for safe interpolation into SVG/XML text. */
function xmlEscape(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const isImage = (name) =>
  !name.startsWith('.') && IMAGE_EXTS.has(path.extname(name).toLowerCase());

const naturalSort = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/**
 * Recursively collect image files under `dir`, grouped by their containing
 * directory. Returns a Map<dirPath, filename[]>, filenames naturally sorted.
 */
async function collectByFolder(dir) {
  const groups = new Map();
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) {
        await walk(path.join(current, e.name));
      } else if (e.isFile() && isImage(e.name)) {
        files.push(e.name);
      }
    }
    if (files.length) groups.set(current, files.sort(naturalSort));
  }
  await walk(dir);
  return groups;
}

/**
 * Render one contact sheet for a single folder's images.
 * Returns the JPEG buffer.
 */
async function buildSheet(dir, files) {
  const folderName = path.basename(dir);
  const rows = Math.ceil(files.length / COLS);
  const width = MARGIN * 2 + COLS * CELL_W + (COLS - 1) * GAP;
  const height = MARGIN * 2 + rows * CELL_H + (rows - 1) * GAP;

  // Resize every image to a thumbnail and place it, centred, in its cell.
  // Labels for the whole sheet are drawn once as a single SVG overlay.
  const composites = [];
  const labels = [];

  for (let i = 0; i < files.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cellX = MARGIN + col * (CELL_W + GAP);
    const cellY = MARGIN + row * (CELL_H + GAP);

    // .rotate() bakes EXIF orientation so thumbs stay upright; flatten gives
    // transparent source images a white background instead of black.
    const { data, info } = await sharp(path.join(dir, files[i]), { failOn: 'none' })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize(THUMB, THUMB, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });

    composites.push({
      input: data,
      left: cellX + Math.floor((CELL_W - info.width) / 2),
      top: cellY + Math.floor((THUMB - info.height) / 2),
    });

    const base = path.basename(files[i], path.extname(files[i]));
    const label = `${folderName}/${base}`;
    // Shrink the font just enough that long labels don't overflow the cell.
    // monospace advance is ~0.6em; leave a couple px of breathing room.
    const maxChars = Math.floor((CELL_W - 4) / (LABEL_FONT * 0.6));
    const fontSize = label.length <= maxChars
      ? LABEL_FONT
      : Math.max(8, Math.floor(LABEL_FONT * maxChars / label.length));
    labels.push(
      `<text x="${cellX + CELL_W / 2}" y="${cellY + THUMB + LABEL_FONT + 4}" ` +
      `font-size="${fontSize}" text-anchor="middle">${xmlEscape(label)}</text>`,
    );
  }

  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<style>text{font-family:monospace;fill:#111}</style>` +
    labels.join('') +
    `</svg>`,
  );
  composites.push({ input: overlay, top: 0, left: 0 });

  const canvas = sharp({
    create: { width, height, channels: 3, background: '#ffffff' },
  }).composite(composites);

  // Encode, backing off quality if a sheet ever exceeds the size cap.
  for (let quality = 82; quality >= 40; quality -= 8) {
    const buf = await canvas
      .clone()
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (buf.length <= MAX_BYTES || quality === 40) return buf;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      out: { type: 'string' },
    },
  });

  if (!values.from) {
    die('usage: node scripts/contact-sheet.js --from <folder> [--out <dir>]');
  }

  const fromDir = path.resolve(values.from);
  if (!existsSync(fromDir)) die(`source folder not found: ${fromDir}`);

  const outDir = path.resolve(values.out || 'contact-sheets');
  await mkdir(outDir, { recursive: true });

  const groups = await collectByFolder(fromDir);
  if (groups.size === 0) die(`no images found under ${fromDir}`);

  const dirs = [...groups.keys()].sort(naturalSort);
  console.log(`\nBuilding ${dirs.length} contact sheet${dirs.length === 1 ? '' : 's'} into ${path.relative(PROJECT_ROOT, outDir) || '.'}/\n`);

  for (const dir of dirs) {
    const files = groups.get(dir);
    const buf = await buildSheet(dir, files);

    // Name the sheet after its path relative to --from, so nested folders that
    // share a basename can't collide; a leaf --from uses its own name.
    const rel = path.relative(fromDir, dir);
    const stem = slugify(rel === '' ? path.basename(fromDir) : rel) || 'contact-sheet';
    const outName = `${stem}-contact-sheet.jpg`;
    await writeFile(path.join(outDir, outName), buf);

    console.log(`  ${outName}  (${files.length} image${files.length === 1 ? '' : 's'}, ${humanSize(buf.length)})`);
  }

  console.log();
}

main().catch((err) => die(err?.message || String(err)));
