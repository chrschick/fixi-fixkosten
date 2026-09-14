// Passwort-Hashing (scrypt), Sessions (Cookie + Tabelle), Middleware, Login-Limiter.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import type { RowDataPacket } from 'mysql2/promise'
import { config } from './config.ts'
import { pool } from './db.ts'

export type Role = 'user' | 'superadmin'

export interface SessionUser {
  id: number
  username: string
  role: Role
}

// ---------- Passwörter ----------

const SCRYPT_KEYLEN = 64
const SCRYPT_COST = 16384 // N

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  cost: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, { N: cost }, (err, key) =>
      err ? reject(err) : resolve(key),
    )
  })
}

/** Format: scrypt$<N>$<salt b64>$<key b64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_COST)
  return `scrypt$${SCRYPT_COST}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algo, costStr, saltB64, keyB64] = stored.split('$')
  if (algo !== 'scrypt' || !costStr || !saltB64 || !keyB64) return false
  const cost = Number(costStr)
  if (!Number.isInteger(cost) || cost < 2) return false
  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(keyB64, 'base64')
  const actual = await scryptAsync(password, salt, expected.length, cost)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// Wird bei unbekanntem Benutzernamen geprüft, damit die Antwortzeit nicht
// verrät, ob der Benutzer existiert.
let dummyHashPromise: Promise<string> | null = null
export function dummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(randomBytes(12).toString('hex'))
  return dummyHashPromise
}

// ---------- Sessions ----------

const COOKIE_NAME = 'fixi_sid'
const TOKEN_RE = /^[a-f0-9]{64}$/

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await pool.query(
    'INSERT INTO `sessions` (`token`, `user_id`, `expires_at`) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
    [token, userId, config.sessionTtlDays],
  )
  return token
}

export async function destroySession(token: string): Promise<void> {
  await pool.query('DELETE FROM `sessions` WHERE `token` = ?', [token])
}

export async function destroyUserSessions(userId: number): Promise<void> {
  await pool.query('DELETE FROM `sessions` WHERE `user_id` = ?', [userId])
}

export async function pruneSessions(): Promise<void> {
  await pool.query('DELETE FROM `sessions` WHERE `expires_at` < NOW()')
}

export async function findSessionUser(
  token: string,
): Promise<SessionUser | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.username, u.role
       FROM \`sessions\` s
       JOIN \`users\` u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > NOW()`,
    [token],
  )
  const row = rows[0]
  if (!row) return null
  return { id: Number(row.id), username: String(row.username), role: row.role }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

export function readSessionToken(req: Request): string | null {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME]
  return token && TOKEN_RE.test(token) ? token : null
}

function cookieSecure(req: Request): boolean {
  return config.cookieSecure === 'auto' ? req.secure : config.cookieSecure
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(req),
    path: '/',
    maxAge: config.sessionTtlDays * 24 * 60 * 60 * 1000,
  })
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(req),
    path: '/',
  })
}

// ---------- Middleware ----------

export function currentUser(res: Response): SessionUser | null {
  return (res.locals.user as SessionUser | null | undefined) ?? null
}

/** Liest das Session-Cookie und hängt den Benutzer an res.locals. */
export async function attachUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = readSessionToken(req)
  res.locals.token = token
  res.locals.user = token ? await findSessionUser(token) : null
  next()
}

export function requireRole(role: Role) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = currentUser(res)
    if (!user) return res.status(401).json({ error: 'Nicht angemeldet' })
    if (user.role !== role)
      return res.status(403).json({ error: 'Keine Berechtigung' })
    next()
  }
}

// ---------- Login-Limiter (im Speicher, pro IP + Benutzername) ----------

interface Attempts {
  count: number
  windowStart: number
}

export class LoginLimiter {
  private readonly attempts = new Map<string, Attempts>()
  private readonly max: number
  private readonly windowMs: number

  // Keine Parameter-Properties: Node führt die .ts-Dateien per Type-Stripping
  // direkt aus und unterstützt nur "erasable" Syntax.
  constructor(max: number, windowMs: number) {
    this.max = max
    this.windowMs = windowMs
  }

  allowed(key: string): boolean {
    const a = this.attempts.get(key)
    if (!a) return true
    if (Date.now() - a.windowStart > this.windowMs) {
      this.attempts.delete(key)
      return true
    }
    return a.count < this.max
  }

  fail(key: string): void {
    const now = Date.now()
    const a = this.attempts.get(key)
    if (!a || now - a.windowStart > this.windowMs) {
      this.attempts.set(key, { count: 1, windowStart: now })
    } else {
      a.count += 1
    }
    if (this.attempts.size > 5000) this.prune()
  }

  reset(key: string): void {
    this.attempts.delete(key)
  }

  private prune(): void {
    const now = Date.now()
    for (const [k, a] of this.attempts) {
      if (now - a.windowStart > this.windowMs) this.attempts.delete(k)
    }
  }
}

export const loginLimiter = new LoginLimiter(10, 15 * 60 * 1000)
