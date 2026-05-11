// Mini-Server ohne externe Abhängigkeiten – serviert dist/ unter http://localhost:5174
// und öffnet automatisch den Browser. Wird von "Fixi starten.bat" aufgerufen.
import { exec } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, 'dist')
const PORT = 5174

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

if (!fs.existsSync(ROOT)) {
  console.error(
    'Fehler: Ordner "dist" nicht gefunden. Bitte zuerst "npm run build" ausführen.',
  )
  process.exit(1)
}

const server = http.createServer((req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0])
    let rel = url === '/' ? '/index.html' : url
    const filePath = path.join(ROOT, rel)
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      // SPA-Fallback
      const fallback = path.join(ROOT, 'index.html')
      const data = fs.readFileSync(fallback)
      res.writeHead(200, { 'Content-Type': MIME['.html'] })
      res.end(data)
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
    })
    fs.createReadStream(filePath).pipe(res)
  } catch (e) {
    res.writeHead(500)
    res.end(String(e))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}/`
  console.log(`Fixi läuft auf ${url}`)
  console.log('Zum Beenden dieses Fenster schließen.')
  // Browser öffnen (Windows)
  exec(`start "" "${url}"`)
})
