// Gemeinsame Domain-Typen für Frontend (src/) und Server (server/).
// Wird von beiden Seiten importiert – hier keine Browser- oder Node-APIs verwenden.

export type Turnus = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'

export interface MetaCategory {
  id: string
  name: string
  icon: string
  color: string
}

/** Subkategorie (global – nicht an eine Meta gebunden) */
export interface Category {
  id: string
  name: string
  icon: string // lucide icon name
  color: string // hex
}

export interface Item {
  id: string
  name: string
  turnus: Turnus
  day: number // 1..31
  month: number // 1..12 (für monthly egal; default 1)
  amount: number // Euro (Brutto-Periodenbetrag)
  info: string
  metaCategoryId: string
  categoryId: string
}

export interface Income {
  id: string
  name: string
  day: number
  amount: number
  info: string
}

export interface AppData {
  version: number
  metaCategories: MetaCategory[]
  categories: Category[]
  items: Item[]
  incomes: Income[]
}

export const SONSTIGES_ID = 'cat-sonstiges'
export const META_SONSTIGES_ID = 'meta-sonstiges'

export const DEFAULT_META_CATEGORIES: MetaCategory[] = [
  { id: 'meta-haus', name: 'Haus', icon: 'Home', color: '#3b82f6' },
  {
    id: 'meta-freizeit',
    name: 'Freizeit',
    icon: 'PartyPopper',
    color: '#a855f7',
  },
  {
    id: 'meta-versicherungen',
    name: 'Versicherungen',
    icon: 'ShieldCheck',
    color: '#f59e0b',
  },
  {
    id: 'meta-variable',
    name: 'Variable Kosten',
    icon: 'Wallet',
    color: '#ef4444',
  },
  { id: 'meta-malte', name: 'Malte', icon: 'Baby', color: '#10b981' },
  { id: 'meta-balu', name: 'Balu', icon: 'Dog', color: '#f97316' },
  {
    id: META_SONSTIGES_ID,
    name: 'Sonstiges',
    icon: 'Package',
    color: '#64748b',
  },
]

export const DEFAULT_DATA: AppData = {
  version: 3,
  metaCategories: DEFAULT_META_CATEGORIES,
  categories: [
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
  ],
  items: [],
  incomes: [],
}
