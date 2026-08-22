/**
 * Copy the shared reminder-email module from lib/ into functions/src/.
 *
 * Why a copy rather than an import: the app and the functions are separate
 * TypeScript projects with separate node_modules. The app cannot import from
 * functions/src (its tsconfig excludes `functions`, and removing that exclusion
 * makes `next build` typecheck the functions sources, which fail in CI where
 * functions/node_modules is never installed). A function cannot import from
 * ../lib either, because it deploys from its own directory and widening its
 * tsconfig to reach outside moves the whole build output.
 *
 * So: lib/ holds the canonical file, and this script regenerates the functions
 * copy. It runs from the functions predeploy hook, so a deploy can never ship a
 * stale template, and `--check` fails the build if the copy has drifted.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(root, 'lib', 'summerReminderEmail.ts')
const TARGET = join(root, 'functions', 'src', 'summerReminderEmail.ts')

const BANNER = `// GENERATED FILE - DO NOT EDIT.
// Copied from lib/summerReminderEmail.ts by scripts/sync-shared-email.mjs.
// Edit the original in lib/ and run: node scripts/sync-shared-email.mjs
`

const source = readFileSync(SOURCE, 'utf8')
const expected = BANNER + source

const check = process.argv.includes('--check')
let current = ''
try {
  current = readFileSync(TARGET, 'utf8')
} catch {
  // Missing target is a normal first run.
}

if (current === expected) {
  console.log('[sync-shared-email] functions copy is up to date')
  process.exit(0)
}

if (check) {
  console.error(
    '[sync-shared-email] functions/src/summerReminderEmail.ts is out of date.\n' +
      'Run: node scripts/sync-shared-email.mjs'
  )
  process.exit(1)
}

writeFileSync(TARGET, expected)
console.log('[sync-shared-email] regenerated functions/src/summerReminderEmail.ts')
