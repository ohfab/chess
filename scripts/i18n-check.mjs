// Lists translation keys used in src/ (t('…'), tn(n, '…', '…'), tk('…'), and the fields a
// file names in a "// i18n-fields: name, about" line) that a language does not translate
// yet. Comment lines are skipped. Usage: node scripts/i18n-check.mjs [file-or-dir …]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['src']
const files = []
const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).forEach((f) => walk(join(p, f))) : /\.(ts|tsx)$/.test(p) && files.push(p))
roots.forEach(walk)

const unquote = (q, body) => (q === '`' ? body : body.replace(/\\(['"\\])/g, '$1'))
const keys = new Map()
const lit = String.raw`(['"\x60])((?:\\.|(?!\1)[^\\])*)\1`
const patterns = [new RegExp(String.raw`\b(?:t|tk)\(\s*` + lit, 'g'), new RegExp(String.raw`\btn\([^,]+,\s*` + lit + String.raw`\s*,\s*` + lit.replace('\\1', '\\3'), 'g')]
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  // a match inside a // or /* */ comment line is an example, not a key
  const inComment = (at) => {
    const line = src.slice(src.lastIndexOf('\n', at) + 1, at)
    return /^\s*(\*|\/\*)/.test(line) || line.includes('//')
  }
  for (const m of src.matchAll(patterns[0])) if (!inComment(m.index)) keys.set(unquote(m[1], m[2]), f)
  for (const m of src.matchAll(patterns[1])) {
    if (inComment(m.index)) continue
    keys.set(unquote(m[1], m[2]), f)
    keys.set(unquote(m[3], m[4]), f)
  }
  const fields = src.match(/^\s*\/\/ i18n-fields: ([\w, ]+)$/m)?.[1].split(',').map((x) => x.trim())
  for (const field of fields ?? []) {
    for (const m of src.matchAll(new RegExp(String.raw`\b${field}:\s*` + lit, 'g'))) keys.set(unquote(m[1], m[2]), f)
  }
}

const dir = 'src/i18n/parts'
const dicts = {}
for (const f of readdirSync(dir)) {
  const [, lang] = f.match(/\.(\w+)\.json$/) ?? []
  if (!lang) continue
  dicts[lang] ??= {}
  Object.assign(dicts[lang], JSON.parse(readFileSync(join(dir, f), 'utf8')))
}
let missing = 0
for (const lang of ['en', 'fr', 'it']) {
  const list = [...keys.keys()].filter((k) => !(k in (dicts[lang] ?? {})))
  missing += list.length
  console.log(`${lang}: ${keys.size - list.length}/${keys.size} translated`)
  for (const k of list.slice(0, 40)) console.log(`  missing (${keys.get(k)}): ${k}`)
  if (list.length > 40) console.log(`  … ${list.length - 40} more`)
}
process.exit(missing ? 1 : 0)
