import type { ImageMetadata } from 'astro';

// Eagerly import every series image. Vite processes/hashes these at build time;
// each module's default export is ImageMetadata ({ src, width, height, format }).
const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/content/series/*/*.jpg',
  { eager: true },
);

export interface SeriesImage {
  path: string;
  data: ImageMetadata;
}

/** All images in a series, in filename order (01-, 02-, ...). */
export function seriesImages(slug: string): SeriesImage[] {
  return Object.entries(images)
    .filter(([path]) => path.includes(`/series/${slug}/`))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, mod]) => ({ path, data: mod.default }));
}

/** The representative image for a series: the `cover` frontmatter file, else the first. */
export function coverImage(slug: string, cover?: string): SeriesImage | undefined {
  const imgs = seriesImages(slug);
  if (cover) {
    const match = imgs.find((i) => i.path.endsWith(`/${cover}`));
    if (match) return match;
  }
  return imgs[0];
}
