import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync } from 'node:fs';

// Inlines the logo into index.html so it paints in the very first frame.
const inlineLogo = () => ({
  name: 'inline-logo',
  transformIndexHtml: (html: string) =>
    html.replace('<!--LOGO-->', readFileSync('public/brand/subishi-logo.svg', 'utf8').replace(/<\?xml[^>]*>/, '')),
});

export default defineConfig({
  plugins: [preact(), inlineLogo()],
  build: { target: 'es2020', cssCodeSplit: true },
  worker: { format: 'es' }, // MapLibre 6's tile worker is an ES module
});
