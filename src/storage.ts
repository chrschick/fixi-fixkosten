import {
  AppData,
  Category,
  DEFAULT_DATA,
  DEFAULT_META_CATEGORIES,
  META_SONSTIGES_ID,
  SONSTIGES_ID,
} from './types'

export function emptyData(): AppData {
  return structuredClone(DEFAULT_DATA)
}

export function sanitize(data: Partial<AppData> | null | undefined): AppData {
  const base = emptyData()
  if (!data) return base

  // Meta-Kategorien
  const metasRaw =
    Array.isArray(data.metaCategories) && data.metaCategories.length
      ? data.metaCategories
      : base.metaCategories
  const defaultMetaMap = new Map(
    base.metaCategories.map((m) => [m.id, m] as const),
  )
  const metasNormalized = metasRaw.map((m) => {
    const def = defaultMetaMap.get(m.id)
    return {
      id: m.id,
      name: m.name,
      icon: m.icon ?? def?.icon ?? 'Package',
      color: m.color ?? def?.color ?? '#64748b',
    }
  })
  const hasMetaSonstiges = metasNormalized.some(
    (m) => m.id === META_SONSTIGES_ID,
  )
  const metaCategories = hasMetaSonstiges
    ? metasNormalized
    : [
        ...metasNormalized,
        {
          id: META_SONSTIGES_ID,
          name: 'Sonstiges',
          icon: 'Package',
          color: '#64748b',
        },
      ]
  const validMetaIds = new Set(metaCategories.map((m) => m.id))

  // (Sub-)Kategorien sind jetzt global – kein metaCategoryId mehr.
  // Wir merken uns aber das alte metaCategoryId pro Kategorie, um Items beim
  // Migrieren einer Meta zuordnen zu können.
  const catsRaw =
    Array.isArray(data.categories) && data.categories.length
      ? data.categories
      : base.categories
  const legacyCatMeta = new Map<string, string>()
  const categories: Category[] = catsRaw.map((c) => {
    const anyC = c as Category & { metaCategoryId?: string }
    if (anyC.metaCategoryId) legacyCatMeta.set(c.id, anyC.metaCategoryId)
    return {
      id: c.id,
      name: c.name,
      icon: c.icon ?? 'Package',
      color: c.color ?? '#64748b',
    }
  })
  if (!categories.some((c) => c.id === SONSTIGES_ID)) {
    categories.unshift({
      id: SONSTIGES_ID,
      name: 'Sonstiges',
      icon: 'Package',
      color: '#64748b',
    })
  }
  const validCatIds = new Set(categories.map((c) => c.id))

  // Items
  const itemsRaw = Array.isArray(data.items) ? data.items : []
  const items = itemsRaw.map((i) => {
    const anyI = i as typeof i & { metaCategoryId?: string }
    const catId = validCatIds.has(i.categoryId) ? i.categoryId : SONSTIGES_ID
    let metaId = anyI.metaCategoryId
    if (!metaId || !validMetaIds.has(metaId)) {
      // ableiten aus altem Category.metaCategoryId
      const legacy = legacyCatMeta.get(catId)
      metaId = legacy && validMetaIds.has(legacy) ? legacy : META_SONSTIGES_ID
    }
    return { ...i, categoryId: catId, metaCategoryId: metaId }
  })

  return {
    version: 3,
    metaCategories,
    categories,
    items,
    incomes: Array.isArray(data.incomes) ? data.incomes : [],
  }
}

// Hilfsfunktion: liefert Default-Meta-Liste (für Wiederherstellen)
export const DEFAULT_METAS = DEFAULT_META_CATEGORIES

export function serialize(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function parse(text: string): AppData {
  return sanitize(JSON.parse(text) as Partial<AppData>)
}

export async function readFromHandle(
  handle: FileSystemFileHandle,
): Promise<{ data: AppData; lastModified: number }> {
  const file = await handle.getFile()
  const text = await file.text()
  const data = text.trim() ? parse(text) : emptyData()
  return { data, lastModified: file.lastModified }
}

export async function writeToHandle(
  handle: FileSystemFileHandle,
  data: AppData,
): Promise<number> {
  // @ts-ignore createWritable
  const writable = await handle.createWritable()
  await writable.write(serialize(data))
  await writable.close()
  const file = await handle.getFile()
  return file.lastModified
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function downloadJson(data: AppData) {
  const blob = new Blob([serialize(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const ts = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `fixi-${ts}.json`
  a.click()
  URL.revokeObjectURL(url)
}

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
