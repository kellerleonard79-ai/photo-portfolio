import type { ImageMetadata } from 'astro';
import path from 'node:path';
import sharp from 'sharp';

// Eagerly import every series image. Vite processes/hashes these at build time;
// each module's default export is ImageMetadata ({ src, width, height, format }).
const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/content/series/*/*.jpg',
  { eager: true },
);

/** Per-image metadata written by hand in the series index.md (§3). */
export interface ImageMeta {
  alt: string;
  caption?: string;
  full?: boolean;
}
export type ImagesFrontmatter = Record<string, ImageMeta> | undefined;

export interface Photo {
  /** Import key, e.g. "/src/content/series/aviation/01-dsc-8640.jpg". */
  key: string;
  /** Filename only, e.g. "01-dsc-8640.jpg". */
  file: string;
  data: ImageMetadata;
  /** width / height. */
  ar: number;
  alt: string;
  caption?: string;
  full: boolean;
  /** Inline blurred placeholder shown while the full image loads (§4.5). */
  lqip: string;
}

/** Raw import entries for one series, in filename order (01-, 02-, ...). */
function entriesFor(slug: string): Array<[string, ImageMetadata]> {
  return Object.entries(images)
    .filter(([key]) => key.includes(`/series/${slug}/`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, mod]) => [key, mod.default]);
}

// Generating the LQIP means reading the source file with sharp, so memoize it —
// the home page (covers) and series pages both ask for the same images.
const lqipCache = new Map<string, string>();

async function lqipFor(key: string): Promise<string> {
  const cached = lqipCache.get(key);
  if (cached) return cached;
  // key starts with "/src/..."; the source file sits at that path under cwd.
  const abs = path.join(process.cwd(), key);
  const buf = await sharp(abs)
    .resize(24, 24, { fit: 'inside' })
    .blur()
    .jpeg({ quality: 40 })
    .toBuffer();
  const uri = `data:image/jpeg;base64,${buf.toString('base64')}`;
  lqipCache.set(key, uri);
  return uri;
}

async function toPhoto(
  key: string,
  data: ImageMetadata,
  meta: ImagesFrontmatter,
): Promise<Photo> {
  const file = key.split('/').pop()!;
  const m = meta?.[file];
  return {
    key,
    file,
    data,
    ar: data.width / data.height,
    // Alt is required on every image (§3, §7). Fall back loudly if one is missing
    // so it surfaces in review rather than shipping an empty alt.
    alt: m?.alt ?? `MISSING ALT: ${file}`,
    caption: m?.caption,
    full: m?.full ?? false,
    lqip: await lqipFor(key),
  };
}

/** All images in a series, in sequence, with merged metadata and placeholders. */
export async function seriesPhotos(
  slug: string,
  meta: ImagesFrontmatter,
): Promise<Photo[]> {
  return Promise.all(entriesFor(slug).map(([key, data]) => toPhoto(key, data, meta)));
}

/** The representative image for a series: the `cover` file, else the first. */
export async function coverPhoto(
  slug: string,
  cover: string | undefined,
  meta: ImagesFrontmatter,
): Promise<Photo | undefined> {
  const entries = entriesFor(slug);
  const picked =
    (cover && entries.find(([key]) => key.endsWith(`/${cover}`))) || entries[0];
  if (!picked) return undefined;
  return toPhoto(picked[0], picked[1], meta);
}
