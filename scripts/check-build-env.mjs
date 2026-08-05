#!/usr/bin/env node
/**
 * Guard the values a production build bakes into the browser bundle.
 *
 * Why this exists: NEXT_PUBLIC_* values are read at build time. A local
 * .env.local only affects local builds; CI reads GitHub secrets. When those two
 * drift, the build still succeeds and the wrong value ships silently. That is
 * how a test Stripe key reached the live checkout while the server held a live
 * secret key, so no customer could actually pay.
 *
 * The failure mode is always the same: a value that is absent, empty, or from
 * the wrong environment produces a working build and a broken site. So this
 * runs before every production build and fails loudly instead.
 *
 * Run with --report to list what is set without failing, useful locally.
 */

const REPORT_ONLY = process.argv.includes('--report')

/**
 * Every NEXT_PUBLIC_* value the app reads, and what a valid one looks like.
 * `required` false means the feature degrades gracefully without it.
 */
const CHECKS = [
  {
    name: 'NEXT_PUBLIC_FIREBASE_API_KEY',
    required: true,
    valid: (v) => /^AIza[0-9A-Za-z_-]{30,}$/.test(v),
    expected: 'starts with AIza'
  },
  {
    name: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    required: true,
    valid: (v) => /\.firebaseapp\.com$/.test(v),
    expected: 'ends with .firebaseapp.com'
  },
  {
    name: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    required: true,
    valid: (v) => v === 'eduvatekids-store',
    expected: 'eduvatekids-store (the production project)'
  },
  {
    name: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    required: true,
    valid: (v) => /\.(appspot\.com|firebasestorage\.app)$/.test(v),
    expected: 'ends with .appspot.com or .firebasestorage.app'
  },
  {
    name: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    required: true,
    valid: (v) => /^\d{6,}$/.test(v),
    expected: 'numeric sender id'
  },
  {
    name: 'NEXT_PUBLIC_FIREBASE_APP_ID',
    required: true,
    valid: (v) => /^\d+:\d+:web:[0-9a-f]+$/.test(v),
    expected: 'looks like 1:123:web:abc'
  },
  {
    name: 'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
    required: true,
    valid: (v) => /^G-[A-Z0-9]{6,}$/.test(v),
    // Without this, analytics silently records nothing at all.
    expected: 'starts with G- (GA4 measurement id)'
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: true,
    valid: (v) => v.startsWith('pk_live_'),
    expected: 'a LIVE publishable key (pk_live_). A pk_test_ key means customers cannot pay.'
  },
  {
    name: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
    required: false,
    valid: (v) => /^AIza[0-9A-Za-z_-]{30,}$/.test(v),
    expected: 'starts with AIza (address autocomplete is disabled without it)'
  },
  {
    name: 'NEXT_PUBLIC_PAYPAL_CLIENT_ID',
    required: false,
    // PayPal is deferred (see functions/src/config.ts). Declared so the
    // workflow passing it is not mistaken for it being wired up.
    valid: () => true,
    expected: 'not in use yet; PayPal is deferred'
  }
]

const problems = []
const notes = []
const ok = []

for (const check of CHECKS) {
  const raw = process.env[check.name]
  const value = typeof raw === 'string' ? raw.trim() : ''

  if (!value) {
    if (check.required) problems.push(`${check.name} is not set. Expected: ${check.expected}`)
    else notes.push(`${check.name} is not set (optional): ${check.expected}`)
    continue
  }
  if (!check.valid(value)) {
    const masked = value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : '(short value)'
    const line = `${check.name} looks wrong: got ${masked}. Expected: ${check.expected}`
    if (check.required) problems.push(line)
    else notes.push(line)
    continue
  }
  ok.push(check.name)
}

const bullet = (s) => `  - ${s}`

if (REPORT_ONLY) {
  console.log('Build environment report\n')
  console.log(`Valid (${ok.length}):`)
  ok.forEach((n) => console.log(bullet(n)))
  if (notes.length) {
    console.log(`\nOptional or unused (${notes.length}):`)
    notes.forEach((n) => console.log(bullet(n)))
  }
  if (problems.length) {
    console.log(`\nWould FAIL a production build (${problems.length}):`)
    problems.forEach((p) => console.log(bullet(p)))
  }
  process.exit(0)
}

notes.forEach((n) => console.log(`note: ${n}`))

if (problems.length) {
  console.error('\nProduction build blocked: the values baked into the browser bundle are wrong.\n')
  problems.forEach((p) => {
    console.error(bullet(p))
    // GitHub Actions surfaces this as an annotation on the run.
    if (process.env.GITHUB_ACTIONS) console.error(`::error::${p}`)
  })
  console.error(
    '\nThese come from GitHub repository secrets when CI builds, not from your\n' +
      'local .env.local. Update them under Settings > Secrets and variables >\n' +
      'Actions, then re-run.\n'
  )
  process.exit(1)
}

console.log(`Build environment OK (${ok.length} values checked).`)
