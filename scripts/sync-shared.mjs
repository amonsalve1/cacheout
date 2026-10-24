import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'supabase', 'functions', '_shared')

// Pure, browser-free, Deno-safe. time.ts uses Intl, which Deno has.
const SHARED = ['types.ts', 'time.ts', 'marker.ts', 'rules.ts', 'sweep.ts']

const banner = (name) => `// Generated from src/lib/${name}; run npm run sync:shared.\n\n`

const expected = (name) => banner(name) + readFileSync(join(ROOT, 'src', 'lib', name), 'utf8')
const current = (name) => {
  try {
    return readFileSync(join(OUT, name), 'utf8')
  } catch {
    return null
  }
}

if (process.argv[2] === '--check') {
  const stale = SHARED.filter((n) => current(n) !== expected(n))
  if (stale.length) {
    console.error(`shared modules out of date: ${stale.join(', ')}`)
    console.error('run `npm run sync:shared`')
    process.exit(1)
  }
  console.log(`shared modules in sync (${SHARED.length} files)`)
} else {
  mkdirSync(OUT, { recursive: true })
  for (const name of SHARED) writeFileSync(join(OUT, name), expected(name))
  console.log(`synced ${SHARED.length} modules to supabase/functions/_shared`)
}
