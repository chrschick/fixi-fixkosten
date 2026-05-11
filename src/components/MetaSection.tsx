import { ChevronDown, ChevronUp, ChevronsUpDown, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { uid } from '../storage'
import { Category, Item, MetaCategory, SONSTIGES_ID } from '../types'
import { formatEUR, monthlyAmount } from '../utils'
import { Icon } from './IconPicker'
import { ItemRow } from './ItemRow'
import { hexToRgba, metaSoftBg } from './metaColors'

export type SortKey = 'name' | 'monthly' | 'category'
export type SortDir = 'asc' | 'desc'

interface Props {
  meta: MetaCategory
  categories: Category[] // alle Subkategorien (zum Anzeigen + Selektor)
  items: Item[] // alle Items (gefiltert wird intern)
  onItemsChange: (items: Item[]) => void
}

export function MetaSection({ meta, categories, items, onItemsChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [pinnedIds, setPinnedIds] = useState<string[]>([])

  const own = useMemo(
    () => items.filter((i) => i.metaCategoryId === meta.id),
    [items, meta.id],
  )

  const sorted = useMemo(() => {
    const catName = (id: string) =>
      categories.find((c) => c.id === id)?.name ?? ''
    const pinnedSet = new Set(pinnedIds)
    const pinned: Item[] = []
    const rest: Item[] = []
    for (const it of own) {
      if (pinnedSet.has(it.id)) pinned.push(it)
      else rest.push(it)
    }
    // pinned in insertion order (pinnedIds)
    pinned.sort((a, b) => pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id))
    rest.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })
      } else if (sortKey === 'monthly') {
        cmp = monthlyAmount(a) - monthlyAmount(b)
      } else if (sortKey === 'category') {
        cmp = catName(a.categoryId).localeCompare(catName(b.categoryId), 'de', {
          sensitivity: 'base',
        })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return [...pinned, ...rest]
  }, [own, sortKey, sortDir, categories, pinnedIds])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'monthly' ? 'desc' : 'asc')
    }
  }

  const monthlySum = own
    .filter((i) => i.turnus === 'monthly')
    .reduce((a, i) => a + monthlyAmount(i), 0)
  const savingsSum = own
    .filter((i) => i.turnus !== 'monthly')
    .reduce((a, i) => a + monthlyAmount(i), 0)

  function addItem() {
    const defaultCat =
      categories.find((c) => c.id === SONSTIGES_ID) ?? categories[0]
    if (!defaultCat) {
      alert('Lege zuerst eine Subkategorie an (Kategorien verwalten).')
      return
    }
    const ni: Item = {
      id: uid('itm'),
      name: 'Neuer Eintrag',
      turnus: 'monthly',
      day: 1,
      month: 1,
      amount: 0,
      info: '',
      metaCategoryId: meta.id,
      categoryId: defaultCat.id,
    }
    setPinnedIds((ids) => [ni.id, ...ids])
    onItemsChange([...items, ni])
  }

  function updateItem(updated: Item) {
    onItemsChange(items.map((i) => (i.id === updated.id ? updated : i)))
  }

  function deleteItem(id: string) {
    setPinnedIds((ids) => ids.filter((p) => p !== id))
    onItemsChange(items.filter((i) => i.id !== id))
  }

  function confirmItem(id: string) {
    setPinnedIds((ids) => ids.filter((p) => p !== id))
  }

  return (
    <section
      className='meta-section'
      style={{
        borderTopColor: meta.color,
        borderLeft: `4px solid ${meta.color}`,
      }}
    >
      <header
        className='meta-section-head'
        style={{
          background: metaSoftBg(meta.color),
          borderBottom: `1px solid ${hexToRgba(meta.color, 0.3)}`,
        }}
      >
        <div className='meta-section-title-wrap'>
          <div className='cat-badge' style={{ background: meta.color }}>
            <Icon name={meta.icon} size={18} color='#fff' />
          </div>
          <h2 style={{ color: meta.color }}>{meta.name}</h2>
          <span className='meta-section-count muted'>({own.length})</span>
        </div>
        <button className='btn btn-primary' onClick={addItem}>
          <Plus size={16} /> Eintrag
        </button>
      </header>

      {own.length > 0 && (
        <div className='table-wrap'>
          <table className='items-table'>
            <thead>
              <tr>
                <SortableTh
                  label='Name'
                  active={sortKey === 'name'}
                  dir={sortDir}
                  onClick={() => toggleSort('name')}
                />
                <th>Turnus</th>
                <th className='th-num'>Tag</th>
                <th className='th-num'>Monat</th>
                <th className='th-num'>Betrag</th>
                <SortableTh
                  label='Monatlich'
                  active={sortKey === 'monthly'}
                  dir={sortDir}
                  onClick={() => toggleSort('monthly')}
                  className='th-num'
                />
                <th>Stichtag</th>
                <th>Info</th>
                <SortableTh
                  label='Subkategorie'
                  active={sortKey === 'category'}
                  dir={sortDir}
                  onClick={() => toggleSort('category')}
                />
                <th aria-label='Aktionen'></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  categories={categories}
                  onChange={updateItem}
                  onDelete={deleteItem}
                  pinned={pinnedIds.includes(i.id)}
                  onConfirm={confirmItem}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className='cat-section-foot'>
        <div>
          <span className='muted'>Monatlicher Betrag:</span>{' '}
          <strong>{formatEUR(monthlySum)}</strong>
        </div>
        <div>
          <span className='muted'>Wegsparen im Monat:</span>{' '}
          <strong>{formatEUR(savingsSum)}</strong>
        </div>
      </footer>
    </section>
  )
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}) {
  return (
    <th className={`th-sortable ${className ?? ''}`} onClick={onClick}>
      <span className='th-sort-inner'>
        {label}
        {active ? (
          dir === 'asc' ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )
        ) : (
          <ChevronsUpDown size={14} className='muted' />
        )}
      </span>
    </th>
  )
}
