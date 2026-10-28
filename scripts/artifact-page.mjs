// Turns dist/index.html into the page body a claude.ai Artifact expects:
// the host adds its own <html>/<head>/<body>, so only the title, the stylesheet,
// the mount point and the entry script are kept. Run after `vite build`.
import { readFile, writeFile } from 'node:fs/promises'

const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
const keep = [
  ...html.matchAll(/<link rel="stylesheet"[^>]*>/g),
  ...html.matchAll(/<script type="module"[^>]*><\/script>/g),
].map((m) => m[0])
const page = ['<title>Enpixant</title>', ...keep.filter((t) => t.startsWith('<link')), '<div id="root"></div>', ...keep.filter((t) => t.startsWith('<script'))].join('\n')
await writeFile(new URL('../dist/artifact.html', import.meta.url), page + '\n')
console.log(page)
