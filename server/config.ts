// Konfiguration aus Umgebungsvariablen / .env (siehe .env.example).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

// Projektwurzel: sowohl aus server/ (Quelle) als auch aus dist-server/ (Bundle)
// liegt sie eine Ebene höher.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true })

const missing: string[] = []

function env(name: string): string | undefined {
  const v = process.env[name]
  return v === undefined || v === '' ? undefined : v
}

function required(name: string): string {
  const v = env(name)
  if (v === undefined) missing.push(name)
  return v ?? ''
}

function intEnv(name: string, fallback: number): number {
  const v = env(name)
  if (v === undefined) return fallback
  const n = Number(v)
  if (!Number.isFinite(n)) {
    console.error(`Ungültiger Wert für ${name}: "${v}"`)
    process.exit(1)
  }
  return n
}

/** Express "trust proxy": false | true | Anzahl Hops | Liste von IPs/Subnetzen */
function parseTrustProxy(v: string | undefined): boolean | number | string {
  if (v === undefined) return 1
  if (v === 'false') return false
  if (v === 'true') return true
  if (/^\d+$/.test(v)) return Number(v)
  return v
}

/** COOKIE_SECURE: auto (nach req.secure, Standard) | true | false */
function parseCookieSecure(v: string | undefined): 'auto' | boolean {
  if (v === undefined || v === 'auto') return 'auto'
  return v === 'true' || v === '1'
}

export const config = {
  root: ROOT,
  distDir: path.join(ROOT, 'dist'),
  host: env('HOST') ?? '127.0.0.1',
  port: intEnv('PORT', 5174),
  trustProxy: parseTrustProxy(env('TRUST_PROXY')),
  cookieSecure: parseCookieSecure(env('COOKIE_SECURE')),
  sessionTtlDays: intEnv('SESSION_TTL_DAYS', 30),
  openBrowser: env('OPEN_BROWSER') === '1',
  db: {
    host: env('DB_HOST') ?? '127.0.0.1',
    port: intEnv('DB_PORT', 3306),
    user: required('DB_USER'),
    password: env('DB_PASSWORD') ?? '',
    database: required('DB_NAME'),
  },
  sa: {
    username: required('SA_USERNAME'),
    password: required('SA_PASSWORD'),
  },
}

if (missing.length) {
  console.error(
    `Fehlende Umgebungsvariablen: ${missing.join(', ')}\n` +
      `Bitte eine .env im Projektordner anlegen (Vorlage: .env.example).`,
  )
  process.exit(1)
}
