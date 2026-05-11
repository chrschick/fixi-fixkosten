import { Item, Turnus } from './types'

export const TURNUS_LABEL: Record<Turnus, string> = {
  monthly: 'Monatlich',
  quarterly: 'Quartal',
  'half-yearly': 'Halbjährlich',
  yearly: 'Jährlich',
}

export const TURNUS_MONTHS: Record<Turnus, number> = {
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  yearly: 12,
}

/** Auf ganzen Euro aufrunden. */
export function monthlyAmount(item: Pick<Item, 'amount' | 'turnus'>): number {
  const divisor = TURNUS_MONTHS[item.turnus]
  return Math.ceil(item.amount / divisor)
}

export function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function clampDay(day: number, year: number, month: number): number {
  const last = new Date(year, month, 0).getDate()
  return Math.min(Math.max(1, day), last)
}

/**
 * Nächster Stichtag basierend auf Turnus.
 * - monthly: nächster Tag im aktuellen oder nächsten Monat
 * - quarterly: alle 3 Monate ab (month), nächste Wiederholung in der Zukunft
 * - half-yearly: alle 6 Monate ab (month)
 * - yearly: nächster (day,month) ab heute
 */
export function nextDueDate(
  item: Pick<Item, 'turnus' | 'day' | 'month'>,
  today = new Date(),
): Date {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (item.turnus === 'monthly') {
    let y = t.getFullYear()
    let m = t.getMonth() + 1 // 1..12
    let d = clampDay(item.day, y, m)
    let candidate = new Date(y, m - 1, d)
    if (candidate < t) {
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
      d = clampDay(item.day, y, m)
      candidate = new Date(y, m - 1, d)
    }
    return candidate
  }

  const step = TURNUS_MONTHS[item.turnus] // 3,6,12
  const baseMonth = item.month // 1..12
  // erzeuge Kandidaten dieses und nächstes Jahr in step-Schritten
  const candidates: Date[] = []
  for (const y of [t.getFullYear() - 1, t.getFullYear(), t.getFullYear() + 1]) {
    for (let m = baseMonth; m <= 12 + baseMonth; m += step) {
      const mm = ((m - 1) % 12) + 1
      const yy = y + Math.floor((m - 1) / 12)
      const d = clampDay(item.day, yy, mm)
      candidates.push(new Date(yy, mm - 1, d))
    }
  }
  candidates.sort((a, b) => a.getTime() - b.getTime())
  const future = candidates.find((c) => c >= t)
  return future ?? candidates[candidates.length - 1]
}

export function formatDateDE(d: Date): string {
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function turnusSummary(
  item: Pick<Item, 'turnus' | 'day' | 'month'>,
): string {
  if (item.turnus === 'monthly')
    return `${TURNUS_LABEL.monthly} · am ${item.day}.`
  return `${TURNUS_LABEL[item.turnus]} · ${item.day}.${item.month}.`
}
