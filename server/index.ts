// Fixi-Server: liefert das Frontend (dist/) aus und stellt die API unter /api bereit.
//
//   Entwicklung:  node --watch server/index.ts   (Node >= 22.18 / 23.6, Type-Stripping)
//   Produktion:   yarn build && node dist-server/index.mjs
//   Docker:       siehe Dockerfile und deploy/portainer-stack.yml
import { exec } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { Server } from 'node:http'
import path from 'node:path'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { attachUser } from './auth.ts'
import { config } from './config.ts'
import { initSchema, pool, waitForDb } from './db.ts'
import { ensureSuperadmin } from './repo.ts'
import { api } from './routes.ts'

const app = express()
app.set('trust proxy', config.trustProxy)
app.disable('x-powered-by')

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  next()
})

// ---- API ----
app.use('/api', express.json({ limit: '5mb' }), attachUser, api)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Nicht gefunden' })
})

// ---- Frontend (SPA) ----
const indexHtml = path.join(config.distDir, 'index.html')
if (existsSync(indexHtml)) {
  app.use(
    express.static(config.distDir, {
      index: false,
      setHeaders(res, filePath) {
        // Vite hängt Hashes an die Asset-Namen → dauerhaft cachebar
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
      },
    }),
  )
  // Alle übrigen Pfade (/, /sa, …) → index.html, Routing macht das Frontend
  app.get(/.*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.sendFile(indexHtml)
  })
} else {
  console.warn(
    'Hinweis: dist/index.html fehlt – es läuft nur die API. Für das Frontend "yarn build" ausführen (oder "yarn dev" mit Proxy nutzen).',
  )
  app.get(/.*/, (_req, res) => {
    res
      .status(503)
      .type('text/plain')
      .send('Frontend-Build fehlt. Bitte "yarn build" ausführen. Die API läuft unter /api.')
  })
}

// ---- Fehlerbehandlung ----
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err)
  const e = err as { status?: number; type?: string; message?: string }
  if (e.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'Ungültiges JSON' })
  if (e.type === 'entity.too.large')
    return res.status(413).json({ error: 'Datei zu groß (max. 5 MB)' })
  const status = typeof e.status === 'number' && e.status >= 400 ? e.status : 500
  if (status >= 500) console.error(err)
  res.status(status).json({
    error: status >= 500 ? 'Interner Serverfehler' : (e.message ?? 'Fehler'),
  })
})

// ---- Beenden ----
// Als PID 1 im Container ignoriert Node SIGTERM ohne eigenen Handler. Dann würde
// "docker stop" jedes Mal 10 s warten und den Prozess hart beenden.
let server: Server | null = null
let shuttingDown = false

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} empfangen, Fixi wird beendet…`)
  // Notbremse, falls offene Verbindungen das Beenden blockieren
  setTimeout(() => process.exit(1), 8000).unref()
  const closeDb = () =>
    pool
      .end()
      .catch(() => {})
      .finally(() => process.exit(0))
  if (!server) {
    void closeDb()
    return
  }
  server.close(() => void closeDb())
  server.closeIdleConnections()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

async function main() {
  await waitForDb()
  await initSchema()
  await ensureSuperadmin()

  server = app.listen(config.port, config.host, (err?: Error) => {
    if (err) {
      console.error(`Start fehlgeschlagen: ${err.message}`)
      process.exit(1)
    }
    const url = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}/`
    console.log(`Fixi läuft auf ${url}  (Superadmin: ${url}sa)`)
    if (config.openBrowser && process.platform === 'win32') {
      exec(`start "" "${url}"`)
    }
  })
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message || String(e) : String(e)
  console.error('Start fehlgeschlagen:', msg)
  process.exit(1)
})
