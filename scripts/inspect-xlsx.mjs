// Liest Fixkosten.xlsx und schreibt alle Sheets als JSON in xlsx-out.json.
import fs from 'fs'
import XLSX from 'xlsx'

const wb = XLSX.readFile('Fixkosten.xlsx')
const out = {}
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  out[name] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  })
}
fs.writeFileSync('xlsx-out.json', JSON.stringify(out, null, 2))
