// Normalisiert beliebige (importierte / gespeicherte) Daten auf das aktuelle
// AppData-Schema (v3). Läuft im Browser (Import, Anzeige) und auf dem Server
// (vor jedem Schreiben in die Datenbank).
import type {
  AppData,
  Category,
  Income,
  Item,
  MetaCategory,
  Turnus,
} from './types.ts'
import {
  DEFAULT_DATA,
  DEFAULT_META_CATEGORIES,
  META_SONSTIGES_ID,
  SONSTIGES_ID,
} from './types.ts'

export const DATA_VERSION = 3
export const TURNI: readonly Turnus[] = [
  'monthly',
  'quarterly',
  'half-yearly',
  'yearly',
]

// Längenlimits – passend zu den Spalten in der Datenbank
export const LIMITS = {
  id: 64,
  name: 255,
  icon: 64,
  color: 32,
  info: 5000,
} as const

// Hilfsfunktion: liefert Default-Meta-Liste (für Wiederherstellen)
export const DEFAULT_METAS = DEFAULT_META_CATEGORIES

export function emptyData(): AppData {
  return structuredClone(DEFAULT_DATA)
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function asString(v: unknown, max: number, fallback = ''): string {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v)
  if (typeof v !== 'string') return fallback
  return v.length > max ? v.slice(0, max) : v
}

function asInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function asAmount(v: unknown): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function asColor(v: unknown, fallback: string): string {
  const s = asString(v, LIMITS.color).trim()
  return /^#[0-9a-f]{3,8}$/i.test(s) ? s : fallback
}

function asTurnus(v: unknown): Turnus {
  return TURNI.includes(v as Turnus) ? (v as Turnus) : 'monthly'
}

/** Liefert eindeutige, nicht-leere IDs; doppelte oder ungültige bekommen eine neue. */
function idAllocator(prefix: string) {
  const seen = new Set<string>()
  return (raw: unknown): string => {
    let id = asString(raw, LIMITS.id).trim()
    if (!id || seen.has(id)) id = uid(prefix)
    while (seen.has(id)) id = uid(prefix)
    seen.add(id)
    return id
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function sanitize(data: Partial<AppData> | null | undefined): AppData {
  const base = emptyData()
  if (!isRecord(data)) return base

  // ---- Meta-Kategorien ----
  const metaId = idAllocator('meta')
  const metasRaw: unknown[] =
    Array.isArray(data.metaCategories) && data.metaCategories.length
      ? data.metaCategories
      : base.metaCategories
  const defaultMetaMap = new Map(
    base.metaCategories.map((m) => [m.id, m] as const),
  )
  const metaCategories: MetaCategory[] = []
  for (const raw of metasRaw) {
    if (!isRecord(raw)) continue
    const id = metaId(raw.id)
    const def = defaultMetaMap.get(id)
    metaCategories.push({
      id,
      name: asString(raw.name, LIMITS.name, def?.name ?? 'Kategorie'),
      icon: asString(raw.icon, LIMITS.icon) || def?.icon || 'Package',
      color: asColor(raw.color, def?.color ?? '#64748b'),
    })
  }
  if (!metaCategories.some((m) => m.id === META_SONSTIGES_ID)) {
    metaCategories.push({
      id: metaId(META_SONSTIGES_ID),
      name: 'Sonstiges',
      icon: 'Package',
      color: '#64748b',
    })
  }
  const validMetaIds = new Set(metaCategories.map((m) => m.id))

  // ---- (Sub-)Kategorien – global, kein metaCategoryId mehr ----
  // Ein altes metaCategoryId pro Kategorie merken wir uns, um Items beim
  // Migrieren einer Meta zuordnen zu können.
  const catId = idAllocator('cat')
  const catsRaw: unknown[] =
    Array.isArray(data.categories) && data.categories.length
      ? data.categories
      : base.categories
  const legacyCatMeta = new Map<string, string>()
  const categories: Category[] = []
  for (const raw of catsRaw) {
    if (!isRecord(raw)) continue
    const id = catId(raw.id)
    if (typeof raw.metaCategoryId === 'string')
      legacyCatMeta.set(id, raw.metaCategoryId)
    categories.push({
      id,
      name: asString(raw.name, LIMITS.name, 'Kategorie'),
      icon: asString(raw.icon, LIMITS.icon) || 'Package',
      color: asColor(raw.color, '#64748b'),
    })
  }
  if (!categories.some((c) => c.id === SONSTIGES_ID)) {
    categories.unshift({
      id: catId(SONSTIGES_ID),
      name: 'Sonstiges',
      icon: 'Package',
      color: '#64748b',
    })
  }
  const validCatIds = new Set(categories.map((c) => c.id))

  // ---- Items ----
  const itemId = idAllocator('itm')
  const items: Item[] = []
  for (const raw of Array.isArray(data.items) ? data.items : []) {
    if (!isRecord(raw)) continue
    const categoryId =
      typeof raw.categoryId === 'string' && validCatIds.has(raw.categoryId)
        ? raw.categoryId
        : SONSTIGES_ID
    let metaCategoryId =
      typeof raw.metaCategoryId === 'string' &&
      validMetaIds.has(raw.metaCategoryId)
        ? raw.metaCategoryId
        : undefined
    if (!metaCategoryId) {
      // ableiten aus altem Category.metaCategoryId
      const legacy = legacyCatMeta.get(categoryId)
      metaCategoryId =
        legacy && validMetaIds.has(legacy) ? legacy : META_SONSTIGES_ID
    }
    items.push({
      id: itemId(raw.id),
      name: asString(raw.name, LIMITS.name),
      turnus: asTurnus(raw.turnus),
      day: asInt(raw.day, 1, 31, 1),
      month: asInt(raw.month, 1, 12, 1),
      amount: asAmount(raw.amount),
      info: asString(raw.info, LIMITS.info),
      metaCategoryId,
      categoryId,
    })
  }

  // ---- Einnahmen ----
  const incId = idAllocator('inc')
  const incomes: Income[] = []
  for (const raw of Array.isArray(data.incomes) ? data.incomes : []) {
    if (!isRecord(raw)) continue
    incomes.push({
      id: incId(raw.id),
      name: asString(raw.name, LIMITS.name),
      day: asInt(raw.day, 1, 31, 1),
      amount: asAmount(raw.amount),
      info: asString(raw.info, LIMITS.info),
    })
  }

  return { version: DATA_VERSION, metaCategories, categories, items, incomes }
}

export function serialize(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function parse(text: string): AppData {
  return sanitize(JSON.parse(text) as Partial<AppData>)
}
