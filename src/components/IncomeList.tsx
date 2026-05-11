import { Plus, Trash2 } from 'lucide-react'
import { uid } from '../storage'
import { Income } from '../types'
import { formatEUR } from '../utils'

interface Props {
  incomes: Income[]
  onChange: (i: Income[]) => void
}

export function IncomeList({ incomes, onChange }: Props) {
  const total = incomes.reduce((acc, i) => acc + (Number(i.amount) || 0), 0)

  function add() {
    const ni: Income = {
      id: uid('inc'),
      name: 'Neue Einnahme',
      day: 1,
      amount: 0,
      info: '',
    }
    onChange([...incomes, ni])
  }

  function update(updated: Income) {
    onChange(incomes.map((i) => (i.id === updated.id ? updated : i)))
  }

  function remove(id: string) {
    onChange(incomes.filter((i) => i.id !== id))
  }

  return (
    <section className='cat-section income-section'>
      <header className='cat-section-head'>
        <div className='cat-section-title'>
          <h2>Einnahmen</h2>
          <span className='muted'>({incomes.length})</span>
        </div>
        <button className='btn btn-primary' onClick={add}>
          <Plus size={16} /> Einnahme
        </button>
      </header>

      {incomes.length > 0 && (
        <div className='table-wrap'>
          <table className='items-table'>
            <thead>
              <tr>
                <th>Art</th>
                <th className='th-num'>Tag</th>
                <th className='th-num'>Betrag (monatlich)</th>
                <th>Info</th>
                <th aria-label='Aktionen'></th>
              </tr>
            </thead>
            <tbody>
              {incomes.map((i) => (
                <tr className='item-row' key={i.id}>
                  <td data-label='Art'>
                    <input
                      className='inline-input'
                      value={i.name}
                      placeholder='Art'
                      onChange={(e) => update({ ...i, name: e.target.value })}
                    />
                  </td>
                  <td data-label='Tag' className='td-num'>
                    <input
                      type='number'
                      min={1}
                      max={31}
                      value={i.day}
                      onChange={(e) =>
                        update({
                          ...i,
                          day: Math.max(
                            1,
                            Math.min(31, Number(e.target.value) || 1),
                          ),
                        })
                      }
                    />
                  </td>
                  <td data-label='Betrag' className='td-num'>
                    <input
                      type='number'
                      step='0.01'
                      value={i.amount}
                      onChange={(e) =>
                        update({ ...i, amount: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td data-label='Info'>
                    <input
                      className='inline-input'
                      value={i.info}
                      placeholder='Info'
                      onChange={(e) => update({ ...i, info: e.target.value })}
                    />
                  </td>
                  <td className='td-actions'>
                    <button
                      className='btn btn-icon danger'
                      onClick={() => remove(i.id)}
                      title='Löschen'
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className='cat-section-foot'>
        <div>
          <span className='muted'>Einnahmen monatlich:</span>{' '}
          <strong>{formatEUR(total)}</strong>
        </div>
      </footer>
    </section>
  )
}
