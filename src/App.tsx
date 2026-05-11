import {
  AlertTriangle,
  Check,
  CloudOff,
  Download,
  Loader2,
  LogOut,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  Upload,
  Wallet,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CategoryManager } from './components/CategoryManager'
import { IncomeList } from './components/IncomeList'
import { MetaSection } from './components/MetaSection'
import { Overview } from './components/Overview'
import { Upcoming } from './components/Upcoming'
import { WelcomeScreen } from './components/WelcomeScreen'
import { downloadJson, readFileAsJson } from './storage'
import {
  AppData,
  Category,
  Income,
  Item,
  META_SONSTIGES_ID,
  MetaCategory,
  SONSTIGES_ID,
} from './types'
import { useFileStore } from './useFileStore'

type Tab = 'fixkosten' | 'einnahmen' | 'uebersicht' | 'vorgemerkt'

export default function App() {
  const store = useFileStore()
  const [tab, setTab] = useState<Tab>('fixkosten')
  const [showCats, setShowCats] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('fixi-theme')
    return saved === 'dark' ? 'dark' : 'light'
  })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('fixi-theme', theme)
  }, [theme])

  if (!store.hasFile) {
    return (
      <WelcomeScreen
        isSupported={store.isSupported}
        onOpen={() => store.pickFile().catch(() => {})}
        onCreate={() => store.createFile().catch(() => {})}
        error={store.error}
      />
    )
  }

  const data = store.data
  const setItems = (items: Item[]) => store.setData((d) => ({ ...d, items }))
  const setIncomes = (incomes: Income[]) =>
    store.setData((d) => ({ ...d, incomes }))
  const setCategories = (categories: Category[]) =>
    store.setData((d) => ({ ...d, categories }))
  const setMetaCategories = (metaCategories: MetaCategory[]) =>
    store.setData((d) => ({ ...d, metaCategories }))

  function deleteCategory(id: string) {
    if (id === SONSTIGES_ID) return
    store.setData((d) => ({
      ...d,
      categories: d.categories.filter((c) => c.id !== id),
      items: d.items.map((i) =>
        i.categoryId === id ? { ...i, categoryId: SONSTIGES_ID } : i,
      ),
    }))
  }

  function deleteMeta(id: string) {
    if (id === META_SONSTIGES_ID) return
    store.setData((d) => ({
      ...d,
      metaCategories: d.metaCategories.filter((m) => m.id !== id),
      // Items in dieser Meta wandern zu Meta-Sonstiges
      items: d.items.map((i) =>
        i.metaCategoryId === id
          ? { ...i, metaCategoryId: META_SONSTIGES_ID }
          : i,
      ),
    }))
  }

  async function onImportFallback(file: File) {
    try {
      const imported = await readFileAsJson(file)
      store.setData(() => imported as AppData)
    } catch (e) {
      alert('Import fehlgeschlagen: ' + (e as Error).message)
    }
  }

  return (
    <div className='app'>
      <header className='app-header'>
        <div className='brand'>
          <Wallet size={22} />
          <h1>Fixi</h1>
        </div>
        <nav className='tabs'>
          <button
            className={tab === 'fixkosten' ? 'active' : ''}
            onClick={() => setTab('fixkosten')}
          >
            Fixkosten
          </button>
          <button
            className={tab === 'einnahmen' ? 'active' : ''}
            onClick={() => setTab('einnahmen')}
          >
            Einnahmen
          </button>
          <button
            className={tab === 'uebersicht' ? 'active' : ''}
            onClick={() => setTab('uebersicht')}
          >
            Übersicht
          </button>
          <button
            className={tab === 'vorgemerkt' ? 'active' : ''}
            onClick={() => setTab('vorgemerkt')}
          >
            Vorgemerkte Umsätze
          </button>
        </nav>
        <div className='header-actions'>
          <StatusBadge status={store.status} error={store.error} />
          <button
            className='btn btn-icon'
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className='btn btn-icon'
            onClick={() => store.reloadNow()}
            title='Jetzt synchronisieren'
          >
            <RefreshCw size={18} />
          </button>
          <button
            className='btn'
            onClick={() => setShowCats((s) => !s)}
            title='Kategorien verwalten'
          >
            <Settings size={16} /> Kategorien
          </button>
          <button
            className='btn btn-icon'
            onClick={() => downloadJson(data)}
            title='Sicherungskopie herunterladen'
          >
            <Download size={18} />
          </button>
          <button
            className='btn btn-icon'
            onClick={() => fileRef.current?.click()}
            title='Aus JSON laden (überschreibt!)'
          >
            <Upload size={18} />
          </button>
          <button
            className='btn btn-icon'
            onClick={() => store.disconnect()}
            title='Datei trennen'
          >
            <LogOut size={18} />
          </button>
          <input
            ref={fileRef}
            type='file'
            accept='application/json'
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImportFallback(f)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {showCats && (
        <div className='modal-backdrop' onClick={() => setShowCats(false)}>
          <div className='modal' onClick={(e) => e.stopPropagation()}>
            <CategoryManager
              categories={data.categories}
              metaCategories={data.metaCategories}
              onCategoriesChange={setCategories}
              onMetaCategoriesChange={setMetaCategories}
              onDeleteCategory={deleteCategory}
              onDeleteMeta={deleteMeta}
            />
            <div className='modal-foot'>
              <button className='btn' onClick={() => setShowCats(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      <main className='app-main'>
        {tab === 'fixkosten' && (
          <div className='sections'>
            {data.metaCategories.map((meta) => (
              <MetaSection
                key={meta.id}
                meta={meta}
                categories={data.categories}
                items={data.items}
                onItemsChange={setItems}
              />
            ))}
          </div>
        )}

        {tab === 'einnahmen' && (
          <IncomeList incomes={data.incomes} onChange={setIncomes} />
        )}

        {tab === 'uebersicht' && (
          <Overview data={data} onMetaCategoriesChange={setMetaCategories} />
        )}

        {tab === 'vorgemerkt' && <Upcoming data={data} />}
      </main>

      <footer className='app-foot'>
        <span className='muted small'>
          Fixi · Datei: <strong>{store.fileName}</strong>
        </span>
      </footer>
    </div>
  )
}

function StatusBadge({
  status,
  error,
}: {
  status: string
  error: string | null
}) {
  if (status === 'saving')
    return (
      <span className='badge'>
        <Loader2 size={14} className='spin' /> speichere…
      </span>
    )
  if (status === 'loading')
    return (
      <span className='badge'>
        <Loader2 size={14} className='spin' /> lade…
      </span>
    )
  if (status === 'error')
    return (
      <span className='badge danger' title={error ?? ''}>
        <AlertTriangle size={14} /> Fehler
      </span>
    )
  if (status === 'saved')
    return (
      <span className='badge ok'>
        <Check size={14} /> synchron
      </span>
    )
  return (
    <span className='badge'>
      <CloudOff size={14} /> offline
    </span>
  )
}
