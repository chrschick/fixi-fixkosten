import {
  AlertTriangle,
  Check,
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
import { useRef, useState } from 'react'
import { AdminApp } from './components/AdminApp'
import { CategoryManager } from './components/CategoryManager'
import { IncomeList } from './components/IncomeList'
import { LoginScreen } from './components/LoginScreen'
import { MetaSection } from './components/MetaSection'
import { Overview } from './components/Overview'
import { Upcoming } from './components/Upcoming'
import { downloadJson, readFileAsJson } from './storage'
import {
  Category,
  Income,
  Item,
  META_SONSTIGES_ID,
  MetaCategory,
  SONSTIGES_ID,
} from './types'
import { useDataStore } from './useDataStore'
import { SessionUser, useSession } from './useSession'
import { Theme, useTheme } from './useTheme'

type Tab = 'fixkosten' | 'einnahmen' | 'uebersicht' | 'vorgemerkt'

const SA_PATH = /^\/sa(\/|$)/

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const isSuperadmin = SA_PATH.test(window.location.pathname)
  return isSuperadmin ? (
    <AdminApp theme={theme} onToggleTheme={toggleTheme} />
  ) : (
    <UserApp theme={theme} onToggleTheme={toggleTheme} />
  )
}

interface ThemeProps {
  theme: Theme
  onToggleTheme: () => void
}

function UserApp({ theme, onToggleTheme }: ThemeProps) {
  const session = useSession('user')

  if (session.loading) {
    return (
      <div className='welcome'>
        <Loader2 size={28} className='spin muted' />
      </div>
    )
  }
  if (!session.user) {
    return (
      <LoginScreen
        title='Fixi'
        subtitle='Melde dich mit deinem Fixi-Zugang an, um deine Fixkosten zu verwalten.'
        onLogin={session.login}
        error={session.error}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    )
  }
  return (
    <Workspace
      user={session.user}
      onLogout={session.logout}
      theme={theme}
      onToggleTheme={onToggleTheme}
    />
  )
}

interface WorkspaceProps extends ThemeProps {
  user: SessionUser
  onLogout: () => Promise<void>
}

function Workspace({ user, onLogout, theme, onToggleTheme }: WorkspaceProps) {
  const store = useDataStore()
  const [tab, setTab] = useState<Tab>('fixkosten')
  const [showCats, setShowCats] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!store.loaded) {
    return (
      <div className='welcome'>
        <div className='welcome-card'>
          <div className='brand'>
            <Wallet size={22} />
            <h1>Fixi</h1>
          </div>
          {store.status === 'error' ? (
            <>
              <div className='error-box'>
                <AlertTriangle size={16} /> Daten konnten nicht geladen
                werden: {store.error}
              </div>
              <div className='welcome-actions'>
                <button
                  className='btn btn-primary'
                  onClick={() => void store.reloadNow()}
                >
                  <RefreshCw size={16} /> Erneut versuchen
                </button>
                <button className='btn' onClick={() => void onLogout()}>
                  <LogOut size={16} /> Abmelden
                </button>
              </div>
            </>
          ) : (
            <p className='muted'>
              <Loader2 size={16} className='spin' /> lade Fixkosten…
            </p>
          )}
        </div>
      </div>
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

  /** Import einer Sicherungskopie: ersetzt alle Daten und speichert in der DB. */
  async function onImport(file: File) {
    try {
      const imported = await readFileAsJson(file)
      if (
        !window.confirm(
          `Alle aktuellen Daten durch den Inhalt von „${file.name}“ ersetzen?`,
        )
      )
        return
      store.setData(() => imported)
    } catch (e) {
      alert('Import fehlgeschlagen: ' + (e as Error).message)
    }
  }

  async function logout() {
    await store.flushNow()
    await onLogout()
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
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className='btn btn-icon'
            onClick={() => void store.reloadNow()}
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
            title='Sicherungskopie herunterladen (Export)'
          >
            <Download size={18} />
          </button>
          <button
            className='btn btn-icon'
            onClick={() => fileRef.current?.click()}
            title='Sicherungskopie importieren (überschreibt!)'
          >
            <Upload size={18} />
          </button>
          <button
            className='btn btn-icon'
            onClick={() => void logout()}
            title='Abmelden'
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
              if (f) void onImport(f)
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
          Fixi · Angemeldet als <strong>{user.username}</strong>
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
  return (
    <span className='badge ok'>
      <Check size={14} /> gespeichert
    </span>
  )
}
