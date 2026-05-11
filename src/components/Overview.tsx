import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AppData, Item, MetaCategory } from '../types'
import { formatEUR, monthlyAmount } from '../utils'
import { Icon } from './IconPicker'
import { metaSoftBg } from './metaColors'

interface Props {
  data: AppData
  onMetaCategoriesChange?: (metas: MetaCategory[]) => void
}

interface CatStats {
  monthly: number
  savings: number
  total: number
  items: Item[]
}

export function Overview({ data, onMetaCategoriesChange }: Props) {
  const [collapsedMetas, setCollapsedMetas] = useState<Record<string, boolean>>(
    {},
  )
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>(
    {},
  )
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  function handleDragStart(id: string, e: React.DragEvent) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', id)
    } catch {
      // ignore
    }
  }
  function handleDragOver(id: string, e: React.DragEvent) {
    if (!dragId || dragId === id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverId !== id) setDragOverId(id)
  }
  function handleDrop(targetId: string, e: React.DragEvent) {
    e.preventDefault()
    const sourceId = dragId
    setDragId(null)
    setDragOverId(null)
    if (!sourceId || sourceId === targetId || !onMetaCategoriesChange) return
    const arr = [...data.metaCategories]
    const from = arr.findIndex((m) => m.id === sourceId)
    const to = arr.findIndex((m) => m.id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    onMetaCategoriesChange(arr)
  }
  function handleDragEnd() {
    setDragId(null)
    setDragOverId(null)
  }

  function toggleMeta(id: string) {
    setCollapsedMetas((m) => ({ ...m, [id]: !m[id] }))
  }
  function toggleCat(id: string) {
    setCollapsedCats((c) => ({ ...c, [id]: !c[id] }))
  }

  const stats = useMemo(() => {
    const income = data.incomes.reduce((a, i) => a + (Number(i.amount) || 0), 0)

    let monthlyExpenses = 0
    let savings = 0
    // pro (meta, cat) Statistik
    const perMetaCat: Record<string, Record<string, CatStats>> = {}
    for (const m of data.metaCategories) perMetaCat[m.id] = {}

    for (const it of data.items) {
      const m = monthlyAmount(it)
      const metaBucket =
        perMetaCat[it.metaCategoryId] ?? perMetaCat[data.metaCategories[0]?.id]
      if (!metaBucket) continue
      if (!metaBucket[it.categoryId]) {
        metaBucket[it.categoryId] = {
          monthly: 0,
          savings: 0,
          total: 0,
          items: [],
        }
      }
      const bucket = metaBucket[it.categoryId]
      if (it.turnus === 'monthly') {
        monthlyExpenses += m
        bucket.monthly += m
      } else {
        savings += m
        bucket.savings += m
      }
      bucket.total += m
      bucket.items.push(it)
    }

    const remaining = income - monthlyExpenses - savings

    // Chart: pro Subkategorie aggregiert (über alle Metas)
    const catTotals = new Map<string, number>()
    for (const meta of data.metaCategories) {
      for (const [catId, b] of Object.entries(perMetaCat[meta.id])) {
        catTotals.set(catId, (catTotals.get(catId) ?? 0) + b.total)
      }
    }
    const chartData = data.categories
      .map((c) => ({
        name: c.name,
        color: c.color,
        value: catTotals.get(c.id) ?? 0,
      }))
      .filter((d) => d.value > 0)

    // Chart: pro Meta-Kategorie
    const metaChartData = data.metaCategories
      .map((m) => {
        const bucket = perMetaCat[m.id] ?? {}
        const total = Object.values(bucket).reduce((a, b) => a + b.total, 0)
        const monthlyVal = Object.values(bucket).reduce(
          (a, b) => a + b.monthly,
          0,
        )
        const savingsVal = Object.values(bucket).reduce(
          (a, b) => a + b.savings,
          0,
        )
        return {
          name: m.name,
          color: m.color,
          total,
          monthly: monthlyVal,
          savings: savingsVal,
        }
      })
      .filter((d) => d.total > 0)

    return {
      income,
      monthlyExpenses,
      savings,
      remaining,
      perMetaCat,
      chartData,
      metaChartData,
    }
  }, [data])

  return (
    <section className='overview'>
      <div className='kpis'>
        <div className='kpi kpi-income'>
          <span className='muted'>Einnahmen</span>
          <strong>{formatEUR(stats.income)}</strong>
        </div>
        <div className='kpi kpi-expense'>
          <span className='muted'>Ausgaben (monatlich)</span>
          <strong>{formatEUR(stats.monthlyExpenses)}</strong>
        </div>
        <div className='kpi kpi-savings'>
          <span className='muted'>Wegsparen</span>
          <strong>{formatEUR(stats.savings)}</strong>
        </div>
        <div className={`kpi ${stats.remaining < 0 ? 'kpi-neg' : 'kpi-pos'}`}>
          <span className='muted'>Übrig</span>
          <strong>{formatEUR(stats.remaining)}</strong>
        </div>
      </div>

      <div className='overview-body'>
        <div className='chart-wrap'>
          <h3>Verteilung nach Subkategorie</h3>
          {stats.chartData.length === 0 ? (
            <p className='muted'>Noch keine Einträge.</p>
          ) : (
            <ResponsiveContainer width='100%' height={280}>
              <PieChart>
                <Pie
                  data={stats.chartData}
                  dataKey='value'
                  nameKey='name'
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {stats.chartData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, name: string) => [formatEUR(v), name]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className='chart-wrap'>
          <h3>Vergleich Hauptkategorien</h3>
          {stats.metaChartData.length === 0 ? (
            <p className='muted'>Noch keine Einträge.</p>
          ) : (
            <ResponsiveContainer width='100%' height={280}>
              <BarChart
                data={stats.metaChartData}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
                <XAxis dataKey='name' fontSize={12} />
                <YAxis
                  fontSize={12}
                  tickFormatter={(v) => formatEUR(v)}
                  width={70}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  formatter={(v: number) => formatEUR(v)}
                  labelFormatter={(label: string) => label}
                />
                <Bar
                  dataKey='total'
                  name='Gesamt / Monat'
                  radius={[6, 6, 0, 0]}
                >
                  {stats.metaChartData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className='cat-breakdown'>
          <h3>Pro Kategorie</h3>
          <div className='cat-breakdown-list'>
            {data.metaCategories.map((meta) => {
              const metaBucket = stats.perMetaCat[meta.id] ?? {}
              const catsInMeta = data.categories.filter(
                (c) => metaBucket[c.id] && metaBucket[c.id].total > 0,
              )
              if (catsInMeta.length === 0) return null
              const metaTotal = catsInMeta.reduce(
                (a, c) => a + metaBucket[c.id].total,
                0,
              )
              const metaCollapsed = collapsedMetas[meta.id] === true
              const isDragging = dragId === meta.id
              const isDragOver = dragOverId === meta.id
              return (
                <div
                  key={meta.id}
                  className={
                    'meta-block' +
                    (isDragging ? ' meta-block-dragging' : '') +
                    (isDragOver ? ' meta-block-dragover' : '')
                  }
                  draggable={!!onMetaCategoriesChange}
                  onDragStart={(e) => handleDragStart(meta.id, e)}
                  onDragOver={(e) => handleDragOver(meta.id, e)}
                  onDrop={(e) => handleDrop(meta.id, e)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={() => {
                    if (dragOverId === meta.id) setDragOverId(null)
                  }}
                >
                  <button
                    type='button'
                    className='meta-block-head meta-block-head-btn'
                    onClick={() => toggleMeta(meta.id)}
                    style={{
                      background: metaSoftBg(meta.color),
                      borderLeft: `4px solid ${meta.color}`,
                      color: meta.color,
                    }}
                  >
                    <span className='meta-block-title'>
                      {metaCollapsed ? (
                        <ChevronRight size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                      <Icon name={meta.icon} size={16} />
                      <h4>{meta.name}</h4>
                    </span>
                    <strong>{formatEUR(metaTotal)}</strong>
                  </button>
                  {!metaCollapsed && (
                    <div className='cat-grid'>
                      {catsInMeta.map((c) => {
                        const b = metaBucket[c.id]
                        const catKey = `${meta.id}:${c.id}`
                        const catCollapsed = collapsedCats[catKey] === true
                        return (
                          <div key={c.id} className='cat-block'>
                            <button
                              type='button'
                              className='cat-block-head cat-block-head-btn'
                              onClick={() => toggleCat(catKey)}
                            >
                              {catCollapsed ? (
                                <ChevronRight size={14} />
                              ) : (
                                <ChevronDown size={14} />
                              )}
                              <div
                                className='cat-badge'
                                style={{ background: c.color }}
                              >
                                <Icon name={c.icon} size={14} color='#fff' />
                              </div>
                              <span className='cat-name'>{c.name}</span>
                              <strong>{formatEUR(b.total)}</strong>
                            </button>
                            {!catCollapsed && (
                              <ul className='cat-items'>
                                {b.items.map((it) => {
                                  const m = monthlyAmount(it)
                                  return (
                                    <li key={it.id}>
                                      <span className='ci-name'>
                                        {it.name || (
                                          <em className='muted'>(ohne Name)</em>
                                        )}
                                      </span>
                                      <span className='muted small ci-amount'>
                                        {formatEUR(it.amount)} /{' '}
                                        {it.turnus === 'monthly'
                                          ? 'Monat'
                                          : it.turnus === 'quarterly'
                                            ? 'Quartal'
                                            : it.turnus === 'half-yearly'
                                              ? 'Halbjahr'
                                              : 'Jahr'}
                                      </span>
                                      <strong className='ci-monthly'>
                                        {formatEUR(m)}{' '}
                                        <span className='muted small'>
                                          /Monat
                                        </span>
                                      </strong>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
