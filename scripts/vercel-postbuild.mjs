import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DIST = new URL('../dist/', import.meta.url)

const replacements = new Map([
  ['http://127.0.0.1:8787/api/lucia', '/api/lucia'],
  ['http://localhost:8787/api/lucia', '/api/lucia'],
  ['http://127.0.0.1:8790/api/handoff', '/api/handoff'],
  ['http://localhost:8790/api/handoff', '/api/handoff'],
  ['http://127.0.0.1:8790/api/calls/health', '/api/calls/health'],
  ['http://localhost:8790/api/calls/health', '/api/calls/health'],
  ['http://127.0.0.1:8790/api/calls/summary', '/api/calls/summary'],
  ['http://localhost:8790/api/calls/summary', '/api/calls/summary'],
])

const editableExtensions = new Set([
  '.js',
  '.mjs',
  '.html',
  '.css',
  '.json',
])

function extension(path) {
  const index = path.lastIndexOf('.')
  return index >= 0 ? path.slice(index) : ''
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(path))
    } else if (editableExtensions.has(extension(entry.name))) {
      files.push(path)
    }
  }

  return files
}

const distPath = DIST.pathname.startsWith('/') && process.platform === 'win32'
  ? DIST.pathname.slice(1)
  : DIST.pathname

let replacementCount = 0

for (const file of await walk(distPath)) {
  let content = await readFile(file, 'utf8')
  const original = content

  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      const occurrences = content.split(from).length - 1
      replacementCount += occurrences
      content = content.split(from).join(to)
    }
  }

  if (content !== original) {
    await writeFile(file, content, 'utf8')
  }
}

console.log(`[vercel-postbuild] ${replacementCount} endpoint(s) localhost convertidos a rutas relativas.`)
