import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One entry per series folder: src/content/series/<slug>/index.md
const series = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/series',
    // id = folder name (e.g. "arizona"), not "arizona/index"
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    title: z.string(),
    order: z.number(),
    cover: z.string().optional(),
  }),
});

export const collections = { series };
