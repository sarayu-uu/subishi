// npm run links — every outbound link in the project files must answer
import { readFileSync, readdirSync } from 'node:fs';
const urls = new Set<string>();
for (const f of readdirSync('data/projects')) {
  const p = JSON.parse(readFileSync(`data/projects/${f}`, 'utf8'));
  Object.values(p.links ?? {}).forEach((u) => urls.add(u as string));
  if (p.price?.source?.url) urls.add(p.price.source.url);
}
let bad = 0;
await Promise.all([...urls].map(async (u) => {
  try { const r = await fetch(u, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000) }); if (r.status >= 400) { bad++; console.error(`✗ ${r.status} ${u}`); } }
  catch (e) { bad++; console.error(`✗ ${(e as Error).message} ${u}`); }
}));
console.log(bad ? `${bad} broken of ${urls.size}` : `✓ all ${urls.size} links answer`);
process.exit(bad ? 1 : 0);
