// Browser-seitige Hilfen für Export/Import. Die Normalisierung (sanitize) und
// die Defaults liegen in shared/ und werden auch vom Server benutzt.
import { parse, serialize } from '../shared/sanitize.ts'
import { AppData } from './types'

export {
  DEFAULT_METAS,
  emptyData,
  parse,
  sanitize,
  serialize,
  uid,
} from '../shared/sanitize.ts'

/** Sicherungskopie als JSON-Datei herunterladen (Export). */
export function downloadJson(data: AppData, filename?: string) {
  const blob = new Blob([serialize(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const ts = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = filename ?? `fixi-${ts}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** JSON-Datei lesen und auf das aktuelle Schema normalisieren (Import). */
export function readFileAsJson(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      try {
        resolve(parse(String(r.result)))
      } catch (e) {
        reject(e)
      }
    }
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
}
