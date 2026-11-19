import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { moduleSchema } from './lib/modules';

const modules = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/modules' }),
  schema: moduleSchema,
});

export const collections = { modules };
