import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One entry per series folder: src/content/series/<slug>/index.md
const series = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/series',
    // id = folder name (e.g. "aviation"), not "aviation/index"
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    // Series title, shown on the landing page and series page.
    title: z.string(),
    // Position on the landing page. This is a ranking, not an arrangement (§1).
    order: z.number(),
    // Which image file represents the series on the landing page.
    cover: z.string().optional(),
    // One or two sentences, shown under the series title. Optional (§3).
    blurb: z.string().optional(),
    // Per-image metadata, keyed by filename (e.g. "01-dsc-8640.jpg").
    // Alt text is written by hand and describes the photograph (§3). `full`
    // promotes a frame to full-bleed on the series page (§6, used sparingly).
    images: z
      .record(
        z.string(),
        z.object({
          alt: z.string(),
          caption: z.string().optional(),
          full: z.boolean().optional(),
        }),
      )
      .optional(),
  }),
});

export const collections = { series };
