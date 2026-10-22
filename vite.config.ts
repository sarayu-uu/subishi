import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync } from 'node:fs';

// Inlines the logo into index.html so it paints in the very first frame.
const inlineLogo = () => ({
  name: 'inline-logo',
  transformIndexHtml: (html: string) =>
    html.replace('<!--LOGO-->', readFileSync('public/brand/subishi-logo.svg', 'utf8').replace(/<\?xml[^>]*>/, '')),
});

// Preloads the one font the first screen needs (Figtree 400). Its file name carries a hash, so look it up in the bundle.
const preloadBodyFont = () => ({
  name: 'preload-body-font',
  apply: 'build' as const,
  transformIndexHtml: (_html: string, ctx: { bundle?: Record<string, unknown> }) => {
    const file = Object.keys(ctx.bundle ?? {}).find((f) => /figtree-latin-400-normal-[\w-]+\.woff2$/.test(f));
    return file ? [{ tag: 'link', attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' as const }] : [];
  },
});

export default defineConfig({
  plugins: [preact(), inlineLogo(), preloadBodyFont()],
  build: { target: 'es2020', cssCodeSplit: true },
  worker: { format: 'es' }, // MapLibre 6's tile worker is an ES module
});
