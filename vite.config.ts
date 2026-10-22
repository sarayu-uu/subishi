import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync } from 'node:fs';

// Inlines the logo into index.html so it paints in the very first frame. As an <img> (data URI) rather than inline <svg>
// so browsers count it as the page's largest paint; the embedded C2PA metadata block is stripped (about half the file).
const inlineLogo = () => ({
  name: 'inline-logo',
  transformIndexHtml: (html: string) => {
    const svg = readFileSync('public/brand/subishi-logo.svg', 'utf8')
      .replace(/<\?xml[^>]*>/, '').replace(/<metadata>[\s\S]*?<\/metadata>/, '').replace(/\s*xmlns:c2pa="[^"]*"/, '').replace(/\s+/g, ' ').trim();
    const uri = 'data:image/svg+xml,' + svg.replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E');
    return html.replace('<!--LOGO-->', `<img src="${uri}" alt="Subishi" width="2076" height="340" />`);
  },
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

// The splash is styled inline and covers the screen until the app is ready, so the main stylesheet need not block
// the first paint: load it as a preload that switches itself on (with a <noscript> fallback).
const nonBlockingCss = () => ({
  name: 'non-blocking-css',
  apply: 'build' as const,
  transformIndexHtml: {
    order: 'post' as const,
    handler: (html: string) => html.replace(/<link rel="stylesheet"( crossorigin)? href="([^"]+)">/g,
      (_m, co = '', href) => `<link rel="preload" as="style"${co} href="${href}" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${href}"></noscript>`),
  },
});

export default defineConfig({
  plugins: [preact(), inlineLogo(), preloadBodyFont(), nonBlockingCss()],
  build: { target: 'es2020', cssCodeSplit: true },
  worker: { format: 'es' }, // MapLibre 6's tile worker is an ES module
});
