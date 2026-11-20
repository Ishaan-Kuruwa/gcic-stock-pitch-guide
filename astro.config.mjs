// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  // Pages stay prerendered (output 'static'). The adapter only serves routes
  // that opt out with `export const prerender = false` (sign-in, /account).
  // Vitest loads this config through getViteConfig; tests cover pure logic in
  // src/lib, so they run in Node without the adapter's workerd runtime.
  adapter: process.env.VITEST ? undefined : cloudflare({ imageService: 'compile' }),
  // We don't use Astro sessions, so no SESSION KV namespace is provisioned.
  session: false,

  vite: {
    plugins: [tailwindcss()]
  },

  markdown: {
    // Unified (remark/rehype) pipeline so modules can use KaTeX formulas.
    processor: unified({
      // Only $$...$$ is math, so dollar amounts like $297.2B stay plain text.
      remarkPlugins: [[remarkMath, { singleDollarTextMath: false }]],
      rehypePlugins: [rehypeKatex],
    }),
  },

  integrations: [
    mdx(),
    preact(),
  ]
});