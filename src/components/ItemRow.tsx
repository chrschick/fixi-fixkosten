import { Check, Trash2 } from 'lucide-react'
import { Category, Item, Turnus } from '../types'
import {
  TURNUS_LABEL,
  formatDateDE,
  formatEUR,
  monthlyAmount,
  nextDueDate,
} from '../utils'

interface Props {
  item: Item
  categories: Category[]
  onChange: (i: Item) => void
  onDelete: (id: string) => void
  pinned?: boolean
  onConfirm?: (id: string) => void
}

const TURNI: Turnus[] = ['monthly', 'quarterly', 'half-yearly', 'yearly']

export function ItemRow({
  item,
  categories,
  onChange,
  onDelete,
  pinned,
  onConfirm,
}: Props) {
  const monthly = monthlyAmount(item)
  const due = nextDueDate(item)

  function update<K extends keyof Item>(key: K, value: Item[K]) {
    onChange({ ...item, [key]: value })
  }

  return (
    <tr className={'item-row' + (pinned ? ' item-row-pinned' : '')}>
      <td data-label='Name'>
        <input
          className='inline-input'
          value={item.name}
          placeholder='Name'
          onChange={(e) => update('name', e.target.value)}
        />
      </td>

      <td data-label='Turnus' className='td-turnus'>
        <select
          value={item.turnus}
          onChange={(e) => update('turnus', e.target.value as Turnus)}
        >
          {TURNI.map((t) => (
            <option key={t} value={t}>
              {TURNUS_LABEL[t]}
            </option>
          ))}
        </select>
      </td>

      <td data-label='Tag' className='td-num'>
        <input
          type='number'
          min={1}
          max={31}
          value={item.day}
          onChange={(e) =>
            update(
              'day',
              Math.max(1, Math.min(31, Number(e.target.value) || 1)),
            )
          }
        />
      </td>

      <td data-label='Monat' className='td-num'>
        <input
          type='number'
          min={1}
          max={12}
          value={item.month}
          disabled={item.turnus === 'monthly'}
          onChange={(e) =>
            update(
              'month',
              Math.max(1, Math.min(12, Number(e.target.value) || 1)),
            )
          }
        />
      </td>

      <td data-label='Betrag' className='td-num'>
        <input
          type='number'
          step='0.01'
          value={Number.isFinite(item.amount) ? item.amount : 0}
          onChange={(e) => update('amount', Number(e.target.value) || 0)}
        />
      </td>

      <td data-label='Monatlich' className='td-monthly'>
        <strong>{formatEUR(monthly)}</strong>
      </td>

      <td data-label='Stichtag' className='td-due'>
        <span className='small'>{formatDateDE(due)}</span>
      </td>

      <td data-label='Info'>
        <input
          className='inline-input'
          value={item.info}
          placeholder='Info'
          onChange={(e) => update('info', e.target.value)}
        />
      </td>

      <td data-label='Kategorie'>
        <select
          value={item.categoryId}
          onChange={(e) => update('categoryId', e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>

      <td className='td-actions'>
        {pinned && onConfirm && (
          <button
            className='btn btn-icon'
            onClick={() => onConfirm(item.id)}
            title='Übernehmen'
          >
            <Check size={16} />
          </button>
        )}
        <button
          className='btn btn-icon danger'
          onClick={() => onDelete(item.id)}
          title='Löschen'
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  )
}
