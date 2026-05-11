import fs from 'fs'
import XLSX from 'xlsx'

const wb = XLSX.readFile('Fixkosten.xlsx')
const ws = wb.Sheets['Fixkosten']
const rows = XLSX.utils.sheet_to_json(ws, {
  header: 1,
  defval: null,
  raw: true,
})
// print all non-null cells as "[r,c]=value"
for (let r = 0; r < rows.length; r++) {
  for (let c = 0; c < rows[r].length; c++) {
    const v = rows[r][c]
    if (v !== null && v !== '' && v !== undefined) {
      fs.appendFileSync('cells.txt', `[${r},${c}]=${JSON.stringify(v)}\n`)
    }
  }
}
