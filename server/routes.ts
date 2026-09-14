// HTTP-API: Login, Fixkostendaten, Superadmin-Verwaltung.
import { Router } from 'express'
import type { Request, Response } from 'express'
import type { AppData } from '../shared/types.ts'
import {
  clearSessionCookie,
  createSession,
  currentUser,
  destroySession,
  dummyHash,
  loginLimiter,
  pruneSessions,
  requireRole,
  setSessionCookie,
  verifyPassword,
} from './auth.ts'
import type { Role } from './auth.ts'
import { pingDb } from './db.ts'
import {
  createUser,
  deleteUser,
  findUserById,
  findUserByUsername,
  getDataVersion,
  listUsers,
  loadUserData,
  NotFoundError,
  replaceUserData,
  setUserPassword,
} from './repo.ts'

export const api = Router()

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/
const MIN_PASSWORD = 8

function str(v: unknown, max = 255): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function body(req: Request): Record<string, unknown> {
  return typeof req.body === 'object' && req.body !== null ? req.body : {}
}

function idParam(req: Request): number | null {
  const n = Number(req.params.id)
  return Number.isInteger(n) && n > 0 ? n : null
}

function isDuplicate(e: unknown): boolean {
  return (e as { code?: string })?.code === 'ER_DUP_ENTRY'
}

// ---------- Healthcheck (Docker) ----------

api.get('/health', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    await pingDb()
    res.json({ ok: true })
  } catch {
    res.status(503).json({ ok: false, error: 'Datenbank nicht erreichbar' })
  }
})

// ---------- Anmeldung ----------

async function handleLogin(req: Request, res: Response, role: Role) {
  const b = body(req)
  const username = str(b.username, 64).trim()
  const password = str(b.password, 1024)
  if (!username || !password)
    return res
      .status(400)
      .json({ error: 'Benutzername und Passwort erforderlich' })

  const key = `${req.ip}|${username.toLowerCase()}`
  if (!loginLimiter.allowed(key))
    return res.status(429).json({
      error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.',
    })

  const user = await findUserByUsername(username)
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : (await verifyPassword(password, await dummyHash()), false)

  if (!ok || !user) {
    loginLimiter.fail(key)
    return res.status(401).json({ error: 'Benutzername oder Passwort falsch' })
  }
  if (user.role !== role) {
    loginLimiter.fail(key)
    return res.status(403).json({
      error:
        role === 'superadmin'
          ? 'Dieser Account ist kein Superadmin.'
          : 'Superadmin bitte unter /sa anmelden.',
    })
  }

  loginLimiter.reset(key)
  const token = await createSession(user.id)
  setSessionCookie(req, res, token)
  void pruneSessions().catch(() => {})
  res.json({ user: { id: user.id, username: user.username, role: user.role } })
}

api.post('/auth/login', (req, res) => handleLogin(req, res, 'user'))
api.post('/sa/login', (req, res) => handleLogin(req, res, 'superadmin'))

api.post('/auth/logout', async (req, res) => {
  const token = res.locals.token as string | null
  if (token) await destroySession(token)
  clearSessionCookie(req, res)
  res.json({ ok: true })
})

api.get('/auth/me', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ user: currentUser(res) })
})

// ---------- Fixkostendaten des angemeldeten Benutzers ----------

const user = requireRole('user')

api.get('/data', user, async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json(await loadUserData(currentUser(res)!.id))
})

api.get('/data/version', user, async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const version = await getDataVersion(currentUser(res)!.id)
  if (version === null) return res.status(404).json({ error: 'Benutzer nicht gefunden' })
  res.json({ version })
})

api.put('/data', user, async (req, res) => {
  const data = body(req).data
  if (typeof data !== 'object' || data === null)
    return res.status(400).json({ error: 'Feld "data" fehlt' })
  const version = await replaceUserData(
    currentUser(res)!.id,
    data as Partial<AppData>,
  )
  res.json({ version })
})

// ---------- Superadmin ----------

const sa = requireRole('superadmin')

api.get('/sa/users', sa, async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ users: await listUsers() })
})

api.post('/sa/users', sa, async (req, res) => {
  const b = body(req)
  const username = str(b.username, 64).trim()
  const password = str(b.password, 1024)
  if (!USERNAME_RE.test(username))
    return res.status(400).json({
      error:
        'Benutzername: 3–32 Zeichen, nur Buchstaben, Ziffern, Punkt, Minus, Unterstrich.',
    })
  if (password.length < MIN_PASSWORD)
    return res
      .status(400)
      .json({ error: `Passwort: mindestens ${MIN_PASSWORD} Zeichen.` })
  try {
    const id = await createUser(username, password, 'user')
    res.status(201).json({ user: { id, username } })
  } catch (e) {
    if (isDuplicate(e))
      return res.status(409).json({ error: 'Benutzername ist bereits vergeben.' })
    throw e
  }
})

api.delete('/sa/users/:id', sa, async (req, res) => {
  const id = idParam(req)
  if (id === null) return res.status(400).json({ error: 'Ungültige ID' })
  if (!(await deleteUser(id)))
    return res.status(404).json({ error: 'Benutzer nicht gefunden' })
  res.json({ ok: true })
})

api.put('/sa/users/:id/password', sa, async (req, res) => {
  const id = idParam(req)
  if (id === null) return res.status(400).json({ error: 'Ungültige ID' })
  const password = str(body(req).password, 1024)
  if (password.length < MIN_PASSWORD)
    return res
      .status(400)
      .json({ error: `Passwort: mindestens ${MIN_PASSWORD} Zeichen.` })
  const target = await findUserById(id)
  if (!target || target.role !== 'user')
    return res.status(404).json({ error: 'Benutzer nicht gefunden' })
  await setUserPassword(id, password)
  res.json({ ok: true })
})

api.get('/sa/users/:id/data', sa, async (req, res) => {
  const id = idParam(req)
  if (id === null) return res.status(400).json({ error: 'Ungültige ID' })
  const target = await findUserById(id)
  if (!target || target.role !== 'user')
    return res.status(404).json({ error: 'Benutzer nicht gefunden' })
  res.setHeader('Cache-Control', 'no-store')
  res.json({ username: target.username, ...(await loadUserData(id)) })
})

api.put('/sa/users/:id/data', sa, async (req, res) => {
  const id = idParam(req)
  if (id === null) return res.status(400).json({ error: 'Ungültige ID' })
  const data = body(req).data
  if (typeof data !== 'object' || data === null)
    return res.status(400).json({ error: 'Feld "data" fehlt' })
  const target = await findUserById(id)
  if (!target || target.role !== 'user')
    return res.status(404).json({ error: 'Benutzer nicht gefunden' })
  const version = await replaceUserData(id, data as Partial<AppData>)
  res.json({ version })
})

// ---------- Fehler aus dem Repo ----------

api.use(
  (err: unknown, _req: Request, res: Response, next: (e?: unknown) => void) => {
    if (err instanceof NotFoundError)
      return res.status(404).json({ error: err.message })
    next(err)
  },
)
