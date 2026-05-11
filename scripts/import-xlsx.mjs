/* eslint-disable */
// Konvertiert Fixkosten.xlsx -> fixi.json (Schema v3)
import fs from 'fs'
import XLSX from 'xlsx'

const SONSTIGES_ID = 'cat-sonstiges'
const META_SONSTIGES_ID = 'meta-sonstiges'

const META = {
  haus: { id: 'meta-haus', name: 'Haus', icon: 'Home', color: '#3b82f6' },
  freizeit: {
    id: 'meta-freizeit',
    name: 'Freizeit',
    icon: 'PartyPopper',
    color: '#a855f7',
  },
  versicherungen: {
    id: 'meta-versicherungen',
    name: 'Versicherungen',
    icon: 'ShieldCheck',
    color: '#f59e0b',
  },
  variable: {
    id: 'meta-variable',
    name: 'Variable Kosten',
    icon: 'Wallet',
    color: '#ef4444',
  },
  malte: { id: 'meta-malte', name: 'Malte', icon: 'Baby', color: '#10b981' },
  balu: { id: 'meta-balu', name: 'Balu', icon: 'Dog', color: '#f97316' },
  sonstiges: {
    id: META_SONSTIGES_ID,
    name: 'Sonstiges',
    icon: 'Package',
    color: '#64748b',
  },
}

const CATS = [
  { id: SONSTIGES_ID, name: 'Sonstiges', icon: 'Package', color: '#64748b' },
  { id: 'cat-wohnen', name: 'Wohnen', icon: 'Home', color: '#3b82f6' },
  { id: 'cat-mobilitaet', name: 'Mobilität', icon: 'Car', color: '#10b981' },
  {
    id: 'cat-versicherung',
    name: 'Versicherung',
    icon: 'ShieldCheck',
    color: '#f59e0b',
  },
  { id: 'cat-abos', name: 'Abos', icon: 'Repeat', color: '#a855f7' },
  {
    id: 'cat-kommunikation',
    name: 'Kommunikation',
    icon: 'Smartphone',
    color: '#0ea5e9',
  },
  { id: 'cat-haustier', name: 'Haustier', icon: 'Dog', color: '#f97316' },
  { id: 'cat-kind', name: 'Kind', icon: 'Baby', color: '#10b981' },
  { id: 'cat-finanzen', name: 'Finanzen', icon: 'PiggyBank', color: '#22c55e' },
  { id: 'cat-energie', name: 'Energie', icon: 'Zap', color: '#eab308' },
]

/** Heuristik: ordnet einen Item-Namen einer Subkategorie zu. */
function pickCat(metaKey, name) {
  const n = name.toLowerCase()
  if (metaKey === 'haus') {
    if (/(strom|wasser|abwasser|gez|m\u00fcll|grundsteuer|heizung)/.test(n))
      return 'cat-energie'
    if (/(kredit|bausparer|darlehen)/.test(n)) return 'cat-finanzen'
    return 'cat-wohnen'
  }
  if (metaKey === 'versicherungen') {
    if (/(rente|ansparen|axa)/.test(n)) return 'cat-finanzen'
    return 'cat-versicherung'
  }
  if (metaKey === 'variable') {
    if (/(tanken|kfz|ace|pannen)/.test(n)) return 'cat-mobilitaet'
    return SONSTIGES_ID
  }
  if (metaKey === 'malte') {
    if (/(ansparen)/.test(n)) return 'cat-finanzen'
    return 'cat-kind'
  }
  if (metaKey === 'balu') {
    return 'cat-haustier'
  }
  if (metaKey === 'freizeit') {
    if (
      /(internet|spotify|o2|handy|icloud|apple|office|1password|netflix|wow|prime|appletv|brillen|cookidoo|girocard|podimo|grafikkarte|wow)/.test(
        n,
      )
    )
      return 'cat-abos'
    if (/(o2|handy|internet)/.test(n)) return 'cat-kommunikation'
    return 'cat-abos'
  }
  return SONSTIGES_ID
}

function parseTurnus(raw) {
  if (!raw) return { turnus: 'monthly', day: 1, month: 1 }
  const s = String(raw).trim()
  // erwartet z. B. "Monat/21.", "Jahr/1.7.", "Quartal/15.", "Monat", "Jahr"
  const [head, tail] = s.split('/').map((x) => (x ?? '').trim())
  let turnus = 'monthly'
  if (/jahr/i.test(head)) turnus = 'yearly'
  else if (/halb/i.test(head)) turnus = 'half-yearly'
  else if (/quartal/i.test(head)) turnus = 'quarterly'
  else if (/monat/i.test(head)) turnus = 'monthly'
  let day = 1
  let month = 1
  if (tail) {
    // "21.", "1.7.", "9.9", "2.1"
    const cleaned = tail.replace(/\s/g, '').replace(/\.$/, '')
    const parts = cleaned.split('.').filter(Boolean)
    if (parts.length >= 1) day = Number(parts[0]) || 1
    if (parts.length >= 2) month = Number(parts[1]) || 1
  }
  return { turnus, day, month }
}

const SUMMARY_KEYS = new Set([
  'monatlicher betrag',
  'wegsparen im monat',
  'gesamt',
])

function isSummaryRow(name) {
  if (!name) return true
  return SUMMARY_KEYS.has(String(name).trim().toLowerCase())
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Liest einen Block ab Header-Zeile (header in row hdr, Spalte col).
 *  Block reicht bis zur ersten Zusammenfassungs-/Leerzeile.
 *  Erwartet 5 Spalten: Dienst | Turnus | Betrag | Betrag monatlich | Info
 */
function readBlock(rows, hdr, col, metaKey, items) {
  for (let r = hdr + 1; r < rows.length; r++) {
    const name = rows[r]?.[col]
    if (name === null || name === undefined || name === '') {
      // Leerzeile -> Block-Ende
      // aber: Block könnte unten weitere Werte haben (Summenzeilen)
      // Wir checken die nächste Zeile: wenn die auch leer in dieser Spalte ist, abbrechen
      const next = rows[r + 1]?.[col]
      if (!next) break
      continue
    }
    if (isSummaryRow(name)) continue
    const turnusStr = rows[r]?.[col + 1]
    const betrag = rows[r]?.[col + 2]
    const info = rows[r]?.[col + 4] ?? ''
    if (betrag === null || betrag === undefined || betrag === '') continue
    const { turnus, day, month } = parseTurnus(turnusStr)
    items.push({
      id: uid('itm'),
      name: String(name).trim(),
      turnus,
      day,
      month,
      amount: Math.round(Number(betrag) * 100) / 100,
      info: info ? String(info).trim() : '',
      metaCategoryId: META[metaKey].id,
      categoryId: pickCat(metaKey, String(name)),
    })
  }
}

const wb = XLSX.readFile('Fixkosten.xlsx')
const ws = wb.Sheets['Fixkosten']
const rows = XLSX.utils.sheet_to_json(ws, {
  header: 1,
  defval: null,
  raw: true,
})

const items = []

// --- Sektionen anhand der Header-Zellen lokalisieren ---
// "<Section name>" befindet sich genau eine Zeile über der Header-Zeile (Dienst|Turnus|Betrag|...).
const sectionMap = {
  'Freizeit & Sport': 'freizeit',
  Haus: 'haus',
  Hund: 'balu',
  Versicherungen: 'versicherungen',
  'Variable Kosten': 'variable',
  Malte: 'malte',
}

for (let r = 0; r < rows.length; r++) {
  for (let c = 0; c < (rows[r]?.length ?? 0); c++) {
    const cell = rows[r][c]
    if (typeof cell !== 'string') continue
    const metaKey = sectionMap[cell.trim()]
    if (!metaKey) continue
    // Header sollte in der nächsten Zeile, gleicher Spalte beginnen
    const hdr = r + 1
    const headerCell = rows[hdr]?.[c]
    if (typeof headerCell === 'string' && /dienst/i.test(headerCell)) {
      readBlock(rows, hdr, c, metaKey, items)
    }
  }
}

// --- Einkommen aus Spalte 12-14, Zeilen 9-13 ---
const incomes = []
for (let r = 9; r <= 13; r++) {
  const name = rows[r]?.[12]
  const amount = rows[r]?.[14]
  if (!name || !amount) continue
  incomes.push({
    id: uid('inc'),
    name: String(name).trim(),
    day: 1,
    amount: Math.round(Number(amount) * 100) / 100,
    info: '',
  })
}

const data = {
  version: 3,
  metaCategories: [
    META.haus,
    META.freizeit,
    META.versicherungen,
    META.variable,
    META.malte,
    META.balu,
    META.sonstiges,
  ],
  categories: CATS,
  items,
  incomes,
}

fs.writeFileSync('fixi.json', JSON.stringify(data, null, 2))

// Summen-Check
const monthly = items
  .filter((i) => i.turnus === 'monthly')
  .reduce((a, i) => a + i.amount, 0)
const saving = items
  .filter((i) => i.turnus !== 'monthly')
  .reduce((a, i) => {
    const m = { monthly: 1, quarterly: 3, 'half-yearly': 6, yearly: 12 }[
      i.turnus
    ]
    return a + i.amount / m
  }, 0)
const income = incomes.reduce((a, i) => a + i.amount, 0)
console.log('Items:', items.length)
console.log('Einkommen:', incomes.length, '=', income.toFixed(2))
console.log('Summe monatlich (Monat-Items):', monthly.toFixed(2))
console.log('Summe wegsparen / Monat:', saving.toFixed(2))
