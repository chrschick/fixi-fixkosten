import { useMemo, useState } from 'react'
import { AppData, Item } from '../types'
import {
  TURNUS_LABEL,
  TURNUS_MONTHS,
  clampDay,
  formatDateDE,
  formatEUR,
} from '../utils'
import { Icon } from './IconPicker'
import { metaSoftBg } from './metaColors'

interface Props {
  data: AppData
}

interface Due {
  item: Item
  date: Date
}

interface MonthGroup {
  label: string
  entries: Due[]
  total: number
}

const MONTHS_AHEAD = 3

function dueInMonth(item: Item, year: number, month1: number): Date | null {
  // month1: 1..12
  if (item.turnus === 'monthly') {
    return new Date(year, month1 - 1, clampDay(item.day, year, month1))
  }
  const step = TURNUS_MONTHS[item.turnus] // 3 / 6 / 12
  const diff = (((month1 - item.month) % step) + step) % step
  if (diff !== 0) return null
  return new Date(year, month1 - 1, clampDay(item.day, year, month1))
}

export function Upcoming({ data }: Props) {
  const [includeMonthly, setIncludeMonthly] = useState(true)

  const groups = useMemo<MonthGroup[]>(() => {
    const today = new Date()
    const result: MonthGroup[] = []
    for (let i = 0; i < MONTHS_AHEAD; i++) {
      const firstOfMonth = new Date(
        today.getFullYear(),
        today.getMonth() + i,
        1,
      )
      const y = firstOfMonth.getFullYear()
      const m = firstOfMonth.getMonth() + 1
      const entries: Due[] = []
      for (const it of data.items) {
        if (!includeMonthly && it.turnus === 'monthly') continue
        const d = dueInMonth(it, y, m)
        if (!d) continue
        // im laufenden Monat nur ab heute? Nein – user will den ganzen Monat sehen
        entries.push({ item: it, date: d })
      }
      entries.sort((a, b) => a.date.getTime() - b.date.getTime())
      result.push({
        label: firstOfMonth.toLocaleDateString('de-DE', {
          month: 'long',
          year: 'numeric',
        }),
        entries,
        total: entries.reduce((a, x) => a + x.item.amount, 0),
      })
    }
    return result
  }, [data, includeMonthly])

  return (
    <section className='upcoming'>
      <div className='upcoming-toolbar'>
        <label className='upcoming-toggle'>
          <input
            type='checkbox'
            checked={includeMonthly}
            onChange={(e) => setIncludeMonthly(e.target.checked)}
          />
          <span>Monatliche Umsätze einbeziehen</span>
        </label>
      </div>
      {groups.map((g, i) => (
        <DueGroup
          key={i}
          title={
            i === 0
              ? `Diesen Monat (${g.label})`
              : i === 1
                ? `Nächsten Monat (${g.label})`
                : `In ${i} Monaten (${g.label})`
          }
          data={data}
          entries={g.entries}
          total={g.total}
        />
      ))}
    </section>
  )
}

interface GroupProps {
  title: string
  data: AppData
  entries: Due[]
  total: number
}

function DueGroup({ title, data, entries, total }: GroupProps) {
  return (
    <div className='upcoming-group'>
      <header className='upcoming-head'>
        <h2>{title}</h2>
        <div className='upcoming-total'>
          <span className='muted'>Gesamt:</span>{' '}
          <strong>{formatEUR(total)}</strong>{' '}
          <span className='muted small'>({entries.length} Einträge)</span>
        </div>
      </header>
      {entries.length === 0 ? (
        <p className='muted'>Keine Umsätze in diesem Zeitraum.</p>
      ) : (
        <div className='table-wrap'>
          <table className='items-table'>
            <thead>
              <tr>
                <th>Stichtag</th>
                <th>Name</th>
                <th className='th-num'>Betrag</th>
                <th>Turnus</th>
                <th>Hauptkategorie</th>
                <th>Subkategorie</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ item, date }) => {
                const meta = data.metaCategories.find(
                  (m) => m.id === item.metaCategoryId,
                )
                const cat = data.categories.find(
                  (c) => c.id === item.categoryId,
                )
                return (
                  <tr key={item.id}>
                    <td>{formatDateDE(date)}</td>
                    <td>
                      {item.name || <em className='muted'>(ohne Name)</em>}
                    </td>
                    <td className='td-num'>
                      <strong>{formatEUR(item.amount)}</strong>
                    </td>
                    <td>{TURNUS_LABEL[item.turnus]}</td>
                    <td>
                      {meta && (
                        <span
                          className='meta-pill'
                          style={{
                            background: metaSoftBg(meta.color),
                            color: meta.color,
                          }}
                        >
                          <Icon name={meta.icon} size={14} />
                          {meta.name}
                        </span>
                      )}
                    </td>
                    <td>
                      {cat && (
                        <span className='cat-pill'>
                          <span
                            className='cat-badge'
                            style={{ background: cat.color }}
                          >
                            <Icon name={cat.icon} size={12} color='#fff' />
                          </span>
                          {cat.name}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
