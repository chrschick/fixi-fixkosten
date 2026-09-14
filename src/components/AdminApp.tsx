// Superadmin-Panel (/sa): Systeme (= Benutzer) anlegen, Passwort setzen,
// Daten exportieren/importieren, löschen.
import {
  AlertTriangle,
  Check,
  Download,
  KeyRound,
  Loader2,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { downloadJson, readFileAsJson } from '../storage'
import { AppData } from '../types'
import { useSession, SessionUser } from '../useSession'
import { Theme } from '../useTheme'
import { formatDateDE } from '../utils'
import { LoginScreen } from './LoginScreen'

interface UserSummary {
  id: number
  username: string
  createdAt: string
  dataVersion: number
  itemCount: number
  incomeCount: number
}

interface Props {
  theme: Theme
  onToggleTheme: () => void
}

/** Zufälliges Passwort (ohne leicht verwechselbare Zeichen). */
export function generatePassword(length = 16): string {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#$%&*+-=?@_'
  const limit = 256 - (256 % alphabet.length) // Modulo-Bias vermeiden
  let out = ''
  const buf = new Uint8Array(32)
  while (out.length < length) {
    crypto.getRandomValues(buf)
    for (const b of buf) {
      if (b < limit && out.length < length) out += alphabet[b % alphabet.length]
    }
  }
  return out
}

function formatCreated(s: string): string {
  const d = new Date(s.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? s : formatDateDE(d)
}

export function AdminApp({ theme, onToggleTheme }: Props) {
  const session = useSession('sa')

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
        title='Fixi · Superadmin'
        subtitle='Verwaltung der Fixi-Systeme. Bitte als Superadmin anmelden.'
        onLogin={session.login}
        error={session.error}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    )
  }
  return (
    <AdminPanel
      user={session.user}
      onLogout={session.logout}
      theme={theme}
      onToggleTheme={onToggleTheme}
    />
  )
}

interface PanelProps extends Props {
  user: SessionUser
  onLogout: () => Promise<void>
}

function AdminPanel({ user, onLogout, theme, onToggleTheme }: PanelProps) {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  // Neues System
  const [newName, setNewName] = useState('')
  const [newPw, setNewPw] = useState(() => generatePassword())
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{
    username: string
    password: string
  } | null>(null)

  // Passwort zurücksetzen (inline)
  const [resetId, setResetId] = useState<number | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resetDone, setResetDone] = useState<{
    username: string
    password: string
  } | null>(null)

  // Import
  const fileRef = useRef<HTMLInputElement>(null)
  const importTarget = useRef<UserSummary | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api<{ users: UserSummary[] }>('/api/sa/users')
      setUsers(r.users)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  async function run(id: number | null, fn: () => Promise<void>) {
    setBusyId(id)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function createSystem(e: FormEvent) {
    e.preventDefault()
    if (creating) return
    setCreating(true)
    setError(null)
    setCreated(null)
    const username = newName.trim()
    const password = newPw
    try {
      await api('/api/sa/users', {
        method: 'POST',
        body: { username, password },
      })
      setCreated({ username, password })
      setNewName('')
      setNewPw(generatePassword())
      await loadUsers()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  function exportUser(u: UserSummary) {
    void run(u.id, async () => {
      const r = await api<{ username: string; data: AppData }>(
        `/api/sa/users/${u.id}/data`,
      )
      const ts = new Date().toISOString().slice(0, 10)
      downloadJson(r.data, `fixi-${r.username}-${ts}.json`)
    })
  }

  function startImport(u: UserSummary) {
    importTarget.current = u
    fileRef.current?.click()
  }

  async function onImportFile(file: File) {
    const u = importTarget.current
    importTarget.current = null
    if (!u) return
    await run(u.id, async () => {
      const data = await readFileAsJson(file)
      if (
        !window.confirm(
          `Alle Daten von „${u.username}“ durch den Inhalt von „${file.name}“ ersetzen?`,
        )
      )
        return
      await api(`/api/sa/users/${u.id}/data`, { method: 'PUT', body: { data } })
      await loadUsers()
    })
  }

  function startReset(u: UserSummary) {
    setResetId(u.id)
    setResetPw(generatePassword())
    setResetDone(null)
  }

  function saveReset(u: UserSummary) {
    void run(u.id, async () => {
      await api(`/api/sa/users/${u.id}/password`, {
        method: 'PUT',
        body: { password: resetPw },
      })
      setResetDone({ username: u.username, password: resetPw })
      setResetId(null)
    })
  }

  function deleteSystem(u: UserSummary) {
    if (
      !window.confirm(
        `System „${u.username}“ mit allen Fixkosten unwiderruflich löschen?`,
      )
    )
      return
    void run(u.id, async () => {
      await api(`/api/sa/users/${u.id}`, { method: 'DELETE' })
      await loadUsers()
    })
  }

  return (
    <div className='app'>
      <header className='app-header'>
        <div className='brand'>
          <ShieldCheck size={22} />
          <h1>Fixi · Superadmin</h1>
        </div>
        <div className='header-actions'>
          <button
            className='btn btn-icon'
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className='btn btn-icon'
            onClick={() => void loadUsers()}
            title='Liste neu laden'
          >
            <RefreshCw size={18} />
          </button>
          <button className='btn' onClick={() => void onLogout()}>
            <LogOut size={16} /> Abmelden
          </button>
        </div>
      </header>

      <main className='app-main admin-main'>
        {error && (
          <div className='error-box'>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <section className='panel'>
          <header className='panel-head'>
            <h2>Neues System anlegen</h2>
          </header>
          <form className='panel-body' onSubmit={createSystem}>
            <p className='muted small' style={{ marginTop: 0 }}>
              Jedes System ist ein Benutzer mit einer eigenen Fixkostenliste.
              Der Benutzer meldet sich mit diesen Zugangsdaten auf der
              Startseite an.
            </p>
            <div className='form-row'>
              <label className='field'>
                Benutzername
                <input
                  type='text'
                  autoComplete='off'
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder='z.B. familie-mueller'
                />
              </label>
              <label className='field'>
                Passwort
                <div className='input-with-btn'>
                  <input
                    type='text'
                    autoComplete='off'
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                  />
                  <button
                    type='button'
                    className='btn btn-icon'
                    title='Passwort generieren'
                    onClick={() => setNewPw(generatePassword())}
                  >
                    <Wand2 size={16} />
                  </button>
                </div>
              </label>
              <button
                className='btn btn-primary'
                type='submit'
                disabled={creating || !newName.trim() || newPw.length < 8}
              >
                {creating ? (
                  <Loader2 size={16} className='spin' />
                ) : (
                  <Plus size={16} />
                )}{' '}
                Anlegen
              </button>
            </div>
            {created && (
              <div className='notice'>
                <Check size={16} /> System <code>{created.username}</code>{' '}
                angelegt – Passwort: <code>{created.password}</code>
                <span className='muted small'>
                  (wird nur jetzt angezeigt)
                </span>
              </div>
            )}
          </form>
        </section>

        <section className='panel'>
          <header className='panel-head'>
            <h2>Systeme</h2>
            <span className='muted'>({users.length})</span>
          </header>
          {resetDone && (
            <div className='notice' style={{ margin: '12px 16px 0' }}>
              <KeyRound size={16} /> Neues Passwort für{' '}
              <code>{resetDone.username}</code>: <code>{resetDone.password}</code>
              <button
                type='button'
                className='btn btn-icon'
                onClick={() => setResetDone(null)}
                title='Ausblenden'
              >
                <X size={14} />
              </button>
            </div>
          )}
          {loading && users.length === 0 ? (
            <p className='muted' style={{ padding: 16 }}>
              <Loader2 size={16} className='spin' /> lade…
            </p>
          ) : users.length === 0 ? (
            <p className='muted' style={{ padding: 16 }}>
              Noch keine Systeme angelegt.
            </p>
          ) : (
            <div className='table-wrap'>
              <table className='items-table'>
                <thead>
                  <tr>
                    <th>Benutzername</th>
                    <th>Angelegt</th>
                    <th className='th-num'>Fixkosten</th>
                    <th className='th-num'>Einnahmen</th>
                    <th aria-label='Aktionen'></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const busy = busyId === u.id
                    const resetting = resetId === u.id
                    return (
                      <tr key={u.id} className='item-row'>
                        <td data-label='Benutzername'>
                          <strong>{u.username}</strong>
                        </td>
                        <td data-label='Angelegt' className='td-due'>
                          <span className='small'>
                            {formatCreated(u.createdAt)}
                          </span>
                        </td>
                        <td data-label='Fixkosten' className='td-num'>
                          {u.itemCount}
                        </td>
                        <td data-label='Einnahmen' className='td-num'>
                          {u.incomeCount}
                        </td>
                        <td className='td-actions'>
                          {resetting ? (
                            <div className='actions-inline'>
                              <input
                                type='text'
                                className='reset-input'
                                value={resetPw}
                                onChange={(e) => setResetPw(e.target.value)}
                                autoFocus
                              />
                              <button
                                className='btn btn-icon'
                                title='Passwort generieren'
                                onClick={() => setResetPw(generatePassword())}
                              >
                                <Wand2 size={16} />
                              </button>
                              <button
                                className='btn btn-icon'
                                title='Passwort speichern'
                                disabled={busy || resetPw.length < 8}
                                onClick={() => saveReset(u)}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                className='btn btn-icon'
                                title='Abbrechen'
                                onClick={() => setResetId(null)}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className='actions-inline'>
                              {busy && <Loader2 size={16} className='spin' />}
                              <button
                                className='btn btn-icon'
                                title='Daten exportieren (JSON)'
                                disabled={busy}
                                onClick={() => exportUser(u)}
                              >
                                <Download size={16} />
                              </button>
                              <button
                                className='btn btn-icon'
                                title='Daten aus JSON importieren (überschreibt!)'
                                disabled={busy}
                                onClick={() => startImport(u)}
                              >
                                <Upload size={16} />
                              </button>
                              <button
                                className='btn btn-icon'
                                title='Passwort neu setzen'
                                disabled={busy}
                                onClick={() => startReset(u)}
                              >
                                <KeyRound size={16} />
                              </button>
                              <button
                                className='btn btn-icon danger'
                                title='System löschen'
                                disabled={busy}
                                onClick={() => deleteSystem(u)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <input
          ref={fileRef}
          type='file'
          accept='application/json'
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onImportFile(f)
            e.target.value = ''
          }}
        />
      </main>

      <footer className='app-foot'>
        <span className='muted small'>
          Fixi · Superadmin <strong>{user.username}</strong>
        </span>
      </footer>
    </div>
  )
}
